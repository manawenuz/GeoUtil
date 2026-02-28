"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Notification Configuration Component
 * 
 * This component allows users to configure their ntfy.sh notification settings.
 * It provides inputs for the feed URL and server URL, a button to send a test
 * notification, and displays instructions on how to subscribe to the notification
 * feed via web or mobile app.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

interface NotificationConfig {
  ntfyFeedUrl: string;
  ntfyServerUrl: string;
  notificationEnabled: boolean;
}

export default function NotificationConfig() {
  const { status } = useSession();
  const [config, setConfig] = useState<NotificationConfig>({
    ntfyFeedUrl: "",
    ntfyServerUrl: "https://ntfy.sh",
    notificationEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ntfyFeedUrl: "",
    ntfyServerUrl: "https://ntfy.sh",
  });

  // Load notification configuration
  useEffect(() => {
    if (status === "authenticated") {
      loadConfig();
    }
  }, [status]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/notifications/config");

      if (!res.ok) {
        throw new Error("Failed to load notification configuration");
      }

      const data = await res.json();
      setConfig(data);
      setFormData({
        ntfyFeedUrl: data.ntfyFeedUrl || "",
        ntfyServerUrl: data.ntfyServerUrl || "https://ntfy.sh",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setFormData({
      ntfyFeedUrl: config.ntfyFeedUrl,
      ntfyServerUrl: config.ntfyServerUrl,
    });
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      ntfyFeedUrl: config.ntfyFeedUrl,
      ntfyServerUrl: config.ntfyServerUrl,
    });
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Validate URLs
      if (!formData.ntfyFeedUrl || !formData.ntfyServerUrl) {
        throw new Error("Please fill in all fields");
      }

      const res = await fetch("/api/notifications/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ntfyFeedUrl: formData.ntfyFeedUrl,
          ntfyServerUrl: formData.ntfyServerUrl,
          notificationEnabled: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to save configuration");
      }

      // Reload configuration and exit edit mode
      await loadConfig();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTestError(null);
    setTestSuccess(null);
    setIsTesting(true);

    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send test notification");
      }

      setTestSuccess("Test notification sent successfully! Check your ntfy.sh app or web interface.");
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Failed to send test notification");
    } finally {
      setIsTesting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        Please sign in to configure notifications.
      </div>
    );
  }

  const hasConfiguration = config.ntfyFeedUrl && config.ntfyServerUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notification Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure ntfy.sh notifications to receive alerts about your utility bills
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {!isEditing && hasConfiguration ? (
          // Display mode
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Current Configuration</h3>
              <button
                onClick={handleEdit}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
                Edit
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ntfy.sh Feed URL
              </label>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-gray-900 font-mono text-sm break-all">
                {config.ntfyFeedUrl}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ntfy.sh Server URL
              </label>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-gray-900 font-mono text-sm">
                {config.ntfyServerUrl}
              </div>
            </div>

            {/* Test Notification Button */}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={handleTestNotification}
                disabled={isTesting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                    Send Test Notification
                  </>
                )}
              </button>

              {testSuccess && (
                <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {testSuccess}
                  </div>
                </div>
              )}

              {testError && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {testError}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Edit mode
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {hasConfiguration ? "Edit Configuration" : "Configure Notifications"}
            </h3>

            {/* ntfy.sh Feed URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ntfy.sh Feed URL
              </label>
              <input
                type="url"
                value={formData.ntfyFeedUrl}
                onChange={(e) =>
                  setFormData({ ...formData, ntfyFeedUrl: e.target.value })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://ntfy.sh/your-unique-topic"
                disabled={isSaving}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Your unique ntfy.sh topic URL (e.g., https://ntfy.sh/my-utility-monitor-abc123)
              </p>
            </div>

            {/* ntfy.sh Server URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ntfy.sh Server URL
              </label>
              <input
                type="url"
                value={formData.ntfyServerUrl}
                onChange={(e) =>
                  setFormData({ ...formData, ntfyServerUrl: e.target.value })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://ntfy.sh"
                disabled={isSaving}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Use https://ntfy.sh for the public server, or your self-hosted instance URL
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </button>
              {hasConfiguration && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Subscription Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          How to Subscribe to Notifications
        </h3>
        <div className="space-y-4 text-sm text-blue-900">
          <div>
            <h4 className="font-semibold mb-2">📱 Mobile App (Recommended)</h4>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Download the ntfy.sh app from the App Store or Google Play</li>
              <li>Open the app and tap the "+" button to add a subscription</li>
              <li>Enter your topic name from the Feed URL above (the part after the last /)</li>
              <li>If using a self-hosted server, change the server URL in settings</li>
              <li>You'll receive push notifications when bills are due!</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">🌐 Web Browser</h4>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Visit your Feed URL in a web browser</li>
              <li>Click "Subscribe" and allow notifications when prompted</li>
              <li>Keep the tab open or enable background notifications</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">💡 Tips</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Choose a unique, hard-to-guess topic name for security</li>
              <li>You can subscribe to the same topic on multiple devices</li>
              <li>Use the "Send Test Notification" button above to verify your setup</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
