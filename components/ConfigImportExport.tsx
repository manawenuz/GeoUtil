"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Configuration Import/Export Component
 * 
 * This component provides configuration backup and restore functionality.
 * It allows users to export their configuration as JSON and import
 * configuration from a JSON file.
 * 
 * Requirements: 18.1, 18.2, 18.3
 */

interface ImportSummary {
  message: string;
  imported: number;
  failed: number;
  total: number;
  errors?: string[];
}

export default function ConfigImportExport() {
  const { status } = useSession();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await fetch("/api/config/export");

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to export configuration");
      }

      // Get the JSON data
      const configData = await res.json();

      // Create a blob and download it
      const blob = new Blob([JSON.stringify(configData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `utility-monitor-config-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export configuration");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportSummary(null);

    try {
      // Read file content
      const fileContent = await file.text();

      // Validate JSON
      let configData;
      try {
        configData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error("Invalid JSON file. Please upload a valid configuration file.");
      }

      // Send to import endpoint
      const res = await fetch("/api/config/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData),
      });

      const result = await res.json();

      if (!res.ok && res.status !== 207) {
        // 207 is partial success
        throw new Error(result.message || "Failed to import configuration");
      }

      // Display import summary
      setImportSummary(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import configuration");
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        Please sign in to manage configuration backup and restore.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuration Backup & Restore</h2>
        <p className="mt-1 text-sm text-gray-500">
          Export your configuration for backup or import a previously saved configuration
        </p>
      </div>

      {/* Export Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Export Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Download your current configuration as a JSON file
            </p>
          </div>
          <svg
            className="h-8 w-8 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </div>

        {exportError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
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
              {exportError}
            </div>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
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
              Exporting...
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
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Export Configuration
            </>
          )}
        </button>

        <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
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
            <div>
              The exported file contains your account configurations. Store it securely as it
              includes encrypted account information.
            </div>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Import Configuration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Restore your configuration from a previously exported JSON file
            </p>
          </div>
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        {importError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
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
              {importError}
            </div>
          </div>
        )}

        {importSummary && (
          <div
            className={`mb-4 rounded-md p-4 ${
              importSummary.failed === 0
                ? "bg-green-50 text-green-800"
                : importSummary.imported > 0
                ? "bg-yellow-50 text-yellow-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                {importSummary.failed === 0 ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                )}
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold mb-2">Import Summary</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Total accounts:</span> {importSummary.total}
                  </p>
                  <p>
                    <span className="font-medium">Successfully imported:</span>{" "}
                    {importSummary.imported}
                  </p>
                  {importSummary.failed > 0 && (
                    <p>
                      <span className="font-medium">Failed:</span> {importSummary.failed}
                    </p>
                  )}
                </div>
                {importSummary.errors && importSummary.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium mb-1">Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {importSummary.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="config-file-upload"
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
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
                Importing...
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                Choose File to Import
              </>
            )}
          </label>
          <input
            id="config-file-upload"
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            disabled={isImporting}
            className="hidden"
          />
        </div>

        <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div>
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Only import configuration files exported from this application</li>
                <li>Importing will add accounts to your existing configuration</li>
                <li>Duplicate accounts may be created if you import the same file multiple times</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
