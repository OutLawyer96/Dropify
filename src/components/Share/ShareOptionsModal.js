import React, { useState } from "react";
import { SHARING, FEATURES } from "../../utils/constants";
import styles from "./ShareOptionsModal.module.css";

const ShareOptionsModal = ({ fileId, fileName, onShare, onClose }) => {
  const [expiresInDays, setExpiresInDays] = useState(null);
  const [maxDownloads, setMaxDownloads] = useState(null);
  const [password, setPassword] = useState("");
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      const options = {
        expiresInDays: isEphemeral
          ? SHARING.EPHEMERAL.DEFAULT_EXPIRY_MINUTES / (24 * 60)
          : expiresInDays,
        maxDownloads: isEphemeral
          ? SHARING.EPHEMERAL.DEFAULT_DOWNLOAD_LIMIT
          : maxDownloads,
        password: password || null,
        isEphemeral: isEphemeral,
      };
      console.log(
        "📤 Creating share with fileId:",
        fileId,
        "and options:",
        options
      );
      await onShare(fileId, options);
      onClose();
    } catch (error) {
      console.error("Failed to create share:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEphemeralToggle = (checked) => {
    setIsEphemeral(checked);
    if (checked) {
      setExpiresInDays(SHARING.EPHEMERAL.DEFAULT_EXPIRY_MINUTES / (24 * 60));
      setMaxDownloads(SHARING.EPHEMERAL.DEFAULT_DOWNLOAD_LIMIT);
    } else {
      setExpiresInDays(null);
      setMaxDownloads(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>🔗 Create Share Link</h2>
          <button onClick={onClose} className={styles.closeIcon}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.fileInfo}>
            <div className={styles.fileIcon}>📄</div>
            <div className={styles.fileDetails}>
              <div className={styles.fileName}>{fileName}</div>
              <div className={styles.fileHint}>
                Configure sharing options below
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <button
              className={`${styles.quickButton} ${
                isEphemeral ? styles.active : ""
              }`}
              onClick={() => handleEphemeralToggle(!isEphemeral)}
              disabled={!FEATURES.EPHEMERAL_SHARES}
            >
              <span className={styles.quickIcon}>⏳</span>
              <span className={styles.quickLabel}>Self-Destruct Link</span>
              <span className={styles.quickDesc}>15 min, 1 download</span>
            </button>
          </div>

          {/* Expiration */}
          {FEATURES.EXPIRATION_DATES && !isEphemeral && (
            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>⏰</span>
                Link Expiration
              </label>
              <select
                value={expiresInDays || ""}
                onChange={(e) =>
                  setExpiresInDays(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={styles.select}
              >
                {SHARING.EXPIRATION_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value || ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Download Limit */}
          {FEATURES.DOWNLOAD_LIMITS && !isEphemeral && (
            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>⬇️</span>
                Download Limit
              </label>
              <select
                value={maxDownloads || ""}
                onChange={(e) =>
                  setMaxDownloads(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={styles.select}
              >
                {SHARING.DOWNLOAD_LIMITS.map((option) => (
                  <option key={option.label} value={option.value || ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Password Protection */}
          {FEATURES.PASSWORD_PROTECTION && (
            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>🔒</span>
                Password Protection (Optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to protect link"
                className={styles.input}
              />
              {password && (
                <div className={styles.hint}>
                  Recipients will need this password to access the file
                </div>
              )}
            </div>
          )}

          {/* Ephemeral Warning */}
          {isEphemeral && (
            <div className={styles.warningBox}>
              <div className={styles.warningIcon}>⚠️</div>
              <div className={styles.warningText}>
                <strong>Self-Destruct Mode</strong>
                <p>
                  This link will expire in 15 minutes and can only be downloaded
                  once. Perfect for sensitive files!
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelButton}>
            Cancel
          </button>
          <button
            onClick={handleCreateShare}
            className={styles.createButton}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "🔗 Create Share Link"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareOptionsModal;
