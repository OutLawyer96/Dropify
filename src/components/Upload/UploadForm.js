import React, { useCallback, useMemo, useState } from 'react';
import styles from './UploadForm.module.css';
import FileDropZone from './FileDropZone';
import FileList from './FileList';
import FileValidation from './FileValidation';
import UploadProgress from './UploadProgress';
import { FILE_UPLOAD, ERRORS, SUCCESS } from '../../utils/constants';
import {
  formatFileSize,
  generateUniqueId,
  validateFileSize,
  validateFileType,
  copyToClipboard,
} from '../../utils/helpers';
import apiService from '../../services/api';

const INITIAL_STATUS_MESSAGE = null;

const createFileEntry = (file) => ({
  id: generateUniqueId('upload'),
  signature: `${file.name}-${file.size}-${file.lastModified}`,
  file,
  name: file.name,
  size: file.size,
  type: file.type,
  status: 'pending',
  progress: 0,
  error: null,
  shareLink: null,
  url: null,
  uploadedAt: null,
});

const UploadForm = () => {
  const [files, setFiles] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS_MESSAGE);
  const [isUploading, setIsUploading] = useState(false);

  const totalSize = useMemo(
    () => files.reduce((acc, item) => acc + (item.file?.size || 0), 0),
    [files]
  );

  const completedCount = useMemo(
    () => files.filter((file) => file.status === 'success').length,
    [files]
  );

  const errorCount = useMemo(
    () => files.filter((file) => file.status === 'error').length,
    [files]
  );

  const overallProgress = useMemo(() => {
    if (!files.length) return 0;
    const progressSum = files.reduce((acc, item) => acc + (item.progress || 0), 0);
    return Math.round(progressSum / files.length);
  }, [files]);

  const handleFilesAdded = useCallback(
    (fileList) => {
      const incomingFiles = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
      if (!incomingFiles.length) return;

      const errors = [];
      const currentSignatures = new Set(files.map((item) => item.signature));
      const acceptedEntries = [];
      let runningTotalSize = totalSize;

      incomingFiles.forEach((file) => {
        const signature = `${file.name}-${file.size}-${file.lastModified}`;

        if (currentSignatures.has(signature) || acceptedEntries.some((entry) => entry.signature === signature)) {
          errors.push(`"${file.name}" is already added to the upload queue.`);
          return;
        }

        if (files.length + acceptedEntries.length >= FILE_UPLOAD.MAX_FILES_COUNT) {
          errors.push(`You can upload up to ${FILE_UPLOAD.MAX_FILES_COUNT} files at a time.`);
          return;
        }

        if (!validateFileType(file, FILE_UPLOAD.SUPPORTED_TYPES)) {
          errors.push(`"${file.name}" is not a supported file type.`);
          return;
        }

        if (!validateFileSize(file, FILE_UPLOAD.MAX_FILE_SIZE)) {
          errors.push(`"${file.name}" exceeds the maximum file size of ${formatFileSize(FILE_UPLOAD.MAX_FILE_SIZE)}.`);
          return;
        }

        if (runningTotalSize + file.size > FILE_UPLOAD.MAX_TOTAL_SIZE) {
          errors.push(
            `Adding "${file.name}" would exceed the total upload limit of ${formatFileSize(FILE_UPLOAD.MAX_TOTAL_SIZE)}.`
          );
          return;
        }

        runningTotalSize += file.size;
        acceptedEntries.push(createFileEntry(file));
      });

      if (errors.length) {
        setValidationErrors(errors);
      } else {
        setValidationErrors([]);
      }

      if (!acceptedEntries.length) {
        return;
      }

      setStatusMessage(INITIAL_STATUS_MESSAGE);
      setFiles((prev) => [...prev, ...acceptedEntries]);
    },
    [files, totalSize]
  );

  const updateFileEntry = useCallback((id, updates) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...updates } : file)));
  }, []);

  const handleRemoveFile = useCallback(
    (id) => {
      if (isUploading) return;
      setFiles((prev) => prev.filter((file) => file.id !== id));
    },
    [isUploading]
  );

  const handleRetryFile = useCallback((id) => {
    updateFileEntry(id, { status: 'pending', progress: 0, error: null });
    setStatusMessage(INITIAL_STATUS_MESSAGE);
  }, [updateFileEntry]);

  const handleClearAll = useCallback(() => {
    if (isUploading) return;
    setFiles([]);
    setValidationErrors([]);
    setStatusMessage(INITIAL_STATUS_MESSAGE);
  }, [isUploading]);

  const handleCopyLink = useCallback(async (shareLink) => {
    if (!shareLink) return;
    const copied = await copyToClipboard(shareLink);
    if (copied) {
      setStatusMessage({ type: 'success', text: SUCCESS.LINK_COPIED });
    } else {
      setStatusMessage({ type: 'error', text: 'Unable to copy link. Please try again.' });
    }
  }, []);

  const uploadSingleFile = useCallback(
    (fileEntry) => {
      return new Promise((resolve) => {
        let progressValue = fileEntry.progress || 0;

        updateFileEntry(fileEntry.id, {
          status: 'uploading',
          progress: progressValue > 0 ? progressValue : 1,
          error: null,
        });

        const progressInterval = setInterval(() => {
          progressValue = Math.min(progressValue + Math.random() * 15 + 5, 95);
          updateFileEntry(fileEntry.id, { progress: Math.round(progressValue) });
        }, 300);

        const handleCompletion = (result, isError = false) => {
          clearInterval(progressInterval);
          if (isError) {
            updateFileEntry(fileEntry.id, {
              status: 'error',
              error: result?.message || ERRORS.UPLOAD_FAILED,
              progress: Math.max(Math.round(progressValue), 5),
            });
          } else {
            updateFileEntry(fileEntry.id, {
              status: 'success',
              progress: 100,
              shareLink: result?.shareLink || null,
              url: result?.url || null,
              uploadedAt: new Date().toISOString(),
            });
          }
          resolve(!isError);
        };

        apiService.upload
          .single(fileEntry.file, (percent) => {
            const safePercent = Math.min(Math.max(percent, progressValue), 95);
            updateFileEntry(fileEntry.id, { progress: Math.round(safePercent) });
          })
          .then((response) => handleCompletion(response))
          .catch((error) => handleCompletion(error, true));
      });
    },
    [updateFileEntry]
  );

  const handleUpload = useCallback(async () => {
    const uploadable = files.filter((file) => ['pending', 'error'].includes(file.status));

    if (!uploadable.length) {
      setValidationErrors(['Add files to the queue before starting the upload.']);
      return;
    }

    setIsUploading(true);
    setValidationErrors([]);
    setStatusMessage({ type: 'info', text: 'Uploading files to Dropify…' });

    const results = await Promise.all(uploadable.map(uploadSingleFile));

    const successCount = results.filter(Boolean).length;
    const failureCount = results.length - successCount;

    if (successCount && !failureCount) {
      setStatusMessage({
        type: 'success',
        text: successCount === 1 ? SUCCESS.FILE_UPLOADED : SUCCESS.FILES_UPLOADED,
      });
    } else if (successCount && failureCount) {
      setStatusMessage({
        type: 'warning',
        text: `Uploaded ${successCount} file(s). ${failureCount} file(s) could not be uploaded.`,
      });
    } else {
      setStatusMessage({ type: 'error', text: ERRORS.UPLOAD_FAILED });
    }

    setIsUploading(false);
  }, [files, uploadSingleFile]);

  const overallStatus = useMemo(() => {
    if (!files.length) return 'idle';
    if (files.some((file) => file.status === 'uploading')) return 'uploading';
    if (files.every((file) => file.status === 'pending')) return 'pending';
    if (files.every((file) => file.status === 'success')) return 'success';
    if (files.some((file) => file.status === 'error')) return 'error';
    return 'pending';
  }, [files]);

  const helperText = useMemo(() => {
    if (!files.length) return '';
    return `${completedCount}/${files.length} files uploaded · ${formatFileSize(totalSize)}`;
  }, [completedCount, files.length, totalSize]);

  return (
    <section className={styles.uploadForm} aria-labelledby="upload-form-title">
      <header className={styles.header}>
        <div>
          <h2 id="upload-form-title" className={styles.title}>
            Quick Upload
          </h2>
          <p className={styles.subtitle}>
            Drag and drop files anywhere inside the drop zone or browse from your device. Each file can be up to{' '}
            {formatFileSize(FILE_UPLOAD.MAX_FILE_SIZE)} with a total upload limit of{' '}
            {formatFileSize(FILE_UPLOAD.MAX_TOTAL_SIZE)}.
          </p>
        </div>
        <div className={styles.summary}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{files.length}</span>
            <span className={styles.statLabel}>Files selected</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedCount}</span>
            <span className={styles.statLabel}>Uploaded</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatFileSize(totalSize)}</span>
            <span className={styles.statLabel}>Total size</span>
          </div>
        </div>
      </header>

      {statusMessage && (
        <div className={`${styles.statusMessage} ${styles[statusMessage.type]}`} role="status">
          {statusMessage.text}
        </div>
      )}

      <FileDropZone onFilesAdded={handleFilesAdded} disabled={isUploading} />

      {validationErrors.length > 0 && <FileValidation errors={validationErrors} />}

      {files.length > 0 && (
        <div className={styles.queueSection}>
          {overallStatus !== 'pending' && (
            <div className={styles.overallProgress}>
              <UploadProgress
                progress={overallProgress}
                status={overallStatus === 'idle' ? 'pending' : overallStatus}
                label="Overall progress"
                helperText={helperText}
              />
            </div>
          )}

          <FileList
            files={files}
            onRemove={handleRemoveFile}
            onRetry={handleRetryFile}
            onCopyLink={handleCopyLink}
            isUploading={isUploading}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleUpload}
              disabled={isUploading || !files.some((file) => ['pending', 'error'].includes(file.status))}
            >
              {isUploading ? 'Uploading…' : 'Start Upload'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleClearAll}
              disabled={isUploading || !files.length}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default UploadForm;
