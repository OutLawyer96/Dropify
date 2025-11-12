import React, { useMemo } from 'react';
import styles from './FileItem.module.css';
import UploadProgress from './UploadProgress';
import FileTypeIcon from './FileTypeIcon';
import { formatDate, formatFileSize } from '../../utils/helpers';

const STATUS_LABELS = {
  pending: 'Ready to upload',
  uploading: 'Uploading…',
  success: 'Completed',
  error: 'Needs attention',
};

const FileItem = ({ file, onRemove, onRetry, onCopyLink, isUploading }) => {
  const { id, name, size, status, progress, error, shareLink, uploadedAt } = file;

  const canRemove = status === 'pending' && !isUploading;
  const canRetry = status === 'error' && !isUploading;
  const canCopyLink = status === 'success' && !!shareLink;

  const statusLabel = STATUS_LABELS[status] || 'Pending';

  const helperText = useMemo(() => {
    if (status === 'success' && uploadedAt) {
      return `Uploaded ${formatDate(uploadedAt, 'relative')}`;
    }
    if (status === 'error' && error) {
      return error;
    }
    return '';
  }, [status, uploadedAt, error]);

  return (
    <article className={`${styles.fileItem} ${styles[status]}`}>
      <div className={styles.headline}>
        <div className={styles.meta}>
          <FileTypeIcon filename={name} type={file.type} />
          <div className={styles.info}>
            <div className={styles.titleRow}>
              <span className={styles.name}>{name}</span>
              <span className={styles.size}>{formatFileSize(size)}</span>
            </div>
            <div className={styles.statusRow}>
              <span className={`${styles.statusBadge} ${styles[`${status}Badge`] || ''}`}>
                {statusLabel}
              </span>
              {status === 'success' && uploadedAt && (
                <span className={styles.timestamp}>{formatDate(uploadedAt, 'relative')}</span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          {canRemove && (
            <button type="button" onClick={() => onRemove?.(id)} className={styles.actionButton}>
              Remove
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={() => onRetry?.(id)} className={styles.actionButton}>
              Retry
            </button>
          )}
        </div>
      </div>

      <UploadProgress
        progress={Math.round(progress || 0)}
        status={status}
        size="compact"
        helperText={helperText}
      />

      {shareLink && (
        <div className={styles.shareRow}>
          <a href={shareLink} className={styles.shareLink} target="_blank" rel="noopener noreferrer">
            {shareLink}
          </a>
          {canCopyLink && (
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => onCopyLink?.(shareLink)}
            >
              Copy link
            </button>
          )}
        </div>
      )}

      {status === 'error' && error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}
    </article>
  );
};

export default FileItem;
