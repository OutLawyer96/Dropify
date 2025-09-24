import React from 'react';
import styles from './Upload.module.css';

const Upload = () => {
  return (
    <div className={styles.upload}>
      <div className="container">
        <div className={styles.uploadHeader}>
          <h1 className={styles.uploadTitle}>Upload Files</h1>
          <p className={styles.uploadSubtitle}>
            Securely upload your files to Dropify. Drag and drop or click to select files from your device.
          </p>
        </div>

        <div className={styles.uploadContent}>
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>📤</div>
            <h2 className={styles.placeholderTitle}>Upload Component Coming Soon</h2>
            <p className={styles.placeholderDescription}>
              The file upload functionality is currently being developed by our team. 
              This area will soon feature drag-and-drop upload, progress tracking, and file management.
            </p>
            <div className={styles.comingSoon}>
              <span>🚧</span>
              Under Development
            </div>
          </div>

          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📁</div>
              <h3 className={styles.featureTitle}>Multiple Files</h3>
              <p className={styles.featureDescription}>
                Upload multiple files at once with bulk selection support.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📊</div>
              <h3 className={styles.featureTitle}>Progress Tracking</h3>
              <p className={styles.featureDescription}>
                Real-time progress bars for each file being uploaded.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🔗</div>
              <h3 className={styles.featureTitle}>Instant Sharing</h3>
              <p className={styles.featureDescription}>
                Generate shareable links immediately after upload completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;