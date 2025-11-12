import type { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("uuid", () => ({ v4: () => "test-upload-id" }));

const signedUrlMock = jest.fn().mockResolvedValue("https://signed-url.example");
const s3SendMock = jest.fn();

jest.mock(
  "@aws-sdk/client-s3",
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: s3SendMock })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  }),
  { virtual: true }
);

jest.mock(
  "@aws-sdk/s3-request-presigner",
  () => ({
    getSignedUrl: (...args: unknown[]) => signedUrlMock(...args),
  }),
  { virtual: true }
);

const getUserStorageInfoMock = jest.fn();
const checkStorageQuotaActual = jest.requireActual(
  "../../src/lambda/shared/dynamodb-helpers"
).checkStorageQuota;
const getStorageLimitForPlanActual = jest.requireActual(
  "../../src/lambda/shared/dynamodb-helpers"
).getStorageLimitForPlan;

jest.mock("../../src/lambda/shared/dynamodb-helpers", () => ({
  getUserStorageInfo: (...args: unknown[]) => getUserStorageInfoMock(...args),
  checkStorageQuota: (...args: Parameters<typeof checkStorageQuotaActual>) =>
    checkStorageQuotaActual(...args),
  getStorageLimitForPlan: (
    ...args: Parameters<typeof getStorageLimitForPlanActual>
  ) => getStorageLimitForPlanActual(...args),
}));

describe("initiate-upload lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    signedUrlMock.mockClear();
    s3SendMock.mockClear();
    getUserStorageInfoMock.mockReset();
    process.env.UPLOADS_BUCKET_NAME = "test-uploads";
    process.env.USERS_TABLE_NAME = "UsersTable";
  });

  const buildEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {}
  ): APIGatewayProxyEvent =>
    ({
      body: JSON.stringify({
        filename: "Report.pdf",
        contentType: "application/pdf",
        size: 1024,
      }),
      requestContext: {
        authorizer: {
          claims: {
            sub: "user-123",
            "custom:plan": "premium",
          },
        } as any,
      } as any,
      ...overrides,
    } as APIGatewayProxyEvent);

  it("returns presigned URL when validation passes", async () => {
    getUserStorageInfoMock.mockResolvedValue({
      userId: "user-123",
      storageUsed: 0,
      storageLimit: 1024 * 1024 * 1024,
      plan: "premium",
    });

    const { handler } = await import("../../src/lambda/files/initiate-upload");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.uploadId).toBe("test-upload-id");
    expect(body.data.uploadUrl).toContain("https://signed-url.example");
    expect(body.data.remainingQuota).toBeGreaterThan(0);
    expect(signedUrlMock).toHaveBeenCalledTimes(1);
  });

  it("returns quota exceeded error when storage full", async () => {
    getUserStorageInfoMock.mockResolvedValue({
      userId: "user-123",
      storageUsed: 1024 * 1024 * 100,
      storageLimit: 1024 * 1024 * 100,
      plan: "free",
    });

    const { handler } = await import("../../src/lambda/files/initiate-upload");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(413);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("rejects unsupported media types", async () => {
    getUserStorageInfoMock.mockResolvedValue(null);
    const { handler } = await import("../../src/lambda/files/initiate-upload");
    const response = await handler(
      buildEvent({
        body: JSON.stringify({
          filename: "payload.exe",
          contentType: "application/x-msdownload",
          size: 1024,
        }),
      })
    );
    expect(response.statusCode).toBe(415);
  });

  it("returns unauthorized when claims missing", async () => {
    const { handler } = await import("../../src/lambda/files/initiate-upload");
    const response = await handler(
      buildEvent({
        requestContext: { authorizer: { claims: {} } } as any,
      })
    );
    expect(response.statusCode).toBe(401);
  });

  it("handles storage lookup failures gracefully", async () => {
    getUserStorageInfoMock.mockRejectedValue(new Error("DDB unavailable"));
    const { handler } = await import("../../src/lambda/files/initiate-upload");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
