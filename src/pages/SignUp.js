import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/Common/ErrorMessage";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Auth.module.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/u;

const SignUp = () => {
  const navigate = useNavigate();
  const {
    signUp,
    confirmSignUp,
    resendConfirmationCode,
    error: authError,
    isLoading,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [name, setName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const passwordHint = useMemo(
    () =>
      "Password must be at least 8 characters and include upper, lower case letters and a number.",
    []
  );

  const validateRegistration = () => {
    if (!emailRegex.test(email.trim())) {
      setFormError("Please enter a valid email address");
      return false;
    }

    if (!strongPassword.test(password)) {
      setFormError(passwordHint);
      return false;
    }

    if (password !== confirmPasswordValue) {
      setFormError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validateRegistration()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email.trim().toLowerCase(), password, {
        email: email.trim().toLowerCase(),
        name,
      });
      setNeedsConfirmation(true);
      setSuccessMessage(
        "We sent you a verification code. Please check your email."
      );
    } catch (error) {
      setFormError(
        error.message || "Unable to create account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmation = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!verificationCode || verificationCode.length < 4) {
      setFormError("Please enter the verification code from your email");
      return;
    }

    setIsConfirming(true);

    try {
      await confirmSignUp(email.trim().toLowerCase(), verificationCode.trim());
      setSuccessMessage("Your account is confirmed. You can now sign in.");
      navigate("/login", { replace: true });
    } catch (error) {
      setFormError(error.message || "Confirmation failed. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleResendCode = async () => {
    setFormError(null);
    setSuccessMessage(null);

    if (!email) {
      setFormError("Enter your email above before requesting another code");
      return;
    }

    try {
      await resendConfirmationCode(email.trim().toLowerCase());
      setSuccessMessage("A new verification code has been sent to your email");
    } catch (error) {
      setFormError(error.message || "Unable to resend verification code");
    }
  };

  const combinedError = formError || authError;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Start sharing files securely with Dropify.
        </p>

        {combinedError && (
          <ErrorMessage
            error={combinedError}
            onDismiss={() => setFormError(null)}
          />
        )}

        {successMessage && (
          <div className={styles.success}>{successMessage}</div>
        )}

        <form
          className={styles.form}
          onSubmit={handleSignUp}
          noValidate
          hidden={needsConfirmation}
        >
          <label className={styles.inputLabel} htmlFor="name">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={styles.input}
            placeholder="Jane Doe"
            disabled={isSubmitting}
          />

          <label className={styles.inputLabel} htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
            placeholder="you@example.com"
            disabled={isSubmitting}
            required
          />

          <label className={styles.inputLabel} htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            placeholder="Create a strong password"
            disabled={isSubmitting}
            required
            minLength={8}
            aria-describedby="password-hint"
          />
          <small id="password-hint" className={styles.hint}>
            {passwordHint}
          </small>

          <label
            className={styles.inputLabel}
            htmlFor="signup-confirm-password"
          >
            Confirm Password
          </label>
          <input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPasswordValue}
            onChange={(event) => setConfirmPasswordValue(event.target.value)}
            className={styles.input}
            placeholder="Repeat your password"
            disabled={isSubmitting}
            required
            minLength={8}
          />

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? (
              <LoadingSpinner size="small" message="Creating account" />
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {needsConfirmation && (
          <form className={styles.form} onSubmit={handleConfirmation}>
            <label className={styles.inputLabel} htmlFor="verification-code">
              Verification code
            </label>
            <input
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              className={styles.input}
              placeholder="Enter the 6-digit code"
              disabled={isConfirming}
              required
            />

            <div className={styles.utilityRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleResendCode}
                disabled={isConfirming}
              >
                Resend code
              </button>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <LoadingSpinner size="small" message="Confirming" />
                ) : (
                  "Confirm account"
                )}
              </button>
            </div>
          </form>
        )}

        <div className={styles.footer}>
          <span>Already have an account?</span>
          <Link className={styles.link} to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
