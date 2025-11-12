import { useCallback, useMemo, useRef, useState } from "react";
import { useApiService } from "../services/api";
import { ERRORS } from "../utils/constants";

export const useFileUpload = ({ onSuccess, onError, onProgress } = {}) => {
  const apiService = useApiService();
  const controllersRef = useRef(new Map());
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [activeUploads, setActiveUploads] = useState(0);

  const setFileError = useCallback((fileName, message) => {
    setErrors((prev) => ({ ...prev, [fileName]: message }));
  }, []);

  const clearFileError = useCallback((fileName) => {
    setErrors((prev) => {
      if (!prev[fileName]) return prev;
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }, []);

  const updateProgress = useCallback(
    (file, value) => {
      setProgress((prev) => ({ ...prev, [file.name]: value }));
      onProgress?.(file, value);
    },
    [onProgress]
  );

  const startUpload = useCallback(() => {
    setActiveUploads((count) => count + 1);
  }, []);

  const finishUpload = useCallback(() => {
    setActiveUploads((count) => Math.max(count - 1, 0));
  }, []);

  const uploadSingleInternal = useCallback(
    async (file) => {
      startUpload();
      clearFileError(file.name);
      updateProgress(file, 0);

      const controller = new AbortController();
      controllersRef.current.set(file.name, controller);

      try {
        const response = await apiService.upload.single(
          file,
          (percent) => updateProgress(file, percent),
          { signal: controller.signal }
        );

        updateProgress(file, 100);
        controllersRef.current.delete(file.name);
        onSuccess?.(file, response);
        return response;
      } catch (error) {
        const isAbortError =
          error?.name === "AbortError" ||
          error?.code === "ERR_CANCELED" ||
          error?.message === "canceled";
        const message = isAbortError
          ? ERRORS.UPLOAD_CANCELLED
          : error?.message || ERRORS.UPLOAD_FAILED;
        setFileError(file.name, message);
        controllersRef.current.delete(file.name);
        onError?.(file, error);
        throw error;
      } finally {
        finishUpload();
      }
    },
    [
      apiService,
      clearFileError,
      finishUpload,
      onError,
      onSuccess,
      setFileError,
      startUpload,
      updateProgress,
    ]
  );

  const uploadFile = useCallback(
    async (file) => {
      if (!file) return null;
      return uploadSingleInternal(file);
    },
    [uploadSingleInternal]
  );

  const uploadMultiple = useCallback(
    async (files = []) => {
      const results = [];
      let lastError = null;

      for (const file of files) {
        try {
          const result = await uploadSingleInternal(file);
          results.push(result);
        } catch (error) {
          lastError = error;
        }
      }

      if (lastError) {
        throw lastError;
      }

      return results;
    },
    [uploadSingleInternal]
  );

  const cancelUpload = useCallback((fileName) => {
    const controller = controllersRef.current.get(fileName);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(fileName);
      setProgress((prev) => ({ ...prev, [fileName]: 0 }));
    }
  }, []);

  const isUploading = useMemo(() => activeUploads > 0, [activeUploads]);

  return {
    uploadFile,
    uploadMultiple,
    cancelUpload,
    progress,
    errors,
    isUploading,
  };
};
