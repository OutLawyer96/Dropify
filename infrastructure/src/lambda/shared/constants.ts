/**
 * Shared backend constants to align with frontend configuration.
 * These constants should remain in sync with values declared in src/utils/constants.js.
 */
export const FILE_LIMITS = Object.freeze({
  /** Maximum allowed size for a single file upload (100 MB). */
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  /** Maximum cumulative size per upload batch (500 MB). */
  MAX_TOTAL_SIZE: 500 * 1024 * 1024,
  /** Maximum number of files permitted in a single batch. */
  MAX_FILES_COUNT: 10,
  /** Chunk size suggested for multipart uploads (5 MB). */
  CHUNK_SIZE: 5 * 1024 * 1024,
});

export const STORAGE_LIMITS = Object.freeze({
  /** Storage allocation for free plan users (5 GB). */
  FREE_LIMIT: 5 * 1024 * 1024 * 1024,
  /** Storage allocation for premium plan users (100 GB). */
  PREMIUM_LIMIT: 100 * 1024 * 1024 * 1024,
  /** Storage allocation for enterprise plan users (1 TB). */
  ENTERPRISE_LIMIT: 1024 * 1024 * 1024 * 1024,
});

/** Enumeration of supported user subscription plans. */
export enum USER_PLANS {
  FREE = "free",
  PREMIUM = "premium",
  ENTERPRISE = "enterprise",
}

/** Default plan assigned to newly registered users. */
export const DEFAULT_PLAN = USER_PLANS.FREE;

/** Enumeration of possible file lifecycle statuses. */
export enum FILE_STATUS {
  PENDING = "pending",
  VALIDATING = "validating",
  AVAILABLE = "available",
  ARCHIVED = "archived",
  ERROR = "error",
}

/** Lifetime of generated presigned URLs in seconds (15 minutes). */
export const PRESIGNED_URL_EXPIRY = 900;

/**
 * List of MIME types accepted by the platform. Should mirror the frontend configuration.
 */
export const SUPPORTED_MIME_TYPES: readonly string[] = Object.freeze([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
  "video/wmv",
  "text/javascript",
  "text/html",
  "text/css",
  "application/json",
  "application/xml",
  "text/markdown",
]);

/** Mapping of common file extensions to MIME types for inference fallbacks. */
export const EXTENSION_TO_MIME: Readonly<Record<string, string>> =
  Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    rtf: "application/rtf",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    webm: "audio/webm",
    mp4: "video/mp4",
    avi: "video/avi",
    mov: "video/mov",
    wmv: "video/wmv",
    js: "text/javascript",
    html: "text/html",
    css: "text/css",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",
  });

/** Length of generated share link identifiers. */
export const SHARE_LINK_ID_LENGTH = 12;

/** Supported share link expiration options expressed in days. */
export const SHARE_EXPIRATION_OPTIONS = Object.freeze({
  NEVER: null as null,
  ONE_DAY: 1,
  ONE_WEEK: 7,
  ONE_MONTH: 30,
  THREE_MONTHS: 90,
});

/** Supported download limits for share links. */
export const SHARE_DOWNLOAD_LIMITS = Object.freeze({
  UNLIMITED: null as null,
  ONE: 1,
  FIVE: 5,
  TEN: 10,
  TWENTY_FIVE: 25,
  ONE_HUNDRED: 100,
});

/** Bcrypt hashing rounds used for securing share link passwords. */
export const PASSWORD_HASH_ROUNDS = 10;

/** Base API path used when constructing share link URLs. */
export const SHARE_LINK_BASE_PATH = "/share";
