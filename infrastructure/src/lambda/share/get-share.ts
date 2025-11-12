import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  createSuccessResponse,
  notFoundError,
  forbiddenError,
  internalServerError,
  logError,
} from "../shared/error-handler";

const getClients = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

  const dynamoClient = new DynamoDBClient({});
  const s3Client = new S3Client({});
  return {
    docClient: DynamoDBDocumentClient.from(dynamoClient),
    s3Client,
    getSignedUrl,
    GetObjectCommand,
  };
};

/**
 * GET /share/{shareId}?password=xxx&download=true
 * Retrieves a share link and provides download URL
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const shareId = event.pathParameters?.shareId;
    if (!shareId) {
      return notFoundError("Share ID not provided");
    }

    const password = event.queryStringParameters?.password;
    const isDownloadRequest = event.queryStringParameters?.download === "true";

    const shareLinksTableName = process.env.SHARELINKS_TABLE_NAME;
    const filesTableName = process.env.FILES_TABLE_NAME;
    const uploadsBucketName = process.env.UPLOADS_BUCKET_NAME;

    if (!shareLinksTableName || !filesTableName || !uploadsBucketName) {
      return internalServerError("Required resources not configured");
    }

    const { docClient, s3Client, getSignedUrl, GetObjectCommand } =
      getClients();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      GetCommand,
      UpdateCommand,
      QueryCommand,
    } = require("@aws-sdk/lib-dynamodb");

    // Get share link record
    const shareLinkResponse = await docClient.send(
      new GetCommand({
        TableName: shareLinksTableName,
        Key: { linkId: shareId },
      })
    );

    if (!shareLinkResponse.Item) {
      return notFoundError("Share link not found");
    }

    const shareLink = shareLinkResponse.Item;

    // Check password if required
    if (shareLink.passwordHash) {
      if (!password) {
        return createSuccessResponse(200, {
          requiresPassword: true,
          linkId: shareId,
          fileName: shareLink.fileName,
        });
      }

      // Verify password
      const crypto = require("crypto");
      const providedHash = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
      if (providedHash !== shareLink.passwordHash) {
        return forbiddenError("Incorrect password");
      }
    }

    // Check if link has expired
    if (shareLink.expiresAt) {
      const expirationDate = new Date(shareLink.expiresAt);
      if (expirationDate < new Date()) {
        return forbiddenError("Share link has expired");
      }
    }

    // Check download limit
    if (shareLink.downloadLimit) {
      const downloadCount = shareLink.downloadCount || 0;
      if (downloadCount >= shareLink.downloadLimit) {
        return forbiddenError("Download limit reached");
      }
    }

    // Get file record to find S3 key
    const fileResponse = await docClient.send(
      new QueryCommand({
        TableName: filesTableName,
        IndexName: "fileIdIndex",
        KeyConditionExpression: "fileId = :fileId",
        ExpressionAttributeValues: {
          ":fileId": shareLink.fileId,
        },
        Limit: 1,
      })
    );

    if (!fileResponse.Items || fileResponse.Items.length === 0) {
      return notFoundError("File not found");
    }

    const fileRecord = fileResponse.Items[0];

    // Generate presigned URL with appropriate content disposition
    const getObjectCmd = new GetObjectCommand({
      Bucket: uploadsBucketName,
      Key: fileRecord.s3Key || fileRecord.key,
      // Only use attachment disposition for download requests
      ...(isDownloadRequest && {
        ResponseContentDisposition: `attachment; filename="${shareLink.fileName}"`,
      }),
    });

    const downloadUrl = await getSignedUrl(s3Client, getObjectCmd, {
      expiresIn: 3600, // 1 hour
    });

    // Collect analytics data
    const userAgent =
      event.headers?.["User-Agent"] ||
      event.headers?.["user-agent"] ||
      "Unknown";
    const sourceIP = event.requestContext?.identity?.sourceIp || "Unknown";
    const referer =
      event.headers?.Referer || event.headers?.referer || "Direct";

    const analyticsEntry = {
      timestamp: new Date().toISOString(),
      action: isDownloadRequest ? "download" : "view",
      ip: sourceIP,
      userAgent,
      referer,
      // Parse device/browser info from user agent (simplified)
      device: userAgent.includes("Mobile") ? "Mobile" : "Desktop",
      browser: userAgent.includes("Chrome")
        ? "Chrome"
        : userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Safari")
        ? "Safari"
        : "Other",
    };

    // Track analytics and update download count
    const updateParams: any = {
      TableName: shareLinksTableName,
      Key: { linkId: shareId },
      UpdateExpression:
        "SET analytics = list_append(if_not_exists(analytics, :empty_list), :new_entry)",
      ExpressionAttributeValues: {
        ":new_entry": [analyticsEntry],
        ":empty_list": [],
      },
    };

    // Add download count increment if downloading
    if (isDownloadRequest) {
      updateParams.UpdateExpression +=
        ", downloadCount = if_not_exists(downloadCount, :zero) + :inc";
      updateParams.ExpressionAttributeValues[":inc"] = 1;
      updateParams.ExpressionAttributeValues[":zero"] = 0;

      // For ephemeral shares, delete the link after first download
      if (shareLink.isEphemeral && shareLink.downloadCount === 0) {
        // Set TTL to now + 1 minute for graceful deletion
        updateParams.UpdateExpression += ", ttl = :ttl_now";
        updateParams.ExpressionAttributeValues[":ttl_now"] =
          Math.floor(Date.now() / 1000) + 60;
      }
    }

    await docClient.send(new UpdateCommand(updateParams));

    console.info(
      JSON.stringify({
        level: "info",
        message: isDownloadRequest ? "File downloaded" : "Share link viewed",
        linkId: shareId,
        fileId: shareLink.fileId,
        downloadCount: shareLink.downloadCount || 0,
      })
    );

    // Return file data for preview page
    return createSuccessResponse(200, {
      data: {
        linkId: shareId,
        fileName: shareLink.fileName,
        fileSize: fileRecord.size || fileRecord.fileSize,
        contentType: fileRecord.contentType || fileRecord.mimeType,
        downloadUrl,
        expiresAt: shareLink.expiresAt,
        downloadLimit: shareLink.downloadLimit,
        downloadCount: shareLink.downloadCount || 0,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "get-share" });
    return internalServerError();
  }
};
