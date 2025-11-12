/**
 * Helpers for producing consistent API Gateway responses and logging.
 */
import { APIGatewayProxyResult } from "aws-lambda";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Credentials": "true",
  "Content-Type": "application/json",
};

export interface ErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface SuccessPayload<T> {
  readonly data: T;
}

/** Formats an error response with a consistent payload structure. */
export const createErrorResponse = (
  statusCode: number,
  detail: ErrorDetail
): APIGatewayProxyResult => ({
  statusCode,
  headers: DEFAULT_HEADERS,
  body: JSON.stringify({ success: false, error: detail }),
});

/** Formats a successful response with supplied payload. */
export const createSuccessResponse = <T>(
  statusCode: number,
  payload: SuccessPayload<T>
): APIGatewayProxyResult => ({
  statusCode,
  headers: DEFAULT_HEADERS,
  body: JSON.stringify({ success: true, ...payload }),
});

/** Emits structured error logs to CloudWatch for tracing. */
export const logError = (
  error: unknown,
  context: Record<string, unknown> = {}
): void => {
  const parsed = parseError(error);
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message: parsed.message,
      stack: parsed.stack,
      context,
    })
  );
};

/** Attempts to normalise different error shapes into a common structure. */
export const parseError = (
  error: unknown
): { message: string; stack?: string } => {
  if (!error) return { message: "Unknown error" };

  if (typeof error === "string") {
    return { message: error };
  }

  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  if (typeof error === "object") {
    const maybeMessage = (error as Record<string, unknown>).message;
    const maybeStack = (error as Record<string, unknown>).stack;
    if (typeof maybeMessage === "string") {
      return {
        message: maybeMessage,
        stack: typeof maybeStack === "string" ? maybeStack : undefined,
      };
    }

    return { message: JSON.stringify(error) };
  }

  return { message: String(error) };
};

export const badRequestError = (
  message: string,
  details?: Record<string, unknown>
): APIGatewayProxyResult =>
  createErrorResponse(400, { code: "BAD_REQUEST", message, details });

export const unauthorizedError = (
  message = "Unauthorized"
): APIGatewayProxyResult =>
  createErrorResponse(401, { code: "UNAUTHORIZED", message });

export const forbiddenError = (message = "Forbidden"): APIGatewayProxyResult =>
  createErrorResponse(403, { code: "FORBIDDEN", message });

export const notFoundError = (message = "Not Found"): APIGatewayProxyResult =>
  createErrorResponse(404, { code: "NOT_FOUND", message });

export const quotaExceededError = (
  message = "Storage quota exceeded",
  details?: Record<string, unknown>
): APIGatewayProxyResult =>
  createErrorResponse(413, { code: "QUOTA_EXCEEDED", message, details });

export const unsupportedMediaTypeError = (
  message = "Unsupported media type",
  details?: Record<string, unknown>
): APIGatewayProxyResult =>
  createErrorResponse(415, {
    code: "UNSUPPORTED_MEDIA_TYPE",
    message,
    details,
  });

export const internalServerError = (
  message = "Internal server error"
): APIGatewayProxyResult =>
  createErrorResponse(500, { code: "INTERNAL_SERVER_ERROR", message });
