/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["node-sqlite3-wasm"],
  },
  eslint: {
    // ESLint is run separately via CI; skip during next build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
