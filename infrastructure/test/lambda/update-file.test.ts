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
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe("update-file lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    process.env.FILES_TABLE_NAME = "FilesTable";
  });

  const buildEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {},
    body: Record<string, unknown> = {}
  ): APIGatewayProxyEvent =>
    ({
      pathParameters: { fileId: "file-123" },
      body: JSON.stringify(body),
      requestContext: {
        authorizer: { claims: { sub: "user-123" } },
      } as any,
      ...overrides,
    } as APIGatewayProxyEvent);

  it("updates filename, metadata, tags, and expiration", async () => {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            userId: "user-123",
            sortKey: `${now}#file-123`,
            fileId: "file-123",
            fileName: "old.txt",
          },
        ],
      })
      .mockResolvedValueOnce({
        Attributes: {
          userId: "user-123",
          fileId: "file-123",
          fileName: "New Title.pdf",
          metadata: { description: "Quarterly" },
          tags: ["finance"],
          expiresAt: Math.floor(new Date(future).getTime() / 1000),
        },
      });

    const { handler } = await import("../../src/lambda/files/update-file");
    const response = await handler(
      buildEvent(
        {},
        {
          fileName: "New Title.pdf",
          metadata: { description: "Quarterly" },
          tags: ["finance", ""],
          expiresAt: future,
        }
      )
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.fileName).toBe("New Title.pdf");
    expect(body.data.metadata.description).toBe("Quarterly");
    expect(body.data.tags).toEqual(["finance"]);
    expect(typeof body.data.expiresAt).toBe("number");

    const updateCall = sendMock.mock.calls[1][0];
    expect(updateCall.input.ExpressionAttributeNames["#expiresAt"]).toBe(
      "expiresAt"
    );
    expect(
      updateCall.input.ExpressionAttributeValues[":expiresAt"]
    ).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects past expiration", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          userId: "user-123",
          sortKey: "2025#file",
          fileId: "file-123",
        },
      ],
    });
    const { handler } = await import("../../src/lambda/files/update-file");
    const response = await handler(buildEvent({}, { expiresAt: past }));
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.message).toMatch(/future/);
  });

  it("requires body payload", async () => {
    const { handler } = await import("../../src/lambda/files/update-file");
    const response = await handler(
      buildEvent({ body: undefined as any }, {} as any)
    );
    expect(response.statusCode).toBe(400);
  });

  it("returns unauthorized when claims missing", async () => {
    const { handler } = await import("../../src/lambda/files/update-file");
    const response = await handler(
      buildEvent({ requestContext: { authorizer: { claims: {} } } as any })
    );
    expect(response.statusCode).toBe(401);
  });
});
