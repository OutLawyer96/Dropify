import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Navigation.module.css';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/upload', label: 'Upload Files' },
    { to: '/files', label: 'My Files' }
  ];

  return (
    <nav className={styles.nav}>
      {/* Desktop Navigation */}
      <ul className={styles.navList}>
        {navItems.map((item) => (
          <li key={item.to} className={styles.navItem}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Mobile Menu Button */}
      <button
        className={`${styles.mobileMenuButton} ${isMobileMenuOpen ? styles.open : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileMenuOpen}
      >
        <div className={styles.hamburger}>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </div>
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <ul className={styles.mobileNavList}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `${styles.mobileNavLink} ${isActive ? styles.active : ''}`
                  }
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navigation;