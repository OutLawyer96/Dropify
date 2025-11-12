import React from "react";
import styles from "./ErrorMessage.module.css";

const getMessage = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return "Something went wrong. Please try again.";
};

const ErrorMessage = ({ error, onRetry, onDismiss }) => {
  const message = getMessage(error);
  if (!message) return null;

  return (
    <div className={styles.error} role="alert">
      <span className={styles.icon} aria-hidden="true">
        ⚠️
      </span>
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        {(onRetry || onDismiss) && (
          <div className={styles.actions}>
            {onRetry && (
              <button type="button" className={styles.retry} onClick={onRetry}>
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                className={styles.dismiss}
                onClick={onDismiss}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
