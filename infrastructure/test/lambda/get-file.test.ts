import type { APIGatewayProxyEvent } from "aws-lambda";

const sendMock = jest.fn();
const getSignedUrlMock = jest.fn();

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

jest.mock(
  "@aws-sdk/client-s3",
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({})),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  }),
  { virtual: true }
);

jest.mock(
  "@aws-sdk/s3-request-presigner",
  () => ({
    getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
  }),
  { virtual: true }
);

describe("get-file lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
    process.env.FILES_TABLE_NAME = "FilesTable";
    process.env.UPLOADS_BUCKET_NAME = "Uploads";
    process.env.PRESIGNED_URL_EXPIRY = "900";
  });

  const buildEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {}
  ): APIGatewayProxyEvent =>
    ({
      pathParameters: { fileId: "file-123" },
      requestContext: {
        authorizer: { claims: { sub: "user-123" } },
      } as any,
      ...overrides,
    } as APIGatewayProxyEvent);

  it("returns file metadata with download URL", async () => {
    const now = new Date().toISOString();
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            userId: "user-123",
            sortKey: `${now}#file-123`,
            fileId: "file-123",
            fileName: "report.pdf",
            fileSize: 1024,
            s3Key: "user-123/file-123",
            downloadCount: 2,
          },
        ],
      })
      .mockResolvedValueOnce({});
    getSignedUrlMock.mockResolvedValueOnce("https://example.com/download");

    const { handler } = await import("../../src/lambda/files/get-file");
    const response = await handler(buildEvent());

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.downloadUrl).toContain("https://example.com/download");
    expect(body.data.downloadCount).toBe(3);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("returns 404 when file missing", async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const { handler } = await import("../../src/lambda/files/get-file");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(404);
  });

  it("returns 403 when user does not own file", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          userId: "other-user",
          sortKey: "2025#file-123",
          fileId: "file-123",
        },
      ],
    });
    const { handler } = await import("../../src/lambda/files/get-file");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(403);
  });

  it("validates presence of fileId", async () => {
    const { handler } = await import("../../src/lambda/files/get-file");
    const response = await handler(
      buildEvent({ pathParameters: undefined as any })
    );
    expect(response.statusCode).toBe(400);
  });

  it("returns unauthorized when claims missing", async () => {
    const { handler } = await import("../../src/lambda/files/get-file");
    const response = await handler(
      buildEvent({ requestContext: { authorizer: { claims: {} } } as any })
    );
    expect(response.statusCode).toBe(401);
  });
});
