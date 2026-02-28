"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * OAuth error page
 * 
 * This page displays user-friendly error messages when OAuth authentication fails.
 * It provides helpful information and allows users to retry authentication.
 * 
 * Requirements: 14.2, 14.13
 */
export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Map error codes to user-friendly messages
  const getErrorDetails = (errorCode: string | null) => {
    switch (errorCode) {
      case "Configuration":
        return {
          title: "Server Configuration Error",
          description:
            "There is a problem with the server configuration. Please contact support.",
          canRetry: false,
        };
      case "AccessDenied":
        return {
          title: "Access Denied",
          description:
            "You denied access to your Google account. To use this app, you need to grant permission.",
          canRetry: true,
        };
      case "Verification":
        return {
          title: "Verification Failed",
          description:
            "The verification token has expired or has already been used. Please try signing in again.",
          canRetry: true,
        };
      case "OAuthSignin":
        return {
          title: "OAuth Sign-In Error",
          description:
            "There was an error starting the OAuth sign-in flow. Please try again.",
          canRetry: true,
        };
      case "OAuthCallback":
        return {
          title: "OAuth Callback Error",
          description:
            "There was an error processing the OAuth callback. Please try signing in again.",
          canRetry: true,
        };
      case "OAuthCreateAccount":
        return {
          title: "Account Creation Error",
          description:
            "We couldn't create your account. Please try again or contact support if the problem persists.",
          canRetry: true,
        };
      case "EmailCreateAccount":
        return {
          title: "Email Account Error",
          description:
            "We couldn't create an account with this email. Please try again.",
          canRetry: true,
        };
      case "Callback":
        return {
          title: "Callback Error",
          description:
            "There was an error in the authentication callback. Please try signing in again.",
          canRetry: true,
        };
      case "OAuthAccountNotLinked":
        return {
          title: "Account Already Exists",
          description:
            "An account with this email already exists but is not linked to Google. Please sign in using your original method.",
          canRetry: false,
        };
      case "EmailSignin":
        return {
          title: "Email Sign-In Error",
          description:
            "We couldn't send you a sign-in email. Please check your email address and try again.",
          canRetry: true,
        };
      case "CredentialsSignin":
        return {
          title: "Sign-In Failed",
          description:
            "The credentials you provided are incorrect. Please check and try again.",
          canRetry: true,
        };
      case "SessionRequired":
        return {
          title: "Session Required",
          description:
            "You need to be signed in to access this page. Please sign in to continue.",
          canRetry: true,
        };
      case "Default":
      default:
        return {
          title: "Authentication Error",
          description:
            "An unexpected error occurred during authentication. Please try again.",
          canRetry: true,
        };
    }
  };

  const errorDetails = getErrorDetails(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            {errorDetails.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{errorDetails.description}</p>
        </div>

        {/* Error details card */}
        <div className="rounded-lg bg-white px-6 py-8 shadow-md">
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-gray-50 p-4">
                <div className="text-xs font-mono text-gray-500">
                  Error Code: {error}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {errorDetails.canRetry ? (
                <Link
                  href="/auth/signin"
                  className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  Try Again
                </Link>
              ) : (
                <Link
                  href="/"
                  className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
                >
                  Go to Home
                </Link>
              )}

              <Link
                href="/"
                className="flex w-full items-center justify-center rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-gray-500">
          <p>
            If you continue to experience issues, please contact support or try
            again later.
          </p>
        </div>
      </div>
    </div>
  );
}
