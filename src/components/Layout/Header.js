import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link to="/" className={styles.brand}>
          <div className={styles.logo}>
            D
          </div>
          <span className={styles.brandText}>Dropify</span>
        </Link>
        <Navigation />
      </div>
    </header>
  );
};

export default Header;