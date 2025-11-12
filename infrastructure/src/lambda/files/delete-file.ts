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
import { updateUserStorage } from "../shared/dynamodb-helpers";
import { FILE_STATUS } from "../shared/constants";

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
    DeleteCommand,
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

    if (
      item.status === FILE_STATUS.PENDING ||
      item.status === FILE_STATUS.VALIDATING
    ) {
      return badRequestError("File is not yet available for deletion");
    }

    const bucketName = process.env.UPLOADS_BUCKET_NAME;
    const s3Key = item.s3Key as string | undefined;
    const fileSize = Number(item.fileSize) || 0;

    if (bucketName && s3Key) {
      try {
        const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
        const s3 = new S3Client({});
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: s3Key })
        );
      } catch (error) {
        logError(error, {
          handler: "delete-file",
          stage: process.env.STAGE,
          action: "delete-s3-object",
          fileId,
          userId: userSub,
        });
      }
    }

    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { userId: item.userId, sortKey: item.sortKey },
      })
    );

    try {
      await updateUserStorage(item.userId, fileSize, "decrement");
    } catch (error) {
      logError(error, {
        handler: "delete-file",
        stage: process.env.STAGE,
        action: "update-user-storage",
        fileId,
        userId: userSub,
        fileSize,
      });
    }

    console.info(
      JSON.stringify({
        level: "info",
        message: "delete-file success",
        fileId,
        userId: userSub,
        fileSize,
      })
    );

    return createSuccessResponse(200, {
      data: {
        fileId,
        deleted: true,
        fileName: item.fileName ?? null,
        storageReclaimed: fileSize,
      },
    });
  } catch (error) {
    logError(error, {
      handler: "delete-file",
      stage: process.env.STAGE,
      fileId,
      userId: userSub,
    });
    return internalServerError();
  }
};
