import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/auth/SessionProvider";
import Navigation from "@/components/Navigation";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import UserMenu from "@/components/auth/UserMenu";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Georgia Utility Monitor",
  description: "Monitor utility bills across multiple providers in Georgia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Utility Monitor",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0070f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Utility Monitor" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-gray-50">
        <SessionProvider>
          <ServiceWorkerRegistration />
          <InstallPrompt />
          <div className="min-h-screen flex flex-col">
            {/* Header with navigation and user menu */}
            <header className="bg-white shadow-sm sticky top-0 z-50">
              <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Georgia Utility Monitor
                  </h1>
                  <UserMenu />
                </div>
              </div>
              <Navigation />
            </header>

            {/* Main content */}
            <main className="flex-1">
              {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
              <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <p className="text-center text-sm text-gray-500">
                  © {new Date().getFullYear()} Georgia Utility Monitor. Monitor your utility bills with ease.
                </p>
              </div>
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
