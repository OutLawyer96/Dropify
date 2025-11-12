import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  createSuccessResponse,
  internalServerError,
  logError,
  unauthorizedError,
  badRequestError,
} from "../shared/error-handler";
import { FILE_STATUS } from "../shared/constants";

type SupportedSort =
  | "date_desc"
  | "date_asc"
  | "size_desc"
  | "size_asc"
  | "name_desc"
  | "name_asc";

const DEFAULT_SORT: SupportedSort = "date_desc";

const CATEGORY_FILTERS: Record<
  string,
  { mode: "prefix" | "exact"; values: string[] }
> = {
  image: { mode: "prefix", values: ["image/"] },
  video: { mode: "prefix", values: ["video/"] },
  audio: { mode: "prefix", values: ["audio/"] },
  document: {
    mode: "exact",
    values: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/rtf",
      "application/json",
      "application/xml",
      "text/markdown",
    ],
  },
  archive: {
    mode: "exact",
    values: [
      "application/zip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/x-tar",
      "application/gzip",
    ],
  },
  code: {
    mode: "exact",
    values: [
      "text/javascript",
      "text/html",
      "text/css",
      "application/json",
      "application/xml",
      "text/markdown",
    ],
  },
};

const SORT_OPTIONS: Record<
  SupportedSort,
  { indexName?: string; asc: boolean }
> = {
  date_desc: { asc: false },
  date_asc: { asc: true },
  size_desc: { indexName: "userFileSizeIndex", asc: false },
  size_asc: { indexName: "userFileSizeIndex", asc: true },
  name_desc: { asc: false },
  name_asc: { asc: true },
};

const decodeLastKey = (token?: string) => {
  if (!token) return undefined;
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8"));
  } catch (error) {
    throw new Error("Invalid pagination token");
  }
};

const encodeLastKey = (key?: Record<string, unknown> | null) => {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key)).toString("base64");
};

const buildFilterExpression = (
  filterBy?: string,
  status?: string,
  search?: string
) => {
  const expressionParts: string[] = [];
  const expressionAttributeValues: Record<string, unknown> = {};
  const expressionAttributeNames: Record<string, string> = {
    "#fileName": "fileName",
    "#status": "status",
    "#mimeType": "mimeType",
  };

  if (filterBy) {
    const filterConfig = CATEGORY_FILTERS[filterBy.toLowerCase()];
    if (filterConfig) {
      if (filterConfig.mode === "prefix") {
        const conditions = filterConfig.values.map((value, idx) => {
          const valueKey = `:mimePrefix${idx}`;
          expressionAttributeValues[valueKey] = value;
          return `begins_with(#mimeType, ${valueKey})`;
        });
        if (conditions.length) {
          expressionParts.push(`(${conditions.join(" OR ")})`);
        }
      } else if (filterConfig.values.length) {
        const conditions = filterConfig.values.map((value, idx) => {
          const valueKey = `:mimeExact${idx}`;
          expressionAttributeValues[valueKey] = value;
          return `#mimeType = ${valueKey}`;
        });
        expressionParts.push(`(${conditions.join(" OR ")})`);
      }
    }
  }

  if (status) {
    const allowedStatuses = new Set(Object.values(FILE_STATUS));
    if (allowedStatuses.has(status as FILE_STATUS)) {
      expressionAttributeValues[":status"] = status;
      expressionParts.push("#status = :status");
    }
  }

  if (search) {
    expressionAttributeValues[":search"] = search;
    expressionParts.push("contains(#fileName, :search)");
  }

  if (!expressionParts.length) {
    return {};
  }

  return {
    FilterExpression: expressionParts.join(" AND "),
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
  };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const userSub = event.requestContext?.authorizer?.claims?.sub;
  if (!userSub) {
    return unauthorizedError();
  }

  const qs = event.queryStringParameters || {};
  const limitParam = qs.limit ? Number(qs.limit) : undefined;
  if (limitParam !== undefined && Number.isNaN(limitParam)) {
    return badRequestError("limit must be numeric");
  }
  const limit = limitParam ? Math.min(100, Math.max(1, limitParam)) : 20;

  let exclusiveStartKey;
  try {
    exclusiveStartKey = decodeLastKey(qs.lastKey);
  } catch (error) {
    return badRequestError("Invalid pagination token");
  }

  const sortParam = (qs.sortBy as SupportedSort) || DEFAULT_SORT;
  const sortBy = SORT_OPTIONS[sortParam] ? sortParam : DEFAULT_SORT;
  if (
    (sortBy === "name_asc" || sortBy === "name_desc") &&
    typeof qs.lastKey === "string" &&
    qs.lastKey.length > 0
  ) {
    return badRequestError(
      "Name-based sorting does not support pagination. Remove lastKey or choose a different sort order."
    );
  }
  const { indexName, asc } = SORT_OPTIONS[sortBy];
  const filterBy = qs.filterBy?.toLowerCase();
  const statusFilter = qs.status?.toLowerCase();
  const search = qs.search;

  const {
    DynamoDBDocumentClient,
    QueryCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

  const ddb = new DynamoDBClient({});
  const doc = DynamoDBDocumentClient.from(ddb);

  const tableName = process.env.FILES_TABLE_NAME;
  if (!tableName) {
    return internalServerError("Files table not configured");
  }

  const baseParams: Record<string, unknown> = {
    TableName: tableName,
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userSub },
    Limit: limit,
    ScanIndexForward: asc,
  };

  if (indexName) {
    baseParams.IndexName = indexName;
  }

  if (exclusiveStartKey) {
    baseParams.ExclusiveStartKey = exclusiveStartKey;
  }

  const filterExpression = buildFilterExpression(
    filterBy,
    statusFilter,
    search
  );

  if (filterExpression.FilterExpression) {
    baseParams.FilterExpression = filterExpression.FilterExpression;
    baseParams.ExpressionAttributeValues = {
      ...(baseParams.ExpressionAttributeValues as Record<string, unknown>),
      ...filterExpression.ExpressionAttributeValues,
    };
    baseParams.ExpressionAttributeNames = {
      ...(filterExpression.ExpressionAttributeNames || {}),
    };
  }

  try {
    const queryResponse = await doc.send(new QueryCommand(baseParams));
    let items: Array<Record<string, any>> =
      (queryResponse.Items as Array<Record<string, any>>) || [];

    if (sortBy === "name_asc" || sortBy === "name_desc") {
      items = items.sort((a, b) => {
        const nameA = (a.fileName || "").toLowerCase();
        const nameB = (b.fileName || "").toLowerCase();
        if (nameA < nameB) return sortBy === "name_asc" ? -1 : 1;
        if (nameA > nameB) return sortBy === "name_asc" ? 1 : -1;
        return 0;
      });
    }

    const nextKey = encodeLastKey(queryResponse.LastEvaluatedKey);
    const responsePayload = {
      files: items,
      nextKey,
      hasMore: Boolean(queryResponse.LastEvaluatedKey),
      totalCount: queryResponse.Count ?? items.length,
      sortBy,
      filterBy: filterBy || null,
      status: statusFilter || null,
      search: search || null,
    };

    console.info(
      JSON.stringify({
        level: "info",
        message: "list-files query executed",
        userId: userSub,
        sortBy,
        filterBy,
        status: statusFilter,
        search,
        limit,
        returned: items.length,
        hasMore: responsePayload.hasMore,
      })
    );

    return createSuccessResponse(200, { data: responsePayload });
  } catch (error) {
    logError(error, {
      handler: "list-files",
      userId: userSub,
      sortBy,
      filterBy,
      status: statusFilter,
      search,
    });
    return internalServerError();
  }
};
