import React from 'react';
import Header from './Header';
import styles from './Layout.module.css';

const Layout = ({ children }) => {
  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <Header />
      </div>
      <main className={styles.main}>
        <div className={styles.content}>
          {children}
        </div>
      </main>
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <p>&copy; 2024 Dropify. All rights reserved. Secure file sharing made simple.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;