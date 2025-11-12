import React from "react";
import styles from "./LoadingSpinner.module.css";

const sizeClassMap = {
  small: styles.small,
  medium: styles.medium,
  large: styles.large,
};

const LoadingSpinner = ({ size = "medium", message, fullScreen = false }) => {
  const sizeClass = sizeClassMap[size] || styles.medium;

  return (
    <div
      className={`${styles.wrapper} ${
        fullScreen ? styles.fullScreen : ""
      }`.trim()}
    >
      <div
        className={`${styles.spinner} ${sizeClass}`}
        role="status"
        aria-live="polite"
      />
      {message && <span className={styles.message}>{message}</span>}
    </div>
  );
};

export default LoadingSpinner;
