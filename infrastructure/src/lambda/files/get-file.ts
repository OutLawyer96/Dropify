import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  badRequestError,
  createSuccessResponse,
  forbiddenError,
  internalServerError,
  logError,
  notFoundError,
  unauthorizedError,
} from "../shared/error-handler";
import { PRESIGNED_URL_EXPIRY } from "../shared/constants";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const fileId = event.pathParameters?.fileId;
  if (!fileId) {
    return badRequestError("fileId required");
  }

  const userSub = event.requestContext?.authorizer?.claims?.sub;
  if (!userSub) {
    return unauthorizedError();
  }

  const {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

  const ddb = new DynamoDBClient({});
  const doc = DynamoDBDocumentClient.from(ddb);

  const tableName = process.env.FILES_TABLE_NAME;
  if (!tableName) {
    return internalServerError("Files table not configured");
  }

  try {
    const queryResponse = await doc.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "fileIdIndex",
        KeyConditionExpression: "fileId = :fid",
        ExpressionAttributeValues: { ":fid": fileId },
        Limit: 1,
      })
    );

    const item = (queryResponse.Items && queryResponse.Items[0]) || null;
    if (!item) {
      return notFoundError("File not found");
    }

    if (item.userId !== userSub) {
      return forbiddenError();
    }

    const bucket = process.env.UPLOADS_BUCKET_NAME;
    const s3Key = item.s3Key as string | undefined;
    let downloadUrl: string | null = null;

    if (bucket && s3Key) {
      try {
        const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
        const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

        const s3 = new S3Client({});
        const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
        downloadUrl = await getSignedUrl(s3, command, {
          expiresIn: PRESIGNED_URL_EXPIRY,
        });
      } catch (error) {
        logError(error, {
          handler: "get-file",
          stage: process.env.STAGE,
          fileId,
          userId: userSub,
          action: "generate-presigned-url",
        });
      }
    }

    const nowIso = new Date().toISOString();
    const updatedDownloadCount = (item.downloadCount || 0) + 1;

    const responseRecord = {
      ...item,
      downloadUrl,
      downloadUrlExpiresIn: downloadUrl ? PRESIGNED_URL_EXPIRY : null,
      downloadCount: updatedDownloadCount,
      lastAccessedAt: nowIso,
    };

    // Fire-and-forget download audit to avoid delaying response.
    void doc
      .send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: item.userId, sortKey: item.sortKey },
          UpdateExpression:
            "SET downloadCount = if_not_exists(downloadCount, :zero) + :inc, lastAccessedAt = :now",
          ExpressionAttributeValues: {
            ":zero": 0,
            ":inc": 1,
            ":now": nowIso,
          },
        })
      )
      .catch((error: unknown) =>
        logError(error, {
          handler: "get-file",
          stage: process.env.STAGE,
          fileId,
          userId: userSub,
          action: "increment-download-count",
        })
      );

    console.info(
      JSON.stringify({
        level: "info",
        message: "get-file request served",
        fileId,
        userId: userSub,
        downloadUrlGenerated: Boolean(downloadUrl),
        downloadCount: updatedDownloadCount,
      })
    );

    return createSuccessResponse(200, {
      data: responseRecord,
    });
  } catch (error) {
    logError(error, {
      handler: "get-file",
      stage: process.env.STAGE,
      fileId,
      userId: userSub,
    });
    return internalServerError();
  }
};
