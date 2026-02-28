"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Sign-out button component
 * 
 * This component provides a button to sign out the current user.
 * It handles loading states and redirects to the home page after sign-out.
 * 
 * Requirements: 14.13
 */
interface SignOutButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  children?: React.ReactNode;
}

export default function SignOutButton({
  className = "",
  variant = "secondary",
  children = "Sign Out",
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut({
        callbackUrl: "/",
      });
    } catch (error) {
      console.error("Sign-out error:", error);
      setIsLoading(false);
    }
  };

  const variantClasses = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600",
    secondary:
      "bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-gray-600",
    danger:
      "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600",
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 
        text-sm font-semibold shadow-sm transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isLoading ? (
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
          <span>Signing out...</span>
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
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          </svg>
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
