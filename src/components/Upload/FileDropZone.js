import React, { useCallback, useRef, useState } from "react";
import styles from "./FileDropZone.module.css";
import { FILE_UPLOAD } from "../../utils/constants";
import { formatFileSize } from "../../utils/helpers";

const FileDropZone = ({ onFilesAdded, disabled = false }) => {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      event.dataTransfer.dropEffect = "copy";
      if (!isDragActive) {
        setIsDragActive(true);
      }
    },
    [disabled, isDragActive]
  );

  const handleDragLeave = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      const related = event.relatedTarget;
      if (!related || !event.currentTarget.contains(related)) {
        setIsDragActive(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      const droppedFiles = Array.from(event.dataTransfer?.files || []);
      setIsDragActive(false);
      if (droppedFiles.length && typeof onFilesAdded === "function") {
        onFilesAdded(droppedFiles);
      }
    },
    [disabled, onFilesAdded]
  );

  const openFileBrowser = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (event) => {
      if (disabled) return;
      const selectedFiles = Array.from(event.target.files || []);
      if (selectedFiles.length && typeof onFilesAdded === "function") {
        onFilesAdded(selectedFiles);
      }
      // Reset the input so the same file can be selected again later.
      event.target.value = "";
    },
    [disabled, onFilesAdded]
  );

  return (
    <div
      className={[
        styles.dropZone,
        isDragActive ? styles.dragActive : "",
        disabled ? styles.disabled : "",
      ]
        .join(" ")
        .trim()}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="File upload drop zone"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className={styles.input}
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={styles.illustration} aria-hidden="true">
        <span role="img" aria-label="Upload">
          📤
        </span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>Drag & drop files here</h3>
        <p className={styles.description}>
          or{" "}
          <button
            type="button"
            className={styles.browseButton}
            aria-label="Browse files"
            disabled={disabled}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={openFileBrowser}
          >
            browse
          </button>{" "}
          from your device
        </p>
        <ul className={styles.meta}>
          <li>Up to {FILE_UPLOAD.MAX_FILES_COUNT} files per upload</li>
          <li>Max {formatFileSize(FILE_UPLOAD.MAX_FILE_SIZE)} per file</li>
          <li>Total size up to {formatFileSize(FILE_UPLOAD.MAX_TOTAL_SIZE)}</li>
        </ul>
      </div>
    </div>
  );
};

export default FileDropZone;
