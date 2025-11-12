import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import {
  createSuccessResponse,
  badRequestError,
  unauthorizedError,
  notFoundError,
  internalServerError,
  logError,
} from "../shared/error-handler";

// Use lazy requires to avoid synth-time issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require("uuid");

const requestSchema = z.object({
  fileId: z.string(),
  expiresInDays: z.number().optional().nullable(),
  downloadLimit: z.number().optional().nullable(),
  password: z.string().optional().nullable(),
  isEphemeral: z.boolean().optional(), // Self-destruct after first view
});

const resolveUserContext = (event: APIGatewayProxyEvent) => {
  const claims = event.requestContext?.authorizer?.claims || {};
  return {
    userId: claims.sub as string,
  };
};

const getClients = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  const client = new DynamoDBClient({});
  return { docClient: DynamoDBDocumentClient.from(client) };
};

/**
 * POST /share
 * Creates a new share link for a file
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authContext = resolveUserContext(event);
    if (!authContext.userId) {
      return unauthorizedError();
    }

    const parsedBody = (() => {
      try {
        const json = event.body ? JSON.parse(event.body) : {};
        return requestSchema.parse(json);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw badRequestError("Invalid request body", { reason });
      }
    })();

    const { fileId, expiresInDays, downloadLimit, password, isEphemeral } =
      parsedBody;

    const filesTableName = process.env.FILES_TABLE_NAME;
    const shareLinksTableName = process.env.SHARELINKS_TABLE_NAME;

    if (!filesTableName || !shareLinksTableName) {
      return internalServerError("Required tables not configured");
    }

    const { docClient } = getClients();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      GetCommand,
      PutCommand,
      QueryCommand,
    } = require("@aws-sdk/lib-dynamodb");

    // First, verify the file exists and belongs to the user
    const fileResponse = await docClient.send(
      new QueryCommand({
        TableName: filesTableName,
        IndexName: "fileIdIndex",
        KeyConditionExpression: "fileId = :fileId",
        ExpressionAttributeValues: {
          ":fileId": fileId,
        },
        Limit: 1,
      })
    );

    if (!fileResponse.Items || fileResponse.Items.length === 0) {
      return notFoundError("File not found");
    }

    const fileRecord = fileResponse.Items[0];
    if (fileRecord.userId !== authContext.userId) {
      return notFoundError("File not found");
    }

    // Generate share link
    const linkId = uuidv4().replace(/-/g, "").substring(0, 12);
    const now = new Date();
    const createdAt = now.toISOString();

    // Handle ephemeral shares - auto-set expiry to 15 minutes and limit to 1 download
    let effectiveExpiresInDays = expiresInDays;
    let effectiveDownloadLimit = downloadLimit;

    if (isEphemeral) {
      effectiveExpiresInDays = 15 / (24 * 60); // 15 minutes in days
      effectiveDownloadLimit = 1; // Self-destruct after 1 download
    }

    // Calculate TTL if expiration is set
    let ttl: number | undefined;
    let expiresAt: string | undefined;
    if (effectiveExpiresInDays && effectiveExpiresInDays > 0) {
      const expirationDate = new Date(
        now.getTime() + effectiveExpiresInDays * 24 * 60 * 60 * 1000
      );
      ttl = Math.floor(expirationDate.getTime() / 1000);
      expiresAt = expirationDate.toISOString();
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (password) {
      // Simple hash for now - in production use bcrypt or AWS Secrets Manager
      const crypto = require("crypto");
      passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    }

    const shareLinkRecord = {
      linkId,
      fileId,
      userId: authContext.userId,
      createdAt,
      expiresAt,
      ttl,
      downloadLimit: effectiveDownloadLimit,
      downloadCount: 0,
      passwordHash: passwordHash || undefined,
      isEphemeral: isEphemeral || false,
      fileName: fileRecord.fileName || fileRecord.filename || "Unknown",
      fileSize: fileRecord.fileSize || fileRecord.size || 0,
      contentType:
        fileRecord.contentType ||
        fileRecord.mimeType ||
        "application/octet-stream",
      analytics: [], // Initialize empty analytics array
    };

    // Create share link record
    await docClient.send(
      new PutCommand({
        TableName: shareLinksTableName,
        Item: shareLinkRecord,
      })
    );

    console.info(
      JSON.stringify({
        level: "info",
        message: "Share link created",
        userId: authContext.userId,
        linkId,
        fileId,
      })
    );

    return createSuccessResponse(201, {
      data: {
        linkId,
        fileId,
        createdAt,
        expiresAt,
        downloadLimit: effectiveDownloadLimit,
        isEphemeral: isEphemeral || false,
        hasPassword: !!password,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "create-share" });
    return internalServerError();
  }
};
