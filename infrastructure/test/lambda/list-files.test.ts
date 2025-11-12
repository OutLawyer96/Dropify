import type { APIGatewayProxyEvent } from "aws-lambda";

const sendMock = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: sendMock }),
    },
    QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe("list-files lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    process.env.FILES_TABLE_NAME = "FilesTable";
  });

  const buildEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {}
  ): APIGatewayProxyEvent =>
    ({
      queryStringParameters: {},
      requestContext: {
        authorizer: {
          claims: { sub: "user-123" },
        },
      } as any,
      ...overrides,
    } as APIGatewayProxyEvent);

  it("returns sorted files when size sorting requested", async () => {
    const now = new Date().toISOString();
    sendMock.mockResolvedValueOnce({
      Items: [
        { fileId: "f1", fileName: "B", fileSize: 300, uploadTimestamp: now },
        { fileId: "f2", fileName: "A", fileSize: 100, uploadTimestamp: now },
      ],
      Count: 2,
      LastEvaluatedKey: { userId: "user-123", sortKey: `${now}#f2` },
    });

    const { handler } = await import("../../src/lambda/files/list-files");
    const response = await handler(
      buildEvent({
        queryStringParameters: { sortBy: "size_desc", limit: "2" },
      })
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.files).toHaveLength(2);
    expect(body.data.hasMore).toBe(true);

    const queryCall = sendMock.mock.calls[0][0];
    expect(queryCall.input.IndexName).toBe("userFileSizeIndex");
    expect(queryCall.input.ScanIndexForward).toBe(false);
  });

  it("rejects paginated requests with name sorting", async () => {
    const token = Buffer.from(JSON.stringify({ sortKey: "abc" })).toString(
      "base64"
    );
    const { handler } = await import("../../src/lambda/files/list-files");
    const response = await handler(
      buildEvent({
        queryStringParameters: { sortBy: "name_desc", lastKey: token },
      })
    );
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.message).toMatch(/Name-based sorting/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns unauthorized when sub missing", async () => {
    const { handler } = await import("../../src/lambda/files/list-files");
    const response = await handler(
      buildEvent({
        requestContext: { authorizer: { claims: {} } } as any,
      })
    );
    expect(response.statusCode).toBe(401);
  });

  it("handles invalid pagination token", async () => {
    const { handler } = await import("../../src/lambda/files/list-files");
    const response = await handler(
      buildEvent({ queryStringParameters: { lastKey: "not-base64" } })
    );
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.message).toBe("Invalid pagination token");
  });
});
