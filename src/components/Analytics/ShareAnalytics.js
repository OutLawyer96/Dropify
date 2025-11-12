import React, { useEffect, useState } from "react";
import LoadingSpinner from "../Common/LoadingSpinner";
import ErrorMessage from "../Common/ErrorMessage";
import apiService from "../../services/api";
import styles from "./ShareAnalytics.module.css";

const ShareAnalytics = ({ shareId, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log("📊 Fetching analytics for shareId:", shareId);
        
        const data = await apiService.sharing.getAnalytics(shareId);
        console.log("📊 Raw analytics data received:", data);
        console.log("📊 Data structure:", {
          hasSummary: !!data?.summary,
          hasBreakdown: !!data?.breakdown,
          hasRecentActivity: !!data?.recentActivity,
          summary: data?.summary,
          breakdown: data?.breakdown,
          recentActivity: data?.recentActivity
        });
        setAnalytics(data);
      } catch (err) {
        console.error("📊 Error fetching analytics:", err);
        console.error("📊 Error details:", {
          message: err.message,
          response: err.response,
          stack: err.stack
        });
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (shareId) {
      fetchAnalytics();
    }
  }, [shareId]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatPercentage = (value, total) => {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  };

  console.log("📊 Render state:", { isLoading, error, hasAnalytics: !!analytics });

  if (isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <LoadingSpinner />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <ErrorMessage message={error} />
          <button onClick={onClose} className={styles.closeButton}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Map backend response structure to component expectations
  const summary = analytics.summary || {};
  const totalViews = summary.totalViews || 0;
  const totalDownloads = summary.totalDownloads || 0;
  const totalInteractions = totalViews + totalDownloads;
  const hasData = totalInteractions > 0;

  const deviceBreakdown = analytics.breakdown?.devices || {};
  const browserBreakdown = analytics.breakdown?.browsers || {};
  const recentActivity = analytics.recentActivity || [];

  console.log("📊 Render values:", {
    totalViews,
    totalDownloads,
    totalInteractions,
    hasData,
    deviceBreakdown,
    browserBreakdown,
    recentActivityLength: recentActivity.length
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>📊 Share Link Analytics</h2>
          <button onClick={onClose} className={styles.closeIcon}>
            ✕
          </button>
        </div>

        {/* Summary Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>👁️</div>
            <div className={styles.statValue}>{totalViews}</div>
            <div className={styles.statLabel}>Total Views</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⬇️</div>
            <div className={styles.statValue}>{totalDownloads}</div>
            <div className={styles.statLabel}>Total Downloads</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🔗</div>
            <div className={styles.statValue}>{totalInteractions}</div>
            <div className={styles.statLabel}>Total Interactions</div>
          </div>
        </div>

        {!hasData && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <h3>No Activity Yet</h3>
            <p>
              Share this link with others to start tracking views and downloads!
            </p>
            <p className={styles.emptyHint}>
              Analytics are tracked when someone accesses your shared file.
            </p>
          </div>
        )}

        {/* Device Breakdown */}
        {hasData &&
          deviceBreakdown &&
          Object.keys(deviceBreakdown).length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📱 Device Breakdown</h3>
              <div className={styles.breakdown}>
                {Object.entries(deviceBreakdown).map(([device, count]) => (
                  <div key={device} className={styles.breakdownItem}>
                    <div className={styles.breakdownLabel}>{device}</div>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownFill}
                        style={{
                          width: formatPercentage(count, totalInteractions),
                        }}
                      ></div>
                    </div>
                    <div className={styles.breakdownValue}>
                      {count} ({formatPercentage(count, totalInteractions)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Browser Breakdown */}
        {hasData &&
          browserBreakdown &&
          Object.keys(browserBreakdown).length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>🌐 Browser Breakdown</h3>
              <div className={styles.breakdown}>
                {Object.entries(browserBreakdown).map(([browser, count]) => (
                  <div key={browser} className={styles.breakdownItem}>
                    <div className={styles.breakdownLabel}>{browser}</div>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownFill}
                        style={{
                          width: formatPercentage(count, totalInteractions),
                        }}
                      ></div>
                    </div>
                    <div className={styles.breakdownValue}>
                      {count} ({formatPercentage(count, totalInteractions)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Recent Activity */}
        {hasData && recentActivity && recentActivity.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>📝 Recent Activity</h3>
            <div className={styles.activityList}>
              {recentActivity.map((activity, index) => (
                <div key={index} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    {activity.action === "download" ? "⬇️" : "👁️"}
                  </div>
                  <div className={styles.activityDetails}>
                    <div className={styles.activityAction}>
                      {activity.action === "download" ? "Downloaded" : "Viewed"}
                    </div>
                    <div className={styles.activityMeta}>
                      {activity.device && `${activity.device} • `}
                      {activity.browser && `${activity.browser} • `}
                      {formatDate(activity.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Chart */}
        {hasData &&
          analytics.timeline &&
          Object.keys(analytics.timeline).length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📈 Activity Timeline</h3>
              <div className={styles.timeline}>
                {Object.entries(analytics.timeline)
                  .slice(-24) // Show last 24 hours
                  .map(([hour, data]) => {
                    const maxValue = Math.max(
                      ...Object.values(analytics.timeline).map(
                        (d) => d.views + d.downloads
                      )
                    );
                    const totalActivity = data.views + data.downloads;
                    const height =
                      maxValue > 0 ? (totalActivity / maxValue) * 100 : 0;

                    return (
                      <div key={hour} className={styles.timelineBar}>
                        <div
                          className={styles.timelineBarFill}
                          style={{ height: `${height}%` }}
                          title={`${hour}: ${totalActivity} interactions`}
                        ></div>
                        <div className={styles.timelineLabel}>
                          {hour.split(" ")[1]}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.closeButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareAnalytics;
