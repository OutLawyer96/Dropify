import axios from "axios";
import { apiConfig } from "../config/aws-config";
import { API, ERRORS } from "../utils/constants";
import { getJwtToken, refreshTokenIfNeeded } from "../utils/helpers";

const apiClient = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  headers: apiConfig.headers,
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );

const interpolateEndpoint = (template, params = {}) =>
  template.replace(/:([a-zA-Z]+)/gu, (match, key) => {
    if (!(key in params)) {
      return match;
    }
    return encodeURIComponent(params[key]);
  });

const isRetryableError = (error) => {
  if (!error || !error.response) {
    return true;
  }

  const { status } = error.response;
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
};

const mapErrorMessage = (status) => {
  switch (status) {
    case 400:
      return ERRORS.UPLOAD_FAILED;
    case 401:
      return ERRORS.UNAUTHORIZED;
    case 403:
      return ERRORS.FORBIDDEN;
    case 404:
      return ERRORS.FILE_NOT_FOUND;
    case 413:
      return ERRORS.FILE_TOO_LARGE;
    default:
      return ERRORS.SERVER_ERROR;
  }
};

const handleApiError = (error) => {
  if (!error) {
    return new Error(ERRORS.SERVER_ERROR);
  }

  if (axios.isCancel(error)) {
    return error;
  }

  if (!error.response) {
    return new Error(ERRORS.NETWORK_ERROR);
  }

  const { status, data } = error.response;

  console.error("🔴 API Error Response:", {
    status,
    data,
    dataString: JSON.stringify(data, null, 2),
    fullError: error,
  });

  // Try to parse backend error envelope: { success: false, error: { code, message } }
  const apiError = data?.error;
  if (apiError?.message) {
    // Map known error codes to frontend constants
    if (apiError.code === "QUOTA_EXCEEDED") {
      return new Error(ERRORS.QUOTA_EXCEEDED);
    }
    if (apiError.code === "UNAUTHORIZED") {
      return new Error(ERRORS.UNAUTHORIZED);
    }
    if (apiError.code === "FORBIDDEN") {
      return new Error(ERRORS.FORBIDDEN);
    }
    return new Error(apiError.message);
  }

  // Fallback to status-based mapping
  const fallbackMessage = mapErrorMessage(status);
  const message = data?.message || fallbackMessage;
  return new Error(message);
};

const executeWithRetry = async (operation, attempt = 1) => {
  try {
    return await operation();
  } catch (error) {
    if (isRetryableError(error) && attempt < API.RETRY_ATTEMPTS) {
      await delay(API.RETRY_DELAY * attempt);
      return executeWithRetry(operation, attempt + 1);
    }

    throw handleApiError(error);
  }
};

apiClient.interceptors.request.use(async (config) => {
  const token = await getJwtToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      originalRequest &&
      !originalRequest.__isRetryRequest &&
      status === 401
    ) {
      try {
        const refreshed = await refreshTokenIfNeeded();
        if (!refreshed) {
          throw error;
        }
        originalRequest.__isRetryRequest = true;
        const newToken = await getJwtToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

const apiService = {
  upload: {
    single: async (file, onProgress, options = {}) => {
      const makeRequest = async () => {
        const payload = {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        };

        const response = await apiClient.post(API.ENDPOINTS.UPLOAD, payload);
        const data = response.data?.data || response.data;

        const { uploadUrl, key, uploadId } = data;
        if (!uploadUrl) {
          throw new Error(ERRORS.UPLOAD_FAILED);
        }

        await axios.put(uploadUrl, file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          onUploadProgress: (event) => {
            if (!onProgress || !event.total) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          },
          signal: options.signal,
        });

        return {
          uploadUrl,
          key,
          uploadId,
          fileId: data.fileId || data.id || key,
          status: "uploaded",
        };
      };

      return executeWithRetry(makeRequest);
    },

    multiple: async (files, onProgress, options = {}) => {
      const results = [];
      for (const file of files) {
        const result = await apiService.upload.single(
          file,
          (percent) => onProgress?.(file, percent),
          options
        );
        results.push(result);
      }
      return results;
    },
  },

  files: {
    list: async ({ limit, lastKey, sortBy, filterBy, searchTerm } = {}) => {
      const params = sanitizeParams({
        limit,
        lastKey,
        sortBy,
        filterBy,
        search: searchTerm,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.get(API.ENDPOINTS.FILES, { params });
        return response.data?.data || response.data;
      });
    },

    get: async (fileId) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.FILE_DETAILS, {
        id: fileId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.get(endpoint);
        return response.data?.data || response.data;
      });
    },

    delete: async (fileId) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.FILE_DELETE, {
        id: fileId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.delete(endpoint);
        return response.data?.data || response.data;
      });
    },

    update: async (fileId, metadata) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.FILE_UPDATE, {
        id: fileId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.put(endpoint, metadata);
        return response.data?.data || response.data;
      });
    },
  },

  sharing: {
    generateLink: async (fileId, options = {}) => {
      return executeWithRetry(async () => {
        console.log(
          "🟡 API Service - Received fileId:",
          fileId,
          "options:",
          options
        );
        const payload = {
          fileId,
          expiresInDays: options.expiresInDays ?? null,
          downloadLimit: options.maxDownloads ?? null, // Backend expects 'downloadLimit'
          password: options.password ?? null,
          isEphemeral: options.isEphemeral ?? false,
        };
        console.log(
          "🔵 API Service - Sending payload:",
          JSON.stringify(payload, null, 2)
        );
        const response = await apiClient.post(API.ENDPOINTS.SHARE, payload);
        console.log("✅ API Service - Response:", response);
        return response.data?.data || response.data;
      });
    },

    listLinks: async (fileId) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.SHARE_LIST, {
        id: fileId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.get(endpoint);
        return response.data?.data?.shares || response.data?.shares || [];
      });
    },

    getAnalytics: async (shareId) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.SHARE_ANALYTICS, {
        id: shareId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.get(endpoint);
        return response.data?.data || response.data;
      });
    },

    deleteLink: async (shareId) => {
      const endpoint = interpolateEndpoint(API.ENDPOINTS.SHARE_DELETE, {
        id: shareId,
      });
      return executeWithRetry(async () => {
        const response = await apiClient.delete(endpoint);
        return response.data?.data || response.data;
      });
    },
  },

  user: {
    getProfile: async () => {
      return executeWithRetry(async () => {
        const response = await apiClient.get(API.ENDPOINTS.USER_PROFILE);
        return response.data?.data || response.data;
      });
    },

    updateSettings: async (settings) => {
      return executeWithRetry(async () => {
        const response = await apiClient.put(
          API.ENDPOINTS.USER_SETTINGS,
          settings
        );
        return response.data?.data || response.data;
      });
    },
  },
};

export const useApiService = () => {
  return apiService;
};

export { apiClient };

export default apiService;
