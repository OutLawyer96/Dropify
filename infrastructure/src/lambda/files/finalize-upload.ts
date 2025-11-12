import { Context, S3Event } from "aws-lambda";
import {
  FILE_LIMITS,
  FILE_STATUS,
  SUPPORTED_MIME_TYPES,
} from "../shared/constants";
import { validateFileSize, validateFileType } from "../shared/validation";
import {
  buildFileMetadata,
  extractMetadataFromS3Object,
  generateFileChecksum,
  parseS3Key,
  inferContentTypeFromExtension,
  normalizeObjectMetadata,
} from "../shared/metadata-processor";
import {
  createFileRecord,
  getUserStorageInfo,
  updateUserStorage,
} from "../shared/dynamodb-helpers";
import { logError } from "../shared/error-handler";

const MAX_DDB_RETRIES = 3;

const isRetryable = (error: Error & { name?: string; $metadata?: { httpStatusCode?: number } }): boolean => {
  if (!error) return false;
  const retryableNames = [
    "ProvisionedThroughputExceededException",
    "ThrottlingException",
    "RequestLimitExceeded",
  ];
  if (error.name && retryableNames.includes(error.name)) return true;
  const status = error.$metadata?.httpStatusCode;
  return status ? status >= 500 : false;
};

const backoff = (attempt: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedDocClient: any;

const getDocClient = () => {
  if (cachedDocClient) return cachedDocClient;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  const ddb = new DynamoDBClient({});
  cachedDocClient = DynamoDBDocumentClient.from(ddb);
  return cachedDocClient;
};

export const handler = async (event: S3Event, _ctx: Context) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PutCommand } = require("@aws-sdk/lib-dynamodb");

  const s3 = new S3Client({});
  const docClient = getDocClient();

  const filesTable = process.env.FILES_TABLE_NAME;
  const usersTable = process.env.USERS_TABLE_NAME;
  if (!filesTable || !usersTable) {
    console.warn("FILES_TABLE_NAME or USERS_TABLE_NAME not configured");
    return;
  }

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key })
      );
      const parsedKey = parseS3Key(key);
      if (!parsedKey.uploadId) {
        console.warn(`Skipping object without uploadId segment: ${key}`);
        continue;
      }

      const extracted = extractMetadataFromS3Object(head);
      const normalizedMetadata = normalizeObjectMetadata(extracted.metadata);
      let mimeType = extracted.contentType;
      if (!mimeType || mimeType === "application/octet-stream") {
        mimeType =
          inferContentTypeFromExtension(parsedKey.filename) || mimeType;
      }
      const fileName =
        parsedKey.filename ||
        normalizedMetadata["originalFilename"] ||
        extracted.metadata["originalfilename"] ||
        key.split("/").pop() ||
        parsedKey.uploadId;
      const uploadTimestamp =
        extracted.lastModified || new Date().toISOString();
      const baseMetadataRecord: Record<string, string> = {
        ...normalizedMetadata,
        originalFilename: normalizedMetadata["originalFilename"] ?? fileName,
        uploaderId: normalizedMetadata["uploaderId"] ?? parsedKey.userId,
        uploadedAt: normalizedMetadata["uploadedAt"] ?? uploadTimestamp,
        fileSize:
          normalizedMetadata["fileSize"] ??
          String(extracted.contentLength ?? 0),
        contentType: normalizedMetadata["contentType"] ?? mimeType,
      };
      const sizeValidation = validateFileSize(
        extracted.contentLength,
        FILE_LIMITS.MAX_FILE_SIZE
      );
      if (!sizeValidation.success) {
        const errorRecord = createFileRecord(
          buildFileMetadata({
            userId: parsedKey.userId,
            fileId: parsedKey.uploadId,
            fileName,
            fileSize: extracted.contentLength,
            mimeType,
            s3Key: key,
            uploadTimestamp,
            metadata: {
              ...baseMetadataRecord,
              validationError:
                sizeValidation.message || "File exceeds size limit",
            },
            checksum: generateFileChecksum(extracted.eTag),
            status: FILE_STATUS.ERROR,
          })
        );
        await docClient.send(
          new PutCommand({
            TableName: filesTable,
            Item: errorRecord,
            ConditionExpression:
              "attribute_not_exists(userId) AND attribute_not_exists(sortKey)",
          })
        );
        continue;
      }

      const typeValidation = validateFileType(
        extracted.contentType,
        SUPPORTED_MIME_TYPES
      );
      if (!typeValidation.success) {
        const errorRecord = createFileRecord(
          buildFileMetadata({
            userId: parsedKey.userId,
            fileId: parsedKey.uploadId,
            fileName,
            fileSize: extracted.contentLength,
            mimeType,
            s3Key: key,
            uploadTimestamp,
            metadata: {
              ...baseMetadataRecord,
              validationError:
                typeValidation.message || "Unsupported file type",
            },
            checksum: generateFileChecksum(extracted.eTag),
            status: FILE_STATUS.ERROR,
          })
        );
        await docClient.send(
          new PutCommand({
            TableName: filesTable,
            Item: errorRecord,
            ConditionExpression:
              "attribute_not_exists(userId) AND attribute_not_exists(sortKey)",
          })
        );
        continue;
      }

      const baseMetadata = buildFileMetadata({
        userId: parsedKey.userId,
        fileId: parsedKey.uploadId,
        fileName,
        fileSize: extracted.contentLength,
        mimeType,
        s3Key: key,
        uploadTimestamp,
        metadata: baseMetadataRecord,
        checksum: generateFileChecksum(extracted.eTag),
        status: FILE_STATUS.AVAILABLE,
      });

      const fileRecord = createFileRecord(baseMetadata);

      for (let attempt = 0; attempt < MAX_DDB_RETRIES; attempt += 1) {
        try {
          await docClient.send(
            new PutCommand({
              TableName: filesTable,
              Item: fileRecord,
              ConditionExpression:
                "attribute_not_exists(userId) AND attribute_not_exists(sortKey)",
            })
          );
          break;
        } catch (err) {
          if (attempt === MAX_DDB_RETRIES - 1 || !isRetryable(err)) {
            throw err;
          }
          await backoff(attempt);
        }
      }

      try {
        await updateUserStorage(
          parsedKey.userId,
          extracted.contentLength,
          "increment",
          usersTable
        );
      } catch (err) {
        logError(err, {
          phase: "updateUserStorage",
          userId: parsedKey.userId,
          fileId: parsedKey.uploadId,
        });
      }
    } catch (error) {
      logError(error, { phase: "finalize-upload", bucket, key });
      try {
        const userId = parseS3Key(key).userId;
        const storageInfo = await getUserStorageInfo(userId, usersTable);
        if (!storageInfo) {
          console.warn(`No storage record found for user ${userId}`);
        }
      } catch (infoError) {
        logError(infoError, { phase: "load-storage-info", key });
      }
      continue;
    }
  }
};
