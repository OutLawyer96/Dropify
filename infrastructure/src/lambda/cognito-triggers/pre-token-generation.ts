export const handler = async (event: any) => {
  try {
    // Lazy require DynamoDB Document client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      DynamoDBDocumentClient,
      GetCommand,
    } = require("@aws-sdk/lib-dynamodb");

    const ddb = new DynamoDBClient({});
    const client = DynamoDBDocumentClient.from(ddb);

    const userId =
      event.request.userAttributes?.sub ||
      event.userName ||
      event.request.userAttributes?.email;
    const tableName = process.env.USERS_TABLE_NAME;
    if (!tableName || !userId) return event;

    const resp = await client.send(
      new GetCommand({ TableName: tableName, Key: { userId } })
    );
    const user = resp.Item || {};

    // Add custom claims from user profile
    event.response = event.response || {};
    event.response.claimsOverrideDetails =
      event.response.claimsOverrideDetails || {};
    event.response.claimsOverrideDetails.claimsToAddOrOverride = {
      ...(event.response.claimsOverrideDetails.claimsToAddOrOverride || {}),
      "x-user-role": user.role || "user",
      "x-user-id": user.userId || userId,
    };

    return event;
  } catch (err) {
    console.error("pre-token-generation error", err);
    throw err;
  }
};
