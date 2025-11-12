/**
 * DynamoDB utilities shared across Lambda handlers.
 */
import { FILE_STATUS, STORAGE_LIMITS, USER_PLANS } from "./constants";
import type {
  DynamoDBFileRecord,
  DynamoDBUserRecord,
} from "../../../lib/types";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

interface DynamoClients {
  docClient: DynamoDBDocumentClient;
}

let cachedClients: DynamoClients | null = null;

const getClients = (): DynamoClients => {
  if (cachedClients) return cachedClients;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  const client = new DynamoDBClient({});
  cachedClients = { docClient: DynamoDBDocumentClient.from(client) };
  return cachedClients;
};

export interface UserStorageInfo {
  userId: string;
  storageUsed: number;
  storageLimit: number;
  plan: USER_PLANS | string;
}

const resolveUsersTable = (explicit?: string): string => {
  const table = explicit || process.env.USERS_TABLE_NAME;
  if (!table) {
    throw new Error("USERS_TABLE_NAME not configured");
  }
  return table;
};

/** Retrieves storage usage information for a user. */
export const getUserStorageInfo = async (
  userId: string,
  tableName?: string
): Promise<UserStorageInfo | null> => {
  const { docClient } = getClients();
  const resolvedTable = resolveUsersTable(tableName);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GetCommand } = require("@aws-sdk/lib-dynamodb");

  try {
    const response = await docClient.send(
      new GetCommand({ TableName: resolvedTable, Key: { userId } })
    );

    if (!response.Item) return null;

    const record = response.Item as DynamoDBUserRecord & {
      plan?: USER_PLANS | string;
    };

    return {
      userId: record.userId,
      storageUsed: record.storageUsed || 0,
      storageLimit: record.storageLimit || getStorageLimitForPlan(record.plan),
      plan: (record.plan as USER_PLANS) || USER_PLANS.FREE,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load storage info for user ${userId}: ${reason}`
    );
  }
};

export type StorageUpdateDirection = "increment" | "decrement";

/** Atomically updates the storage usage counter for a user. */
export const updateUserStorage = async (
  userId: string,
  sizeDelta: number,
  direction: StorageUpdateDirection = "increment",
  tableName?: string
): Promise<void> => {
  const { docClient } = getClients();
  const resolvedTable = resolveUsersTable(tableName);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");

  const amount = Math.abs(sizeDelta);
  const signedDelta = direction === "decrement" ? -amount : amount;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: resolvedTable,
        Key: { userId },
        UpdateExpression: "ADD storageUsed :delta",
        ExpressionAttributeValues: {
          ":delta": signedDelta,
        },
      })
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to update storage usage for user ${userId}: ${reason}`
    );
  }
};

export interface QuotaCheckResult {
  allowed: boolean;
  projectedUsage: number;
  remaining: number;
}

/** Determines if a new upload can proceed under the user's quota. */
export const checkStorageQuota = (
  storageUsed: number,
  storageLimit: number,
  fileSize: number
): QuotaCheckResult => {
  const projected = storageUsed + fileSize;
  const remaining = Math.max(storageLimit - projected, 0);
  return {
    allowed: projected <= storageLimit,
    projectedUsage: projected,
    remaining,
  };
};

/** Resolves the storage limit associated with a plan. */
export const getStorageLimitForPlan = (plan?: string): number => {
  switch (plan) {
    case USER_PLANS.PREMIUM:
      return STORAGE_LIMITS.PREMIUM_LIMIT;
    case USER_PLANS.ENTERPRISE:
      return STORAGE_LIMITS.ENTERPRISE_LIMIT;
    case USER_PLANS.FREE:
    default:
      return STORAGE_LIMITS.FREE_LIMIT;
  }
};

export interface CreateFileRecordInput {
  userId: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  uploadTimestamp: string;
  downloadCount?: number;
  metadata?: Record<string, string>;
  checksum?: string;
  status?: FILE_STATUS;
}

export interface FileRecord extends DynamoDBFileRecord {
  status: FILE_STATUS;
  checksum?: string;
}

/** Builds a DynamoDB record for newly finalized uploads. */
export const createFileRecord = (input: CreateFileRecordInput): FileRecord => {
  const {
    userId,
    fileId,
    fileName,
    fileSize,
    mimeType,
    s3Key,
    uploadTimestamp,
    downloadCount = 0,
    metadata,
    checksum,
    status = FILE_STATUS.AVAILABLE,
  } = input;

  const sortKey = buildSortKey(uploadTimestamp, fileId);

  return {
    userId,
    sortKey,
    fileId,
    fileName,
    fileSize,
    mimeType,
    s3Key,
    uploadTimestamp,
    lastAccessedAt: uploadTimestamp,
    downloadCount,
    metadata,
    status,
    checksum,
  };
};

/** Returns the composite sort key format (timestamp#fileId). */
export const buildSortKey = (isoTimestamp: string, fileId: string): string =>
  `${isoTimestamp}#${fileId}`;
