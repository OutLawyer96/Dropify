import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/Common/ErrorMessage";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Auth.module.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, error: authError, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = useMemo(() => {
    const state = location.state;
    return state?.from?.pathname || "/files";
  }, [location.state]);

  const validate = () => {
    if (!emailRegex.test(email.trim())) {
      setFormError("Please enter a valid email address");
      return false;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email.trim().toLowerCase(), password, {
        remember: rememberMe,
      });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setFormError(error.message || "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const combinedError = formError || authError;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>
          Sign in with your credentials to access your files.
        </p>

        {combinedError && (
          <ErrorMessage
            error={combinedError}
            onDismiss={() => setFormError(null)}
          />
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.inputLabel} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
            placeholder="you@example.com"
            disabled={isSubmitting}
            required
          />

          <label className={styles.inputLabel} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            placeholder="Enter your password"
            disabled={isSubmitting}
            required
            minLength={8}
          />

          <div className={styles.utilityRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>Remember me</span>
            </label>

            <Link className={styles.link} to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <LoadingSpinner size="small" message="Signing in" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <span>Don&apos;t have an account?</span>
          <Link className={styles.link} to="/signup">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
