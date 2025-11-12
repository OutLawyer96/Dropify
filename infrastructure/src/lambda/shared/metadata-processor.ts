/**
 * Helpers for extracting and shaping file metadata from S3 objects.
 */
import { FILE_STATUS } from "./constants";
import { getFileMimeType, sanitizeFileName } from "./validation";
import type { CreateFileRecordInput } from "./dynamodb-helpers";

interface HeadObjectLike {
  ContentType?: string;
  ContentLength?: number;
  ETag?: string;
  LastModified?: Date;
  Metadata?: Record<string, string>;
}

export interface ParsedS3Key {
  userId: string;
  uploadId: string;
  filename: string;
}

export interface ExtractedMetadata {
  contentType: string;
  contentLength: number;
  eTag?: string;
  lastModified?: string;
  metadata: Record<string, string>;
}

/**
 * Normalises arbitrary metadata by trimming and bounding values.
 */
export const sanitizeMetadata = (
  metadata: Record<string, string> | undefined
): Record<string, string> => {
  if (!metadata) return {};
  const entries = Object.entries(metadata).map(([key, value]) => [
    key.trim().toLowerCase(),
    String(value).slice(0, 1024),
  ]);
  return Object.fromEntries(entries);
};

const METADATA_KEY_MAP: Record<string, string> = {
  "original-filename": "originalFilename",
  originalfilename: "originalFilename",
  "uploader-id": "uploaderId",
  uploader: "uploaderId",
  "file-size": "fileSize",
  filesize: "fileSize",
  "uploaded-at": "uploadedAt",
  uploadedat: "uploadedAt",
  plan: "plan",
  "content-type": "contentType",
};

/**
 * Normalises sanitized metadata keys to camelCase names used in persisted records.
 */
export const normalizeObjectMetadata = (
  metadata: Record<string, string>
): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.entries(metadata).forEach(([rawKey, rawValue]) => {
    if (rawValue === undefined || rawValue === null) {
      return;
    }
    const trimmedValue = String(rawValue).trim();
    if (!trimmedValue) {
      return;
    }

    const normalisedKey = METADATA_KEY_MAP[rawKey] ?? rawKey;
    result[normalisedKey] = trimmedValue;
  });

  return result;
};

/**
 * Extracts metadata fields from the S3 HeadObject response.
 */
export const extractMetadataFromS3Object = (
  head: HeadObjectLike
): ExtractedMetadata => {
  const metadata = sanitizeMetadata(head.Metadata as Record<string, string>);
  const contentType =
    head.ContentType || metadata["content-type"] || "application/octet-stream";
  const contentLength =
    head.ContentLength ?? Number(metadata["content-length"] || 0);
  const lastModified = head.LastModified
    ? new Date(head.LastModified).toISOString()
    : metadata["uploaded-at"];

  return {
    contentType,
    contentLength,
    eTag: head.ETag || metadata["etag"],
    lastModified,
    metadata,
  };
};

/**
 * S3 provides MD5 checksums for single-part uploads via the ETag header.
 */
export const generateFileChecksum = (etag?: string): string | undefined => {
  if (!etag) return undefined;
  return etag.replace(/"/g, "").trim().toLowerCase();
};

/**
 * Attempts to derive a MIME type from the filename extension.
 */
export const inferContentTypeFromExtension = (
  filename: string
): string | undefined => getFileMimeType(filename);

/**
 * Parses the canonical object key format userId/uploadId/filename.
 */
export const parseS3Key = (key: string): ParsedS3Key => {
  const [userId = "unknown", uploadId = "", ...rest] = key.split("/");
  const filename = sanitizeFileName(rest.join("/"));
  return { userId, uploadId, filename };
};

/**
 * Builds the payload consumed by DynamoDB helper when creating file records.
 */
export const buildFileMetadata = (
  params: Omit<CreateFileRecordInput, "downloadCount"> & {
    downloadCount?: number;
    status?: FILE_STATUS;
  }
): CreateFileRecordInput => ({
  ...params,
  downloadCount: params.downloadCount ?? 0,
  status: params.status ?? FILE_STATUS.AVAILABLE,
});
