import { FILE_LIMITS, FILE_STATUS } from "../../src/lambda/shared/constants";

const s3SendMock = jest.fn();
const docSendMock = jest.fn();

jest.mock(
  "@aws-sdk/client-s3",
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: s3SendMock })),
    HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  }),
  { virtual: true }
);

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb");
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: docSendMock }),
    },
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

const updateUserStorageMock = jest.fn();
const getUserStorageInfoMock = jest.fn();

jest.mock("../../src/lambda/shared/dynamodb-helpers", () => {
  const helpers = jest.requireActual(
    "../../src/lambda/shared/dynamodb-helpers"
  );
  return {
    ...helpers,
    updateUserStorage: (...args: unknown[]) => updateUserStorageMock(...args),
    getUserStorageInfo: (...args: unknown[]) => getUserStorageInfoMock(...args),
  };
});

describe("finalize-upload lambda", () => {
  beforeEach(() => {
    jest.resetModules();
    s3SendMock.mockReset();
    docSendMock.mockReset();
    updateUserStorageMock.mockReset();
    getUserStorageInfoMock.mockReset();
    process.env.FILES_TABLE_NAME = "FilesTable";
    process.env.USERS_TABLE_NAME = "UsersTable";
  });

  const baseEvent = {
    Records: [
      {
        s3: {
          bucket: { name: "uploads" },
          object: {
            key: encodeURIComponent("user-1/upload-1/report.pdf"),
            eTag: "etag",
          },
        },
      },
    ],
  } as any;

  it("creates file record and increments storage", async () => {
    s3SendMock.mockResolvedValueOnce({
      ContentType: "application/pdf",
      ContentLength: 2048,
      ETag: '"abc"',
      LastModified: new Date("2025-10-30T00:00:00.000Z"),
      Metadata: { "original-filename": "report.pdf" },
    });
    docSendMock.mockResolvedValue({});
    updateUserStorageMock.mockResolvedValue(undefined);

    const { handler } = await import("../../src/lambda/files/finalize-upload");
    await handler(baseEvent, {} as any);

    expect(docSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ TableName: "FilesTable" }),
      })
    );
    expect(updateUserStorageMock).toHaveBeenCalledWith(
      "user-1",
      2048,
      "increment",
      "UsersTable"
    );
  });

  it("marks oversized files as error without updating storage", async () => {
    s3SendMock.mockResolvedValueOnce({
      ContentType: "application/pdf",
      ContentLength: FILE_LIMITS.MAX_FILE_SIZE + 1,
      ETag: '"oversized"',
      Metadata: { "original-filename": "huge.bin" },
    });
    docSendMock.mockResolvedValue({});

    const { handler } = await import("../../src/lambda/files/finalize-upload");
    await handler(baseEvent, {} as any);

    expect(docSendMock).toHaveBeenCalled();
    const putCommandCall = docSendMock.mock.calls[0][0];
    expect(putCommandCall.input.Item.status).toBe(FILE_STATUS.ERROR);
    expect(updateUserStorageMock).not.toHaveBeenCalled();
  });
});
