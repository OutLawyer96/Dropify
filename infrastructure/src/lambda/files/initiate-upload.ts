import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import {
  FILE_LIMITS,
  PRESIGNED_URL_EXPIRY,
  SUPPORTED_MIME_TYPES,
} from "../shared/constants";
import {
  badRequestError,
  createSuccessResponse,
  internalServerError,
  logError,
  quotaExceededError,
  unauthorizedError,
  unsupportedMediaTypeError,
} from "../shared/error-handler";
import {
  checkStorageQuota,
  getStorageLimitForPlan,
  getUserStorageInfo,
} from "../shared/dynamodb-helpers";
import {
  sanitizeFileName,
  validateFileName,
  validateFileSize,
  validateFileType,
} from "../shared/validation";
import { DEFAULT_PLAN, USER_PLANS } from "../shared/constants";

// Use lazy requires to avoid synth-time issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { v4: uuidv4 } = require("uuid");

const requestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
});

const resolveUserContext = (event: APIGatewayProxyEvent) => {
  const claims = event.requestContext?.authorizer?.claims || {};
  const planClaim = (claims["custom:plan"] as string) || DEFAULT_PLAN;
  const plan = Object.values(USER_PLANS).includes(planClaim as USER_PLANS)
    ? (planClaim as USER_PLANS)
    : DEFAULT_PLAN;
  return {
    userId: claims.sub as string,
    plan,
  };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authContext = resolveUserContext(event);
    if (!authContext.userId) {
      return unauthorizedError();
    }

    const parsedBody = (() => {
      try {
        const json = event.body ? JSON.parse(event.body) : {};
        return requestSchema.parse(json);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw badRequestError("Invalid request body", { reason });
      }
    })();

    const { filename, contentType, size } = parsedBody;

    const sizeValidation = validateFileSize(size, FILE_LIMITS.MAX_FILE_SIZE);
    if (!sizeValidation.success) {
      return badRequestError(
        sizeValidation.message || "Invalid file size",
        sizeValidation.details
      );
    }

    const typeValidation = validateFileType(contentType, SUPPORTED_MIME_TYPES);
    if (!typeValidation.success) {
      return unsupportedMediaTypeError(
        typeValidation.message || "Unsupported content type",
        typeValidation.details
      );
    }

    const nameValidation = validateFileName(filename);
    if (!nameValidation.success) {
      return badRequestError(
        nameValidation.message || "Invalid filename",
        nameValidation.details
      );
    }

    const sanitizedFilename = sanitizeFileName(filename);

    let userStorage = null;
    try {
      userStorage = await getUserStorageInfo(authContext.userId);
    } catch (error) {
      logError(error, {
        userId: authContext.userId,
        phase: "getUserStorageInfo",
      });
      return internalServerError("Failed to load user storage details");
    }

    const storageUsed = userStorage?.storageUsed ?? 0;
    const plan = (userStorage?.plan as USER_PLANS) || authContext.plan;
    const storageLimit =
      userStorage?.storageLimit ?? getStorageLimitForPlan(plan);

    const quotaCheck = checkStorageQuota(storageUsed, storageLimit, size);
    if (!quotaCheck.allowed) {
      return quotaExceededError("Insufficient storage quota", {
        storageUsed,
        storageLimit,
        fileSize: size,
        remaining: quotaCheck.remaining,
      });
    }

    const uploadId = uuidv4();
    const key = `${authContext.userId}/${uploadId}/${sanitizedFilename}`;

    // Create presigned URL
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

    const bucket = process.env.UPLOADS_BUCKET_NAME;
    if (!bucket) {
      return internalServerError("Uploads bucket not configured");
    }

    const s3 = new S3Client({});
    const timestamp = new Date().toISOString();
    const putCmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        "original-filename": sanitizedFilename,
        "uploader-id": authContext.userId,
        "file-size": String(size),
        "uploaded-at": timestamp,
        plan,
      },
    });
    const uploadUrl = await getSignedUrl(s3, putCmd, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    console.info(
      JSON.stringify({
        level: "info",
        message: "Generated presigned URL",
        userId: authContext.userId,
        uploadId,
        filename: sanitizedFilename,
        size,
      })
    );

    return createSuccessResponse(200, {
      data: {
        uploadId,
        key,
        uploadUrl,
        expiresIn: PRESIGNED_URL_EXPIRY,
        maxFileSize: FILE_LIMITS.MAX_FILE_SIZE,
        remainingQuota: quotaCheck.remaining,
      },
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) {
      return err as APIGatewayProxyResult;
    }
    logError(err, { phase: "initiate-upload" });
    return internalServerError();
  }
};
