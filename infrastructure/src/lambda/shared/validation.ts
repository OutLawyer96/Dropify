/**
 * Shared validation helpers for upload-related Lambdas.
 */
import { z } from "zod";
import {
  EXTENSION_TO_MIME,
  FILE_LIMITS,
  SUPPORTED_MIME_TYPES,
} from "./constants";

/** Structured result describing validation outcomes. */
export interface ValidationResult<T = Record<string, unknown>> {
  success: boolean;
  message?: string;
  details?: T;
}

/** Additional detail surfaced when a validation fails. */
export interface ConstraintDetail extends Record<string, unknown> {
  readonly received: number | string;
  readonly limit?: number;
  readonly allowed?: readonly string[];
}

/** Maximum filename length allowed by S3 / most filesystems. */
const MAX_FILENAME_LENGTH = 255;

const fileSizeSchema = z
  .number({ invalid_type_error: "File size must be numeric" })
  .nonnegative({ message: "File size cannot be negative" });

const contentTypeSchema = z
  .string({ invalid_type_error: "contentType must be provided" })
  .min(1, { message: "contentType must be provided" });

const filenameSchema = z
  .string({ invalid_type_error: "filename must be a string" })
  .min(1, { message: "filename is required" })
  .max(MAX_FILENAME_LENGTH, {
    message: `filename must be <= ${MAX_FILENAME_LENGTH} characters`,
  });

/**
 * Validates a file size against the configured limit.
 */
export const validateFileSize = (
  sizeInput: unknown,
  maxAllowed: number = FILE_LIMITS.MAX_FILE_SIZE
): ValidationResult<ConstraintDetail> => {
  const parsed = fileSizeSchema.safeParse(sizeInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message || "Invalid file size",
      details: { received: Number(sizeInput) },
    };
  }

  const size = parsed.data;
  if (size === 0) {
    return {
      success: false,
      message: "File size cannot be zero bytes",
      details: { received: size },
    };
  }

  if (size > maxAllowed) {
    return {
      success: false,
      message: "File exceeds the maximum allowed size",
      details: { received: size, limit: maxAllowed },
    };
  }

  return { success: true };
};

const hasWildcardMatch = (pattern: string, value: string): boolean => {
  if (!pattern.includes("*")) return false;
  const [typePrefix] = pattern.split("/");
  const [valuePrefix] = value.split("/");
  if (!typePrefix || !valuePrefix) {
    return false;
  }
  return typePrefix === valuePrefix;
};

/**
 * Validates whether the MIME type is supported, considering wildcard patterns (e.g., image/*).
 */
export const validateFileType = (
  contentTypeInput: unknown,
  allowedTypes: readonly string[] = SUPPORTED_MIME_TYPES
): ValidationResult<ConstraintDetail> => {
  const parsed = contentTypeSchema.safeParse(contentTypeInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message || "Invalid content type",
      details: { received: String(contentTypeInput), allowed: allowedTypes },
    };
  }

  const contentType = parsed.data.toLowerCase();

  if (allowedTypes.some((type) => type.toLowerCase() === contentType)) {
    return { success: true };
  }

  if (
    allowedTypes.some((type) =>
      hasWildcardMatch(type.toLowerCase(), contentType)
    )
  ) {
    return { success: true };
  }

  return {
    success: false,
    message: "File type is not supported",
    details: { received: contentType, allowed: allowedTypes },
  };
};

const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9._\-\s]/g;

/**
 * Ensures filenames contain only safe characters and meet length constraints.
 */
export const validateFileName = (
  filenameInput: unknown
): ValidationResult<ConstraintDetail> => {
  const parsed = filenameSchema.safeParse(filenameInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message || "Invalid filename",
      details: { received: String(filenameInput) },
    };
  }

  const filename = parsed.data;
  if (filename.trim().length === 0) {
    return {
      success: false,
      message: "filename cannot be blank",
      details: { received: filename },
    };
  }

  const sanitized = sanitizeFileName(filename);
  if (sanitized.length === 0) {
    return {
      success: false,
      message: "filename contains no valid characters",
      details: { received: filename },
    };
  }

  return { success: true };
};

/**
 * Produces an S3-safe filename by stripping path components and invalid characters.
 */
export const sanitizeFileName = (filename: string): string => {
  const baseName = filename.split(/[/\\]+/).pop() || filename;
  const trimmed = baseName.trim();
  const normalized = trimmed.normalize("NFKC");
  const cleaned = normalized.replace(FILENAME_SANITIZE_REGEX, "_");
  const condensed = cleaned.replace(/\s+/g, " ");
  return condensed.slice(0, MAX_FILENAME_LENGTH) || "file";
};

/**
 * Returns the lowercase extension (without dot) for the supplied filename.
 */
export const extractFileExtension = (filename: string): string => {
  const sanitized = sanitizeFileName(filename);
  const lastDot = sanitized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === sanitized.length - 1) {
    return "";
  }
  return sanitized.slice(lastDot + 1).toLowerCase();
};

/**
 * Attempts to infer a MIME type using the file extension mapping.
 */
export const getFileMimeType = (filename: string): string | undefined => {
  const ext = extractFileExtension(filename);
  if (!ext) return undefined;
  return EXTENSION_TO_MIME[ext];
};
