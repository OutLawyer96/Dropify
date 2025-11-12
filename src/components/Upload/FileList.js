import React from "react";
import styles from "./FileList.module.css";
import {
  formatFileSize,
  formatRelativeTime,
  getFileIcon,
} from "../../utils/helpers";

const getFileKey = (file) =>
  file.fileId ||
  file.id ||
  file.key ||
  `${file.fileName}-${file.uploadTimestamp}`;

const FileList = ({
  files = [],
  onDelete,
  onShare,
  onView,
  onAnalytics,
  isLoading = false,
  viewMode = "list",
}) => {
  if (isLoading) {
    return (
      <div className={`${styles.fileList} ${styles[viewMode]}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={`${styles.fileCard} ${styles.skeleton}`}>
            <div className={styles.fileIcon} aria-hidden="true" />
            <div className={styles.fileContent}>
              <div className={styles.placeholderLine} />
              <div className={styles.placeholderLineShort} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon} role="img" aria-label="Empty">
          📂
        </span>
        <h3>No files yet</h3>
        <p>Start by uploading files to see them listed here.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.fileList} ${styles[viewMode]}`}>
      {files.map((file) => {
        const key = getFileKey(file);
        const icon = getFileIcon(file.mimeType || file.fileName);
        const fileSize = formatFileSize(file.fileSize || file.size || 0);
        const uploadedAt = formatRelativeTime(
          file.uploadTimestamp || file.createdAt || file.updatedAt
        );
        const downloadCount = file.downloadCount ?? 0;

        return (
          <article key={key} className={styles.fileCard}>
            <div className={styles.fileIcon}>{icon}</div>
            <div className={styles.fileContent}>
              <div className={styles.fileHeader}>
                <h3 className={styles.fileName}>
                  {file.fileName || file.name}
                </h3>
                <span className={styles.fileSize}>{fileSize}</span>
              </div>
              <div className={styles.fileMeta}>
                <span>{uploadedAt}</span>
                <span>Downloads: {downloadCount}</span>
              </div>
            </div>
            <div className={styles.fileActions}>
              <button
                type="button"
                onClick={() => onView?.(file.fileId || file.id)}
                className={styles.iconButton}
                title="View file"
              >
                👁️ View
              </button>
              <button
                type="button"
                onClick={() => onShare?.(file.fileId || file.id)}
                className={styles.iconButton}
                title="Share file"
              >
                🔗 Share
              </button>
              {onAnalytics && (
                <button
                  type="button"
                  onClick={() => onAnalytics?.(file.fileId || file.id)}
                  className={styles.iconButton}
                  title="View analytics"
                >
                  📊 Analytics
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete?.(file.fileId || file.id)}
                className={styles.iconButton}
                title="Delete file"
              >
                🗑️ Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default FileList;
