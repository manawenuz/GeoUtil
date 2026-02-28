"use client";

import { useState } from "react";

/**
 * Manual Refresh Component
 * 
 * This component provides manual balance refresh functionality for utility accounts.
 * It displays a refresh button per account, shows loading state during checks,
 * displays error messages, and shows success confirmation.
 * 
 * Requirements: 3.4
 */

interface ManualRefreshProps {
  accountId: string;
  accountName: string;
  onRefreshComplete?: () => void;
}

interface RefreshResult {
  success: boolean;
  balance?: number;
  currency?: string;
  timestamp?: string;
  overdueDays?: number;
  error?: string;
  responseTime?: number;
}

export default function ManualRefresh({ 
  accountId, 
  accountName,
  onRefreshComplete 
}: ManualRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setResult(null);
      setShowResult(false);

      const res = await fetch("/api/balances/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          error: data.message || data.error || "Failed to check balance",
        });
      } else {
        setResult(data);
      }

      setShowResult(true);

      // Auto-hide success message after 5 seconds
      if (data.success) {
        setTimeout(() => {
          setShowResult(false);
        }, 5000);
      }

      // Notify parent component to refresh data
      if (onRefreshComplete) {
        onRefreshComplete();
      }

    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred",
      });
      setShowResult(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatBalance = (balance: number | undefined, currency: string | undefined) => {
    if (balance === undefined) return "—";
    const symbol = currency === "GEL" ? "₾" : currency || "";
    return `${symbol}${balance.toFixed(2)}`;
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-2">
      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Check current balance"
      >
        <svg
          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        {isRefreshing ? "Checking..." : "Refresh"}
      </button>

      {/* Loading State */}
      {isRefreshing && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-center gap-2">
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
            <span>Checking balance for {accountName}...</span>
          </div>
        </div>
      )}

      {/* Result Messages */}
      {showResult && result && (
        <>
          {/* Success Message */}
          {result.success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 border border-green-200">
              <div className="flex items-start gap-2">
                <svg
                  className="h-5 w-5 flex-shrink-0 mt-0.5"
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
                <div className="flex-1">
                  <p className="font-medium">Balance updated successfully</p>
                  <div className="mt-2 space-y-1">
                    <p>
                      <span className="font-semibold">Current Balance:</span>{" "}
                      {formatBalance(result.balance, result.currency)}
                    </p>
                    {result.overdueDays !== undefined && result.overdueDays > 0 && (
                      <p>
                        <span className="font-semibold">Overdue:</span>{" "}
                        {result.overdueDays} day{result.overdueDays !== 1 ? 's' : ''}
                      </p>
                    )}
                    {result.timestamp && (
                      <p className="text-xs text-green-700">
                        Checked at {formatTimestamp(result.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowResult(false)}
                  className="flex-shrink-0 text-green-600 hover:text-green-500"
                  aria-label="Dismiss"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {!result.success && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              <div className="flex items-start gap-2">
                <svg
                  className="h-5 w-5 flex-shrink-0 mt-0.5"
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
                <div className="flex-1">
                  <p className="font-medium">Failed to check balance</p>
                  <p className="mt-1">{result.error}</p>
                  <p className="mt-2 text-xs text-red-700">
                    Please try again later or contact support if the problem persists.
                  </p>
                </div>
                <button
                  onClick={() => setShowResult(false)}
                  className="flex-shrink-0 text-red-600 hover:text-red-500"
                  aria-label="Dismiss"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
