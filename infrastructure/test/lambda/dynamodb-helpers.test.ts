import {
  FILE_STATUS,
  USER_PLANS,
  STORAGE_LIMITS,
} from "../../src/lambda/shared/constants";

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

const sendMock = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: sendMock }),
    },
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe("dynamodb helpers", () => {
  beforeEach(() => {
    sendMock.mockReset();
    jest.resetModules();
  });

  it("retrieves user storage information", async () => {
    sendMock.mockResolvedValueOnce({
      Item: {
        userId: "user-1",
        storageUsed: 1024,
        storageLimit: 2048,
        plan: USER_PLANS.PREMIUM,
      },
    });

    const { getUserStorageInfo } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    const info = await getUserStorageInfo("user-1", "UsersTable");
    expect(info).toEqual({
      userId: "user-1",
      storageUsed: 1024,
      storageLimit: 2048,
      plan: USER_PLANS.PREMIUM,
    });
  });

  it("handles missing user records", async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });
    const { getUserStorageInfo } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    const info = await getUserStorageInfo("missing", "UsersTable");
    expect(info).toBeNull();
  });

  it("updates storage usage atomically", async () => {
    sendMock.mockResolvedValueOnce({});
    const { updateUserStorage } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    await updateUserStorage("user-2", 500, "increment", "UsersTable");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          UpdateExpression: expect.stringContaining("ADD"),
          ExpressionAttributeValues: { ":delta": 500 },
        }),
      })
    );
  });

  it("decrements storage usage", async () => {
    sendMock.mockResolvedValueOnce({});
    const { updateUserStorage } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    await updateUserStorage("user-3", 256, "decrement", "UsersTable");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ExpressionAttributeValues: { ":delta": -256 },
        }),
      })
    );
  });

  it("computes quota availability", async () => {
    const { checkStorageQuota } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    const result = checkStorageQuota(1024, 4096, 1024);
    expect(result).toEqual({
      allowed: true,
      projectedUsage: 2048,
      remaining: 2048,
    });
  });

  it("detects quota exhaustion", async () => {
    const { checkStorageQuota } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    const result = checkStorageQuota(4000, 4096, 200);
    expect(result.allowed).toBe(false);
  });

  it("resolves storage limits by plan", async () => {
    const { getStorageLimitForPlan } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    expect(getStorageLimitForPlan(USER_PLANS.FREE)).toBe(
      STORAGE_LIMITS.FREE_LIMIT
    );
    expect(getStorageLimitForPlan(USER_PLANS.PREMIUM)).toBe(
      STORAGE_LIMITS.PREMIUM_LIMIT
    );
    expect(getStorageLimitForPlan(USER_PLANS.ENTERPRISE)).toBe(
      STORAGE_LIMITS.ENTERPRISE_LIMIT
    );
    expect(getStorageLimitForPlan("unknown")).toBe(STORAGE_LIMITS.FREE_LIMIT);
  });

  it("builds file records with defaults", async () => {
    const { createFileRecord, buildSortKey } = await import(
      "../../src/lambda/shared/dynamodb-helpers"
    );
    const record = createFileRecord({
      userId: "user-5",
      fileId: "upload-1",
      fileName: "doc.pdf",
      fileSize: 2048,
      mimeType: "application/pdf",
      s3Key: "user-5/upload-1/doc.pdf",
      uploadTimestamp: "2025-10-30T00:00:00.000Z",
    });
    expect(record.status).toBe(FILE_STATUS.AVAILABLE);
    expect(record.downloadCount).toBe(0);
    expect(record.sortKey).toBe(
      buildSortKey("2025-10-30T00:00:00.000Z", "upload-1")
    );
  });
});
