import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';

const Home = () => {
  return (
    <div className={styles.home}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Share Files Securely with Dropify
            </h1>
            <p className={styles.heroSubtitle}>
              Upload, share, and manage your files with confidence. 
              Fast, secure, and reliable file sharing made simple.
            </p>
            <div className={styles.heroActions}>
              <Link to="/upload" className={styles.primaryButton}>
                <span>📤</span>
                Upload Files
              </Link>
              <Link to="/files" className={styles.secondaryButton}>
                <span>📁</span>
                View My Files
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className="container">
          <h2 className={styles.featuresTitle}>
            Why Choose Dropify?
          </h2>
          <div className={styles.featuresGrid}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                🔒
              </div>
              <h3 className={styles.featureTitle}>Secure & Private</h3>
              <p className={styles.featureDescription}>
                Your files are encrypted and protected with enterprise-grade security. 
                Only you control who has access.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                ⚡
              </div>
              <h3 className={styles.featureTitle}>Lightning Fast</h3>
              <p className={styles.featureDescription}>
                Upload and share files instantly with our optimized infrastructure. 
                No waiting, just results.
              </p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                🌐
              </div>
              <h3 className={styles.featureTitle}>Easy Sharing</h3>
              <p className={styles.featureDescription}>
                Generate secure share links instantly. Control access permissions 
                and track who views your files.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className={styles.cta}>
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Ready to Get Started?
          </h2>
          <p className={styles.ctaDescription}>
            Join thousands of users who trust Dropify for their file sharing needs.
          </p>
          <Link to="/upload" className={styles.ctaButton}>
            <span>🚀</span>
            Start Sharing Now
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;