import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import ErrorMessage from "../components/Common/ErrorMessage";
import styles from "./SharedFile.module.css";

const SharedFile = () => {
  const { shareId } = useParams();
  const [fileData, setFileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [downloadsRemaining, setDownloadsRemaining] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const apiUrl =
          process.env.REACT_APP_API_URL ||
          "https://t10t5ltwui.execute-api.eu-north-1.amazonaws.com/prod";

        // Include password in query if provided
        const url = password
          ? `${apiUrl}/share/${shareId}?password=${encodeURIComponent(
              password
            )}`
          : `${apiUrl}/share/${shareId}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Share link not found or has expired");
          } else if (response.status === 403) {
            // Password is incorrect
            if (password) {
              setRequiresPassword(true);
              setPasswordError("Incorrect password");
              setIsLoading(false);
              return;
            }
            throw new Error(
              "This share link has expired or reached its download limit"
            );
          }
          throw new Error("Unable to load shared file");
        }

        const data = await response.json();

        console.log("🔍 API Response:", data);
        console.log("🔍 requiresPassword check:", {
          "data.data?.requiresPassword": data.data?.requiresPassword,
          "data.requiresPassword": data.requiresPassword,
          "password provided": password,
          "Will show password form": !!(
            data.data?.requiresPassword || data.requiresPassword
          ),
        });

        // Check if password is required
        if (data.data?.requiresPassword || data.requiresPassword) {
          console.log("✅ Setting requiresPassword to true");
          setRequiresPassword(true);
          setPasswordError(password ? "Incorrect password" : "");
          setIsLoading(false);
          return;
        }

        console.log("✅ Password not required, loading file data");
        const fileData = data.data || data;
        setFileData(fileData);
        setRequiresPassword(false);
        setPasswordError("");

        // Set up ephemeral countdown if applicable
        if (fileData.isEphemeral && fileData.expiresAt) {
          const expiryTime = new Date(fileData.expiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(0, expiryTime - now);
          setTimeRemaining(Math.floor(remaining / 1000));
        }

        // Set downloads remaining
        if (fileData.downloadLimit) {
          const remaining =
            fileData.downloadLimit - (fileData.downloadCount || 0);
          setDownloadsRemaining(Math.max(0, remaining));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShareData();
  }, [shareId, refetchTrigger]);

  // Countdown timer for ephemeral shares
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError("This link has expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const handleDownload = async () => {
    try {
      // Get download URL with download=true parameter
      const apiUrl =
        process.env.REACT_APP_API_URL ||
        "https://t10t5ltwui.execute-api.eu-north-1.amazonaws.com/prod";

      const url = password
        ? `${apiUrl}/share/${shareId}?download=true&password=${encodeURIComponent(
            password
          )}`
        : `${apiUrl}/share/${shareId}?download=true`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Unable to download file");
      }

      const data = await response.json();

      // Trigger download using the URL from the response
      window.location.href = data.data.downloadUrl;

      // Update downloads remaining for ephemeral shares
      if (downloadsRemaining !== null) {
        setDownloadsRemaining(Math.max(0, downloadsRemaining - 1));
      }
    } catch (err) {
      alert("Failed to download file");
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError("Please enter a password");
      return;
    }
    setPasswordError("");
    // Trigger refetch with password
    setRefetchTrigger((prev) => prev + 1);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyLink = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 3000);
    } catch (err) {
      alert("Failed to copy link");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (contentType) => {
    if (!contentType) return "📄";
    if (contentType.startsWith("image/")) return "🖼️";
    if (contentType.startsWith("video/")) return "🎥";
    if (contentType.startsWith("audio/")) return "🎵";
    if (contentType.includes("pdf")) return "📕";
    if (contentType.includes("word")) return "📘";
    if (contentType.includes("excel") || contentType.includes("spreadsheet"))
      return "📊";
    if (
      contentType.includes("powerpoint") ||
      contentType.includes("presentation")
    )
      return "📽️";
    if (contentType.includes("zip") || contentType.includes("rar")) return "🗜️";
    return "📄";
  };

  const canPreview = (contentType) => {
    if (!contentType) return false;
    return (
      contentType.startsWith("image/") ||
      contentType === "application/pdf" ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType.startsWith("text/")
    );
  };

  console.log("🎨 Render state:", {
    isLoading,
    error,
    requiresPassword,
    hasFileData: !!fileData,
  });

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Loading shared file...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <ErrorMessage message={error} />
      </div>
    );
  }

  // Password protection screen
  if (requiresPassword) {
    console.log(
      "🔐 Rendering password form, requiresPassword:",
      requiresPassword
    );
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.passwordPrompt}>
            <div className={styles.lockIcon}>🔒</div>
            <h1 className={styles.passwordTitle}>Password Protected</h1>
            <p className={styles.passwordDescription}>
              This file is protected. Enter the password to access it.
            </p>
            <form
              onSubmit={handlePasswordSubmit}
              className={styles.passwordForm}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.passwordInput}
                autoFocus
              />
              {passwordError && (
                <p className={styles.passwordError}>{passwordError}</p>
              )}
              <button
                type="submit"
                className={styles.unlockButton}
                disabled={isLoading}
              >
                {isLoading ? "Unlocking..." : "🔓 Unlock"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!fileData) {
    return (
      <div className={styles.container}>
        <ErrorMessage message="File not found" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {showCopyNotification && (
        <div className={styles.copyNotification}>
          ✓ Link copied to clipboard!
        </div>
      )}
      <div className={styles.card}>
        {/* Ephemeral warning banner */}
        {timeRemaining !== null && timeRemaining > 0 && (
          <div className={styles.ephemeralBanner}>
            <span className={styles.ephemeralIcon}>⏳</span>
            <span className={styles.ephemeralText}>
              Self-destructs in: <strong>{formatTime(timeRemaining)}</strong>
            </span>
          </div>
        )}

        {/* Downloads remaining badge */}
        {downloadsRemaining !== null && (
          <div className={styles.downloadsBadge}>
            <span className={styles.downloadsIcon}>⬇️</span>
            <span className={styles.downloadsText}>
              {downloadsRemaining}{" "}
              {downloadsRemaining === 1 ? "download" : "downloads"} remaining
            </span>
          </div>
        )}

        <div className={styles.header}>
          <div className={styles.icon}>{getFileIcon(fileData.contentType)}</div>
          <div className={styles.fileInfo}>
            <h1 className={styles.fileName}>{fileData.fileName}</h1>
            <p className={styles.fileSize}>
              {formatFileSize(fileData.fileSize)}
            </p>
            {fileData.expiresAt && (
              <p className={styles.expires}>
                Expires: {new Date(fileData.expiresAt).toLocaleDateString()}
              </p>
            )}
            {fileData.downloadLimit && (
              <p className={styles.downloadInfo}>
                Downloads: {fileData.downloadCount} / {fileData.downloadLimit}
              </p>
            )}
          </div>
        </div>

        {canPreview(fileData.contentType) && (
          <div className={styles.preview}>
            {fileData.contentType.startsWith("image/") && (
              <img
                src={fileData.downloadUrl}
                alt={fileData.fileName}
                className={styles.previewImage}
              />
            )}
            {fileData.contentType === "application/pdf" && (
              <iframe
                src={fileData.downloadUrl}
                className={styles.previewIframe}
                title={fileData.fileName}
              />
            )}
            {fileData.contentType.startsWith("video/") && (
              <video
                src={fileData.downloadUrl}
                controls
                className={styles.previewVideo}
              >
                Your browser does not support video playback.
              </video>
            )}
            {fileData.contentType.startsWith("audio/") && (
              <audio
                src={fileData.downloadUrl}
                controls
                className={styles.previewAudio}
              >
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        )}

        {!canPreview(fileData.contentType) && (
          <div className={styles.noPreview}>
            <div className={styles.noPreviewIcon}>
              {getFileIcon(fileData.contentType)}
            </div>
            <p className={styles.noPreviewText}>
              Preview not available for this file type
            </p>
            <p className={styles.noPreviewHint}>
              Click download below to get the file
            </p>
          </div>
        )}

        <div className={styles.actions}>
          <button onClick={handleDownload} className={styles.downloadButton}>
            ⬇️ Download
          </button>
          <button onClick={handleCopyLink} className={styles.copyButton}>
            🔗 Copy Link
          </button>
        </div>

        <div className={styles.footer}>
          <p className={styles.poweredBy}>
            Shared via <strong>Dropify</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedFile;
