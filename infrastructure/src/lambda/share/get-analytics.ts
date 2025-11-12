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
 * GET /share/analytics/{shareId}
 * Retrieves analytics for a share link (owner only)
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
      return internalServerError("Required tables not configured");
    }

    const { docClient } = getClients();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GetCommand } = require("@aws-sdk/lib-dynamodb");

    // Get share link record
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

    // Verify ownership
    if (shareLink.userId !== authContext.userId) {
      return notFoundError("Share link not found");
    }

    // Aggregate analytics
    const analytics = shareLink.analytics || [];
    const totalViews = analytics.filter((a: any) => a.action === "view").length;
    const totalDownloads = analytics.filter(
      (a: any) => a.action === "download"
    ).length;

    // Device breakdown
    const deviceBreakdown = analytics.reduce((acc: any, entry: any) => {
      acc[entry.device] = (acc[entry.device] || 0) + 1;
      return acc;
    }, {});

    // Browser breakdown
    const browserBreakdown = analytics.reduce((acc: any, entry: any) => {
      acc[entry.browser] = (acc[entry.browser] || 0) + 1;
      return acc;
    }, {});

    // Top referrers
    const refererBreakdown = analytics.reduce((acc: any, entry: any) => {
      acc[entry.referer] = (acc[entry.referer] || 0) + 1;
      return acc;
    }, {});

    // Geographic distribution (approximate from IP - simplified)
    const ipLocations = analytics.map((entry: any) => {
      // This is simplified - in production, use a GeoIP service
      return {
        ip: entry.ip,
        timestamp: entry.timestamp,
        action: entry.action,
      };
    });

    // Timeline data (hourly breakdown)
    const timeline = analytics.reduce((acc: any, entry: any) => {
      const hour = entry.timestamp.substring(0, 13); // YYYY-MM-DDTHH
      if (!acc[hour]) {
        acc[hour] = { views: 0, downloads: 0 };
      }
      if (entry.action === "view") acc[hour].views++;
      if (entry.action === "download") acc[hour].downloads++;
      return acc;
    }, {});

    console.info(
      JSON.stringify({
        level: "info",
        message: "Analytics retrieved",
        linkId: shareId,
        userId: authContext.userId,
        totalViews,
        totalDownloads,
      })
    );

    return createSuccessResponse(200, {
      data: {
        linkId: shareId,
        fileName: shareLink.fileName,
        createdAt: shareLink.createdAt,
        expiresAt: shareLink.expiresAt,
        isEphemeral: shareLink.isEphemeral || false,
        downloadLimit: shareLink.downloadLimit,
        downloadCount: shareLink.downloadCount || 0,
        summary: {
          totalViews,
          totalDownloads,
          totalInteractions: totalViews + totalDownloads,
          lastAccessed:
            analytics.length > 0
              ? analytics[analytics.length - 1].timestamp
              : null,
        },
        breakdown: {
          devices: deviceBreakdown,
          browsers: browserBreakdown,
          referrers: refererBreakdown,
        },
        timeline,
        recentActivity: analytics.slice(-20).reverse(), // Last 20 events, newest first
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "get-analytics" });
    return internalServerError();
  }
};
