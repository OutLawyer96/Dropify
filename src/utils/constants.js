// Application Constants for Dropify

// File Upload Configuration
export const FILE_UPLOAD = {
  // Maximum file size in bytes (100MB)
  MAX_FILE_SIZE: 100 * 1024 * 1024,

  // Maximum total upload size in bytes (500MB)
  MAX_TOTAL_SIZE: 500 * 1024 * 1024,

  // Maximum number of files in a single upload
  MAX_FILES_COUNT: 10,

  // Chunk size for large file uploads (5MB)
  CHUNK_SIZE: 5 * 1024 * 1024,

  // Supported file types (will be expanded)
  SUPPORTED_TYPES: [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",

    // Documents
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

    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/gzip",

    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",

    // Video
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/avi",
    "video/mov",
    "video/wmv",

    // Code
    "text/javascript",
    "text/html",
    "text/css",
    "application/json",
    "application/xml",
    "text/markdown",
  ],

  // File type categories
  TYPE_CATEGORIES: {
    image: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    document: [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "txt",
      "rtf",
    ],
    archive: ["zip", "rar", "7z", "tar", "gz"],
    audio: ["mp3", "wav", "ogg", "m4a", "webm"],
    video: ["mp4", "webm", "ogg", "avi", "mov", "wmv"],
    code: ["js", "html", "css", "json", "xml", "md"],
  },
};

// API Configuration
export const API = {
  // Base URL for API requests
  BASE_URL: process.env.REACT_APP_API_URL || "http://localhost:3001/api",

  // Request timeout in milliseconds
  TIMEOUT: 30000,

  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,

  // Endpoints
  ENDPOINTS: {
    // File operations
    UPLOAD: "/files/initiate",
    FILES: "/files",
    FILE_DETAILS: "/files/:id",
    FILE_DELETE: "/files/:id",
    FILE_UPDATE: "/files/:id",

    // Sharing operations
    SHARE: "/share",
    SHARE_LIST: "/share/list/:id",
    SHARE_DELETE: "/share/:id",
    SHARE_ANALYTICS: "/share/analytics/:id",

    // User operations
    USER_PROFILE: "/user/profile",
    USER_SETTINGS: "/user/settings",
    USER_STORAGE: "/user/storage",
  },
};

// Sharing Configuration
export const SHARING = {
  // Default link expiration options (in days)
  EXPIRATION_OPTIONS: [
    { label: "Never", value: null },
    { label: "15 Minutes (Ephemeral)", value: 0.01 },
    { label: "1 Hour", value: 0.04 },
    { label: "6 Hours", value: 0.25 },
    { label: "1 Day", value: 1 },
    { label: "7 Days", value: 7 },
    { label: "30 Days", value: 30 },
    { label: "90 Days", value: 90 },
  ],

  // Download limit options
  DOWNLOAD_LIMITS: [
    { label: "Unlimited", value: null },
    { label: "1 Download (Self-Destruct)", value: 1 },
    { label: "5 Downloads", value: 5 },
    { label: "10 Downloads", value: 10 },
    { label: "25 Downloads", value: 25 },
    { label: "100 Downloads", value: 100 },
  ],

  // Share link length
  LINK_ID_LENGTH: 12,

  // Ephemeral share defaults
  EPHEMERAL: {
    DEFAULT_EXPIRY_MINUTES: 15,
    DEFAULT_DOWNLOAD_LIMIT: 1,
    SHOW_COUNTDOWN: true,
  },
};

// User Storage Limits
export const STORAGE = {
  // Free tier storage limit (5GB)
  FREE_LIMIT: 5 * 1024 * 1024 * 1024,

  // Premium tier storage limit (100GB)
  PREMIUM_LIMIT: 100 * 1024 * 1024 * 1024,

  // Warning threshold (80% of limit)
  WARNING_THRESHOLD: 0.8,

  // Critical threshold (95% of limit)
  CRITICAL_THRESHOLD: 0.95,
};

// UI Configuration
export const UI = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],

  // Toast notification duration
  TOAST_DURATION: 5000,

  // Loading states
  DEBOUNCE_DELAY: 300,

  // File list view options
  VIEW_MODES: {
    LIST: "list",
    GRID: "grid",
  },

  // Sorting options
  SORT_OPTIONS: [
    { label: "Name (A-Z)", value: "name_asc" },
    { label: "Name (Z-A)", value: "name_desc" },
    { label: "Date (Newest)", value: "date_desc" },
    { label: "Date (Oldest)", value: "date_asc" },
    { label: "Size (Largest)", value: "size_desc" },
    { label: "Size (Smallest)", value: "size_asc" },
  ],
};

// Error Messages
export const ERRORS = {
  FILE_TOO_LARGE: "File size exceeds the maximum limit",
  FILES_TOO_MANY: "Too many files selected",
  FILE_TYPE_NOT_SUPPORTED: "File type is not supported",
  UPLOAD_FAILED: "Upload failed. Please try again",
  UPLOAD_CANCELLED: "Upload cancelled by user",
  NETWORK_ERROR: "Network error. Please check your connection",
  SERVER_ERROR: "Server error. Please try again later",
  FILE_NOT_FOUND: "File not found",
  SHARE_EXPIRED: "This share link has expired",
  SHARE_LIMIT_REACHED: "Download limit reached for this file",
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  QUOTA_EXCEEDED: "You have reached your storage limit.",
};

// Success Messages
export const SUCCESS = {
  FILE_UPLOADED: "File uploaded successfully",
  FILES_UPLOADED: "Files uploaded successfully",
  FILE_DELETED: "File deleted successfully",
  LINK_COPIED: "Share link copied to clipboard",
  SETTINGS_SAVED: "Settings saved successfully",
};

// Feature Flags (for gradual rollout of features)
export const FEATURES = {
  DRAG_DROP_UPLOAD: true,
  BATCH_OPERATIONS: true,
  ADVANCED_SHARING: true, // Share functionality now available with backend endpoints
  FILE_PREVIEW: true,
  ANALYTICS: true, // Track share link analytics (views, downloads, device info)
  PASSWORD_PROTECTION: true, // Password-protected share links
  DOWNLOAD_LIMITS: true, // Enforce download limits per share
  EXPIRATION_DATES: true, // Auto-expire share links
  EPHEMERAL_SHARES: true, // Self-destruct links after first view/download
};

// Application Metadata
export const APP = {
  NAME: "Dropify",
  VERSION: "1.0.0",
  DESCRIPTION: "Secure File Sharing Platform",
  AUTHOR: "Dropify Team",
  SUPPORT_EMAIL: "support@dropify.com",
  PRIVACY_POLICY_URL: "/privacy",
  TERMS_OF_SERVICE_URL: "/terms",
};
