import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  createSuccessResponse,
  unauthorizedError,
  notFoundError,
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
 * GET /share/list/{fileId}
 * Lists all share links for a specific file owned by the user
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authContext = resolveUserContext(event);
    if (!authContext.userId) {
      return unauthorizedError();
    }

    const fileId = event.pathParameters?.fileId;
    if (!fileId) {
      return notFoundError("File ID not provided");
    }

    const shareLinksTableName = process.env.SHARELINKS_TABLE_NAME;
    if (!shareLinksTableName) {
      return internalServerError("ShareLinks table not configured");
    }

    const { docClient } = getClients();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QueryCommand } = require("@aws-sdk/lib-dynamodb");

    // Query share links by fileId using GSI
    const response = await docClient.send(
      new QueryCommand({
        TableName: shareLinksTableName,
        IndexName: "fileIdIndex",
        KeyConditionExpression: "fileId = :fileId",
        ExpressionAttributeValues: {
          ":fileId": fileId,
        },
      })
    );

    const shareLinks = (response.Items || [])
      .filter((link: any) => link.userId === authContext.userId)
      .map((link: any) => ({
        linkId: link.linkId,
        fileId: link.fileId,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        downloadLimit: link.downloadLimit,
        downloadCount: link.downloadCount || 0,
      }));

    console.info(
      JSON.stringify({
        level: "info",
        message: "Listed share links",
        userId: authContext.userId,
        fileId,
        count: shareLinks.length,
      })
    );

    return createSuccessResponse(200, {
      data: {
        shares: shareLinks,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "list-shares" });
    return internalServerError();
  }
};
