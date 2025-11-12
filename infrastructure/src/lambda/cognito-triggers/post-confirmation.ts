import { DEFAULT_PLAN, USER_PLANS } from "../shared/constants";
import { getStorageLimitForPlan } from "../shared/dynamodb-helpers";

const MAX_RETRIES = 3;

const isRetryable = (error: any): boolean => {
  if (!error) return false;
  const codes = [
    "ProvisionedThroughputExceededException",
    "ThrottlingException",
  ]; // common retryable errors
  if (codes.includes(error.name)) return true;
  const status = error.$metadata?.httpStatusCode;
  return status && status >= 500;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const handler = async (event: any) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    DynamoDBDocumentClient,
    PutCommand,
  } = require("@aws-sdk/lib-dynamodb");

  const tableName = process.env.USERS_TABLE_NAME;
  if (!tableName) {
    console.warn("USERS_TABLE_NAME not configured");
    return event;
  }

  const ddb = new DynamoDBClient({});
  const client = DynamoDBDocumentClient.from(ddb);

  const user = event.request?.userAttributes || {};
  const userId = event.userName;
  const email: string = user.email;
  const requestedPlan = (user["custom:plan"] as string) || DEFAULT_PLAN;
  const plan = Object.values(USER_PLANS).includes(requestedPlan as USER_PLANS)
    ? (requestedPlan as USER_PLANS)
    : DEFAULT_PLAN;

  const displayName =
    user.name || user["given_name"] || (email ? email.split("@")[0] : userId);
  const nowIso = new Date().toISOString();

  const item = {
    userId,
    email,
    displayName,
    createdAt: nowIso,
    lastLoginAt: nowIso,
    storageUsed: 0,
    storageLimit: getStorageLimitForPlan(plan),
    plan,
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(userId)",
        })
      );
      return event;
    } catch (err) {
      console.error("post-confirmation error", err);
      if (attempt === MAX_RETRIES - 1 || !isRetryable(err)) {
        throw err;
      }
      await wait(2 ** attempt * 100);
    }
  }

  return event;
};
