import React from "react";
import styles from "./UploadProgress.module.css";

const UploadProgress = ({
  fileName,
  progress = 0,
  status = "uploading",
  error,
  onCancel,
}) => {
  const safeProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`${styles.progress} ${styles[status] || ""}`}>
      <div className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.fileName}>{fileName}</span>
          <span className={styles.percent}>{safeProgress}%</span>
        </div>
        {onCancel && status === "uploading" && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${safeProgress}%` }}
          aria-hidden="true"
        />
      </div>

      {status === "success" && (
        <div className={styles.success}>Upload complete</div>
      )}
      {status === "error" && error && (
        <div className={styles.error}>{error}</div>
      )}
    </div>
  );
};

export default UploadProgress;
