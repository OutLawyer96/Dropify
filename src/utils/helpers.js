// Helper utility functions for Dropify

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format date in a user-friendly format
 * @param {string|Date} date - Date to format
 * @param {string} format - Format type ('relative', 'short', 'long')
 * @returns {string} Formatted date
 */
export const formatDate = (date, format = 'relative') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'relative') {
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }
  
  if (format === 'short') {
    return dateObj.toLocaleDateString();
  }
  
  if (format === 'long') {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return dateObj.toLocaleDateString();
};

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} File extension in lowercase
 */
export const getFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

/**
 * Get file type category based on extension
 * @param {string} filename - Name of the file
 * @returns {string} File category ('image', 'document', 'archive', etc.)
 */
export const getFileCategory = (filename) => {
  const extension = getFileExtension(filename);
  
  const categories = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'flac', 'aac'],
    video: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'],
    code: ['js', 'html', 'css', 'json', 'xml', 'md', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'],
    text: ['txt', 'md', 'csv', 'log', 'yml', 'yaml', 'ini', 'cfg']
  };
  
  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }
  
  return 'other';
};

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string
 * @param {string} chars - Characters to use
 * @returns {string} Random string
 */
export const generateRandomString = (length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validate file type against allowed types
 * @param {File} file - File object to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {boolean} Whether file type is valid
 */
export const validateFileType = (file, allowedTypes = []) => {
  if (!file || !file.type) return false;
  if (allowedTypes.length === 0) return true;
  
  return allowedTypes.includes(file.type) || allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const category = type.split('/')[0];
      return file.type.startsWith(category + '/');
    }
    return false;
  });
};

/**
 * Validate file size against maximum allowed size
 * @param {File} file - File object to validate
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} Whether file size is valid
 */
export const validateFileSize = (file, maxSize) => {
  if (!file || typeof file.size !== 'number') return false;
  return file.size <= maxSize;
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      textArea.remove();
      return success;
    }
  } catch (error) {
    console.error('Failed to copy text to clipboard:', error);
    return false;
  }
};

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Whether to execute immediately
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait, immediate = false) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Calculate storage usage percentage
 * @param {number} used - Used storage in bytes
 * @param {number} total - Total storage in bytes
 * @returns {number} Usage percentage (0-100)
 */
export const calculateStoragePercentage = (used, total) => {
  if (!total || total === 0) return 0;
  return Math.min(Math.round((used / total) * 100), 100);
};

/**
 * Format duration in human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
};

/**
 * Check if a URL is valid
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Sanitize filename for safe usage
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return 'unnamed';
  
  // Remove or replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255) || 'unnamed';
};

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
};

/**
 * Parse error message from API response
 * @param {Error|Object} error - Error object
 * @returns {string} User-friendly error message
 */
export const parseErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.response && error.response.data) {
    if (error.response.data.message) return error.response.data.message;
    if (error.response.data.error) return error.response.data.error;
  }
  
  return 'An unexpected error occurred';
};