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
import { sanitizeFileName, validateFileName } from "../shared/validation";

interface UpdateFileRequestBody {
  readonly fileName?: unknown;
  readonly metadata?: unknown;
  readonly tags?: unknown;
  readonly expiresAt?: unknown;
}

const MAX_TAGS = 50;
const MAX_METADATA_KEYS = 50;

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

  if (!event.body) {
    return badRequestError("Request body required");
  }

  let payload: UpdateFileRequestBody;
  try {
    payload = JSON.parse(event.body) as UpdateFileRequestBody;
  } catch (error) {
    return badRequestError("Invalid JSON payload");
  }

  const {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

  const ddbClient = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(ddbClient);

  const tableName = process.env.FILES_TABLE_NAME;
  if (!tableName) {
    return internalServerError("Files table not configured");
  }

  try {
    const queryResponse = await docClient.send(
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

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {
      "#lastAccessedAt": "lastAccessedAt",
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ":lastAccessedAt": new Date().toISOString(),
    };

    let sanitizedFileName: string | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, "fileName")) {
      const validation = validateFileName(payload.fileName);
      if (!validation.success) {
        return badRequestError(validation.message ?? "Invalid file name", {
          details: validation.details,
        });
      }
      sanitizedFileName = sanitizeFileName(String(payload.fileName));
      updateExpressions.push("#fileName = :fileName");
      expressionAttributeNames["#fileName"] = "fileName";
      expressionAttributeValues[":fileName"] = sanitizedFileName;
    }

    let sanitizedMetadata: Record<string, string> | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, "metadata")) {
      if (
        typeof payload.metadata !== "object" ||
        payload.metadata === null ||
        Array.isArray(payload.metadata)
      ) {
        return badRequestError("metadata must be a JSON object");
      }

      const entries = Object.entries(payload.metadata).slice(
        0,
        MAX_METADATA_KEYS
      );
      sanitizedMetadata = {};
      for (const [key, value] of entries) {
        if (typeof value === "string" || typeof value === "number") {
          sanitizedMetadata[key] = String(value).slice(0, 2048);
        }
      }

      updateExpressions.push("#metadata = :metadata");
      expressionAttributeNames["#metadata"] = "metadata";
      expressionAttributeValues[":metadata"] = sanitizedMetadata;
    }

    let normalizedTags: string[] | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, "tags")) {
      if (!Array.isArray(payload.tags)) {
        return badRequestError("tags must be an array of strings");
      }

      normalizedTags = payload.tags
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, MAX_TAGS);

      updateExpressions.push("#tags = :tags");
      expressionAttributeNames["#tags"] = "tags";
      expressionAttributeValues[":tags"] = normalizedTags;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "expiresAt")) {
      if (typeof payload.expiresAt !== "string") {
        return badRequestError("expiresAt must be an ISO-8601 string");
      }

      const parsed = new Date(payload.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return badRequestError("expiresAt must be a valid ISO-8601 timestamp");
      }

      if (parsed.getTime() <= Date.now()) {
        return badRequestError("expiresAt must be in the future");
      }

      const expiresAtEpoch = Math.floor(parsed.getTime() / 1000);
      updateExpressions.push("#expiresAt = :expiresAt");
      expressionAttributeNames["#expiresAt"] = "expiresAt";
      expressionAttributeValues[":expiresAt"] = expiresAtEpoch;
    }

    if (updateExpressions.length === 0) {
      return badRequestError("No valid update fields supplied");
    }

    updateExpressions.push("#lastAccessedAt = :lastAccessedAt");

    const updateExpression = `SET ${updateExpressions.join(", ")}`;

    const updateResponse = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId: item.userId, sortKey: item.sortKey },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      })
    );

    const updatedItem = updateResponse.Attributes || {};

    console.info(
      JSON.stringify({
        level: "info",
        message: "update-file success",
        fileId,
        userId: userSub,
        fields: {
          fileName: sanitizedFileName,
          metadata: sanitizedMetadata ? Object.keys(sanitizedMetadata) : null,
          tags: normalizedTags?.length ?? null,
          expiresAt: expressionAttributeValues[":expiresAt"] ?? null,
        },
      })
    );

    return createSuccessResponse(200, {
      data: updatedItem,
    });
  } catch (error) {
    logError(error, {
      handler: "update-file",
      stage: process.env.STAGE,
      fileId,
      userId: userSub,
    });
    return internalServerError();
  }
};
