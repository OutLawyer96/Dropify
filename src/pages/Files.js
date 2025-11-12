import React, { useCallback, useEffect, useMemo, useState } from "react";
import ErrorMessage from "../components/Common/ErrorMessage";
import LoadingSpinner from "../components/Common/LoadingSpinner";
import FileList from "../components/Upload/FileList";
import ShareAnalytics from "../components/Analytics/ShareAnalytics";
import ShareOptionsModal from "../components/Share/ShareOptionsModal";
import { useApiService } from "../services/api";
import { FILE_UPLOAD, UI, FEATURES } from "../utils/constants";
import styles from "./Files.module.css";

const Files = () => {
  const apiService = useApiService();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("date_desc");
  const [filterBy, setFilterBy] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [shareNotification, setShareNotification] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(null);
  const [showShareModal, setShowShareModal] = useState(null);

  const filterOptions = useMemo(
    () => [
      { label: "All types", value: "" },
      ...Object.keys(FILE_UPLOAD.TYPE_CATEGORIES).map((key) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: key,
      })),
    ],
    []
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchTerm),
      UI.DEBOUNCE_DELAY
    );
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchFiles = useCallback(
    async ({ reset = false, cursor } = {}) => {
      if (reset) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await apiService.files.list({
          limit: UI.DEFAULT_PAGE_SIZE,
          lastKey: cursor,
          sortBy,
          filterBy: filterBy || undefined,
          searchTerm: debouncedSearch || undefined,
        });

        setFiles((prev) =>
          reset ? response.files || [] : [...prev, ...(response.files || [])]
        );
        setLastKey(response.nextKey ?? null);
        setHasMore(Boolean(response.hasMore));
      } catch (requestError) {
        setError(requestError.message || "Unable to load files");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [apiService.files, debouncedSearch, filterBy, sortBy]
  );

  useEffect(() => {
    setLastKey(null);
    fetchFiles({ reset: true });
  }, [fetchFiles]);

  const handleDelete = useCallback(
    async (fileId) => {
      try {
        await apiService.files.delete(fileId);
        setFiles((current) =>
          current.filter((file) => file.fileId !== fileId && file.id !== fileId)
        );
      } catch (deleteError) {
        setError(deleteError.message || "Unable to delete file");
      }
    },
    [apiService.files]
  );

  const handleShare = useCallback(
    async (fileId, options = {}) => {
      if (!FEATURES.ADVANCED_SHARING) {
        setError("Share feature is not yet available");
        return;
      }
      try {
        const shareData = await apiService.sharing.generateLink(
          fileId,
          options
        );

        // Use current origin for share URL (works in both dev and production)
        const baseUrl =
          process.env.REACT_APP_PUBLIC_URL || window.location.origin;
        const shareUrl = `${baseUrl}/share/${shareData.linkId}`;

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          setShareNotification({
            url: shareUrl,
            show: true,
            isEphemeral: shareData.isEphemeral,
            hasPassword: shareData.hasPassword,
          });
          setTimeout(() => {
            setShareNotification(null);
          }, 5000);
        } else {
          // Fallback for older browsers
          alert(
            `Share link created!\n\n${shareUrl}\n\nCopy this link to share the file.`
          );
        }

        setShowShareModal(null);
      } catch (shareError) {
        setError(shareError.message || "Unable to generate share link");
      }
    },
    [apiService.sharing]
  );

  const handleShareClick = useCallback((fileOrId) => {
    console.log("🟢 handleShareClick - Received:", fileOrId);

    // Handle both cases: fileId string or file object
    const fileId =
      typeof fileOrId === "string"
        ? fileOrId
        : fileOrId.fileId || fileOrId.id || fileOrId.fileKey;

    const fileName =
      typeof fileOrId === "object"
        ? fileOrId.name || fileOrId.fileName
        : "File";

    console.log("🟢 Setting modal with fileId:", fileId, "fileName:", fileName);

    setShowShareModal({
      fileId: fileId,
      fileName: fileName,
    });
  }, []);

  const handleView = useCallback(
    async (fileId) => {
      try {
        const fileDetails = await apiService.files.get(fileId);
        if (fileDetails?.downloadUrl) {
          window.open(fileDetails.downloadUrl, "_blank", "noopener");
        }
      } catch (detailsError) {
        setError(detailsError.message || "Unable to open file");
      }
    },
    [apiService.files]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchFiles({ reset: false, cursor: lastKey });
  }, [fetchFiles, hasMore, isLoadingMore, lastKey]);

  const handleShowAnalytics = useCallback(
    async (fileId) => {
      if (!FEATURES.ANALYTICS) {
        setError("Analytics feature is not yet available");
        return;
      }
      try {
        // Get the share ID for this file
        const shareLinks = await apiService.sharing.listLinks(fileId);
        if (shareLinks && shareLinks.length > 0) {
          // Show analytics for the first (most recent) share link
          setShowAnalytics(shareLinks[0].linkId);
        } else {
          setError(
            "No share links found for this file. Share the file first to view analytics."
          );
        }
      } catch (err) {
        setError(err.message || "Unable to load analytics");
      }
    },
    [apiService.sharing]
  );

  return (
    <div className={styles.files}>
      {showShareModal && (
        <ShareOptionsModal
          fileId={showShareModal.fileId}
          fileName={showShareModal.fileName}
          onShare={handleShare}
          onClose={() => setShowShareModal(null)}
        />
      )}

      {showAnalytics && (
        <ShareAnalytics
          shareId={showAnalytics}
          onClose={() => setShowAnalytics(null)}
        />
      )}

      {shareNotification && shareNotification.show && (
        <div className={styles.shareNotification}>
          <div className={styles.notificationContent}>
            <div className={styles.notificationIcon}>✓</div>
            <div className={styles.notificationText}>
              <strong>Share link copied!</strong>
              <p className={styles.shareUrl}>{shareNotification.url}</p>
              <small>
                {shareNotification.isEphemeral &&
                  "⏳ Self-destructs after first view • "}
                {shareNotification.hasPassword && "🔒 Password protected • "}
                Anyone with this link can view and download the file
              </small>
            </div>
            <button
              className={styles.closeNotification}
              onClick={() => setShareNotification(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="container">
        <div className={styles.filesHeader}>
          <h1 className={styles.filesTitle}>My Files</h1>
          <p className={styles.filesSubtitle}>
            Manage your uploaded files, view sharing links, and organize your
            content.
          </p>
        </div>

        <div className={styles.filesContent}>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search files by name"
              />
            </div>

            <div className={styles.controlGroup}>
              <label htmlFor="sort">Sort by</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {UI.SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label htmlFor="filter">Filter</label>
              <select
                id="filter"
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value)}
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className={styles.errorContainer}>
              <ErrorMessage error={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {isLoading ? (
            <LoadingSpinner fullScreen message="Loading your files" />
          ) : (
            <FileList
              files={files}
              onDelete={handleDelete}
              onShare={FEATURES.ADVANCED_SHARING ? handleShareClick : undefined}
              onView={handleView}
              onAnalytics={FEATURES.ANALYTICS ? handleShowAnalytics : undefined}
              isLoading={isLoadingMore}
            />
          )}

          {hasMore && !sortBy.startsWith("name_") && (
            <div className={styles.loadMore}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Files;
