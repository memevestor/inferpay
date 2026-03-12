/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["node-sqlite3-wasm"],
  },
};

export default nextConfig;
