import React, { useCallback, useMemo, useState } from "react";
import FileDropZone from "../components/Upload/FileDropZone";
import UploadProgress from "../components/Upload/UploadProgress";
import ErrorMessage from "../components/Common/ErrorMessage";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { useApiService } from "../services/api";
import { useFileUpload } from "../hooks/useFileUpload";
import { FILE_UPLOAD, SUCCESS, FEATURES } from "../utils/constants";
import { formatFileSize, validateFileBeforeUpload } from "../utils/helpers";
import styles from "./Upload.module.css";

const Upload = () => {
  const apiService = useApiService();
  useAuth();

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [globalError, setGlobalError] = useState(null);
  const [shareLinks, setShareLinks] = useState({});
  const [shareLoading, setShareLoading] = useState({});

  const {
    uploadMultiple,
    progress,
    isUploading,
    errors: uploadFailureMap,
  } = useFileUpload({
    onSuccess: (file, response) => {
      setUploadedFiles((prev) => [...prev, { file, response }]);
      setFileErrors((prev) => {
        const next = { ...prev };
        delete next[file.name];
        return next;
      });
    },
    onError: (file, error) => {
      setFileErrors((prev) => ({ ...prev, [file.name]: error.message }));
    },
  });

  const totalSize = useMemo(
    () => selectedFiles.reduce((acc, file) => acc + file.size, 0),
    [selectedFiles]
  );

  const handleFilesAdded = useCallback(
    (files) => {
      setGlobalError(null);
      setFileErrors((prev) => ({ ...prev }));
      setSelectedFiles((current) => {
        const nextSelected = [...current];
        const nextErrors = {};

        files.forEach((file) => {
          if (
            nextSelected.some(
              (existing) =>
                existing.name === file.name && existing.size === file.size
            )
          ) {
            nextErrors[file.name] = "This file is already selected";
            return;
          }

          const validation = validateFileBeforeUpload(file, nextSelected);
          if (!validation.isValid) {
            nextErrors[file.name] = validation.error;
            return;
          }

          nextSelected.push(file);
        });

        setFileErrors((prev) => ({ ...prev, ...nextErrors }));
        return nextSelected;
      });
    },
    [setFileErrors]
  );

  const handleRemoveFile = useCallback((fileName) => {
    setSelectedFiles((current) =>
      current.filter((file) => file.name !== fileName)
    );
    setFileErrors((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFiles.length || isUploading) {
      return;
    }

    setGlobalError(null);

    try {
      await uploadMultiple(selectedFiles);
      setSelectedFiles([]);
    } catch (error) {
      setGlobalError(error.message || "Upload failed. Please try again.");
    }
  }, [isUploading, selectedFiles, uploadMultiple]);

  const handleGenerateShareLink = useCallback(
    async (uploaded) => {
      const fileId = uploaded?.response?.fileId;
      if (!fileId) return;

      setShareLoading((prev) => ({ ...prev, [fileId]: true }));
      setGlobalError(null);

      try {
        const link = await apiService.sharing.generateLink(fileId, {});
        setShareLinks((prev) => ({ ...prev, [fileId]: link }));
      } catch (error) {
        setGlobalError(error.message || "Unable to generate share link");
      } finally {
        setShareLoading((prev) => ({ ...prev, [fileId]: false }));
      }
    },
    [apiService.sharing]
  );

  const canUpload = useMemo(() => {
    if (!selectedFiles.length) return false;
    if (selectedFiles.length > FILE_UPLOAD.MAX_FILES_COUNT) return false;
    if (totalSize > FILE_UPLOAD.MAX_TOTAL_SIZE) return false;
    return true;
  }, [selectedFiles.length, totalSize]);

  return (
    <div className={styles.upload}>
      <div className="container">
        <div className={styles.uploadHeader}>
          <h1 className={styles.uploadTitle}>Upload Files</h1>
          <p className={styles.uploadSubtitle}>
            Securely upload your files to Dropify. Drag and drop or click to
            select files from your device.
          </p>
        </div>

        <div className={styles.uploadContent}>
          {globalError && (
            <div className={styles.globalError}>
              <ErrorMessage
                error={globalError}
                onDismiss={() => setGlobalError(null)}
              />
            </div>
          )}

          <FileDropZone
            onFilesAdded={handleFilesAdded}
            disabled={isUploading}
          />

          {selectedFiles.length > 0 && (
            <div className={styles.selectedFiles}>
              <header className={styles.selectedHeader}>
                <h2>Selected files</h2>
                <span>
                  {selectedFiles.length} / {FILE_UPLOAD.MAX_FILES_COUNT} •{" "}
                  {formatFileSize(totalSize)} of
                  {` ${formatFileSize(FILE_UPLOAD.MAX_TOTAL_SIZE)}`}
                </span>
              </header>

              <ul className={styles.fileList}>
                {selectedFiles.map((file) => {
                  const progressValue = progress[file.name] ?? 0;
                  const errorMessage =
                    fileErrors[file.name] || uploadFailureMap[file.name];
                  const status = errorMessage
                    ? "error"
                    : progressValue === 100
                    ? "success"
                    : "uploading";

                  return (
                    <li key={file.name} className={styles.fileItem}>
                      <div>
                        <strong>{file.name}</strong>
                        <p>{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => handleRemoveFile(file.name)}
                        disabled={isUploading}
                      >
                        Remove
                      </button>
                      {isUploading && (
                        <UploadProgress
                          fileName={file.name}
                          progress={progressValue}
                          status={status}
                          error={errorMessage}
                        />
                      )}
                      {!isUploading && errorMessage && (
                        <ErrorMessage error={errorMessage} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleUpload}
              disabled={!canUpload || isUploading}
            >
              {isUploading ? (
                <LoadingSpinner size="small" message="Uploading" />
              ) : (
                "Upload all"
              )}
            </button>
          </div>

          {uploadedFiles.length > 0 && (
            <section className={styles.results}>
              <h2>Uploaded files</h2>
              <ul className={styles.uploadedList}>
                {uploadedFiles.map(({ file, response }) => {
                  const fileId = response?.fileId;
                  const share = fileId ? shareLinks[fileId] : null;

                  return (
                    <li
                      key={`${file.name}-${file.size}`}
                      className={styles.uploadedItem}
                    >
                      <div>
                        <strong>{file.name}</strong>
                        <p>{SUCCESS.FILE_UPLOADED}</p>
                      </div>
                      {FEATURES.ADVANCED_SHARING && (
                        <>
                          {share?.url ? (
                            <a
                              className={styles.linkButton}
                              href={share.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View share link
                            </a>
                          ) : (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() =>
                                handleGenerateShareLink({ file, response })
                              }
                              disabled={shareLoading[fileId]}
                            >
                              {shareLoading[fileId]
                                ? "Generating…"
                                : "Generate share link"}
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
