import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Files.module.css';

const Files = () => {
  return (
    <div className={styles.files}>
      <div className="container">
        <div className={styles.filesHeader}>
          <h1 className={styles.filesTitle}>My Files</h1>
          <p className={styles.filesSubtitle}>
            Manage your uploaded files, view sharing links, and organize your content. 
            Track downloads and control access permissions.
          </p>
        </div>

        <div className={styles.filesContent}>
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>📁</div>
            <h2 className={styles.placeholderTitle}>File Management Coming Soon</h2>
            <p className={styles.placeholderDescription}>
              The file management system is currently being developed by our team. 
              This area will soon display all your uploaded files with advanced organization and sharing features.
            </p>
            <div className={styles.comingSoon}>
              <span>🚧</span>
              Under Development
            </div>
          </div>

          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📋</div>
              <h3 className={styles.featureTitle}>File List</h3>
              <p className={styles.featureDescription}>
                View all your uploaded files in an organized list with thumbnails and details.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🔗</div>
              <h3 className={styles.featureTitle}>Share Links</h3>
              <p className={styles.featureDescription}>
                Generate and manage secure sharing links with customizable permissions.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>📊</div>
              <h3 className={styles.featureTitle}>Analytics</h3>
              <p className={styles.featureDescription}>
                Track file views, downloads, and sharing activity with detailed analytics.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>🗂️</div>
              <h3 className={styles.featureTitle}>Organization</h3>
              <p className={styles.featureDescription}>
                Sort, filter, and organize your files by date, type, or custom categories.
              </p>
            </div>
          </div>

          <div className={styles.actions}>
            <Link to="/upload" className={styles.actionButton}>
              <span>📤</span>
              Upload Your First File
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Files;