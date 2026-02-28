/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
      });
    }
    return config;
  },
}

module.exports = nextConfig
