import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./Navigation.module.css";
import { useAuth } from "../../contexts/AuthContext";

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { isAuthenticated, user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { to: "/", label: "Home" },
    { to: "/upload", label: "Upload Files", requiresAuth: true },
    { to: "/files", label: "My Files", requiresAuth: true },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated
  );

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    signOut();
    navigate("/");
  };

  const renderAuthButtons = () => (
    <div className={styles.authButtons}>
      <NavLink
        to="/login"
        className={styles.loginLink}
        state={{ from: location }}
      >
        Login
      </NavLink>
      <NavLink to="/signup" className={styles.signupLink}>
        Sign Up
      </NavLink>
    </div>
  );

  const renderUserMenu = () => (
    <div className={styles.userMenu}>
      <button
        type="button"
        className={styles.userBadge}
        onClick={() => setIsUserMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isUserMenuOpen}
      >
        <span className={styles.avatar}>
          {user?.attributes?.email?.charAt(0)?.toUpperCase() || "U"}
        </span>
        <span className={styles.userEmail}>
          {user?.attributes?.email || user?.username}
        </span>
      </button>
      {isUserMenuOpen && (
        <div className={styles.dropdown} role="menu">
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={() => navigate("/files")}
          >
            My Files
          </button>
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={() => navigate("/settings")}
          >
            Settings
          </button>
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={handleSignOut}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );

  return (
    <nav className={styles.nav}>
      {/* Desktop Navigation */}
      <ul className={styles.navList}>
        {visibleNavItems.map((item) => (
          <li key={item.to} className={styles.navItem}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className={styles.authSection}>
        {isLoading
          ? null
          : isAuthenticated
          ? renderUserMenu()
          : renderAuthButtons()}
      </div>

      {/* Mobile Menu Button */}
      <button
        className={`${styles.mobileMenuButton} ${
          isMobileMenuOpen ? styles.open : ""
        }`}
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
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `${styles.mobileNavLink} ${isActive ? styles.active : ""}`
                  }
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className={styles.mobileAuth}>
            {isAuthenticated ? (
              <button
                type="button"
                className={styles.mobileLogout}
                onClick={handleSignOut}
              >
                Logout
              </button>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={closeMobileMenu}
                  className={styles.mobileAuthLink}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  onClick={closeMobileMenu}
                  className={styles.mobileAuthLink}
                >
                  Sign Up
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
