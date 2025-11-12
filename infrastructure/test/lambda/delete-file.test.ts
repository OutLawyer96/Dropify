import type { APIGatewayProxyEvent } from "aws-lambda";
import { FILE_STATUS } from "../../src/lambda/shared/constants";

const sendMock = jest.fn();
const s3SendMock = jest.fn();
const updateUserStorageMock = jest.fn();

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
    DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

jest.mock(
  "@aws-sdk/client-s3",
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: s3SendMock })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  }),
  { virtual: true }
);

jest.mock("../../src/lambda/shared/dynamodb-helpers", () => ({
  updateUserStorage: (...args: unknown[]) => updateUserStorageMock(...args),
}));

describe("delete-file lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    s3SendMock.mockReset();
    updateUserStorageMock.mockReset();
    process.env.FILES_TABLE_NAME = "FilesTable";
    process.env.UPLOADS_BUCKET_NAME = "Uploads";
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

  it("deletes file and returns reclaimed storage", async () => {
    const now = new Date().toISOString();
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            userId: "user-123",
            sortKey: `${now}#file-123`,
            fileId: "file-123",
            fileName: "archive.zip",
            fileSize: 4096,
            s3Key: "user-123/file-123",
            status: FILE_STATUS.AVAILABLE,
          },
        ],
      })
      .mockResolvedValueOnce({});
    updateUserStorageMock.mockResolvedValueOnce(undefined);

    const { handler } = await import("../../src/lambda/files/delete-file");
    const response = await handler(buildEvent());

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.deleted).toBe(true);
    expect(body.data.fileName).toBe("archive.zip");
    expect(body.data.storageReclaimed).toBe(4096);
    expect(updateUserStorageMock).toHaveBeenCalledWith(
      "user-123",
      4096,
      "decrement"
    );
    expect(s3SendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("prevents deletion while file pending", async () => {
    sendMock.mockResolvedValueOnce({
      Items: [
        {
          userId: "user-123",
          sortKey: "pending#file-123",
          fileId: "file-123",
          status: FILE_STATUS.PENDING,
        },
      ],
    });
    const { handler } = await import("../../src/lambda/files/delete-file");
    const response = await handler(buildEvent());
    expect(response.statusCode).toBe(400);
    expect(updateUserStorageMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it("returns unauthorized when claims missing", async () => {
    const { handler } = await import("../../src/lambda/files/delete-file");
    const response = await handler(
      buildEvent({ requestContext: { authorizer: { claims: {} } } as any })
    );
    expect(response.statusCode).toBe(401);
  });
});
