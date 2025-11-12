import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  createSuccessResponse,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  internalServerError,
  logError,
} from "../shared/error-handler";

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
 * DELETE /share/{shareId}
 * Deletes a share link (only owner can delete)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authContext = resolveUserContext(event);
    if (!authContext.userId) {
      return unauthorizedError();
    }

    const shareId = event.pathParameters?.shareId;
    if (!shareId) {
      return notFoundError("Share ID not provided");
    }

    const shareLinksTableName = process.env.SHARELINKS_TABLE_NAME;
    if (!shareLinksTableName) {
      return internalServerError("ShareLinks table not configured");
    }

    const { docClient } = getClients();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

    // Get share link to verify ownership
    const response = await docClient.send(
      new GetCommand({
        TableName: shareLinksTableName,
        Key: { linkId: shareId },
      })
    );

    if (!response.Item) {
      return notFoundError("Share link not found");
    }

    const shareLink = response.Item;
    if (shareLink.userId !== authContext.userId) {
      return forbiddenError(
        "You do not have permission to delete this share link"
      );
    }

    // Delete the share link
    await docClient.send(
      new DeleteCommand({
        TableName: shareLinksTableName,
        Key: { linkId: shareId },
      })
    );

    console.info(
      JSON.stringify({
        level: "info",
        message: "Share link deleted",
        userId: authContext.userId,
        linkId: shareId,
        fileId: shareLink.fileId,
      })
    );

    return createSuccessResponse(200, {
      data: {
        message: "Share link deleted successfully",
        linkId: shareId,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "delete-share" });
    return internalServerError();
  }
};
