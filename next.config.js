/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Ignore optional dependencies that cause warnings
    if (isServer) {
      config.externals.push({
        'pg-native': 'commonjs pg-native',
        'better-sqlite3': 'commonjs better-sqlite3',
      });
    }
    return config;
  },
}

module.exports = nextConfig
