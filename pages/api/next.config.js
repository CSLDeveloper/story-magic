/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Extend API route timeout to 5 minutes for image generation
  serverRuntimeConfig: {
    apiTimeout: 300,
  },
  experimental: {
    // Allow longer running API routes on Render
    proxyTimeout: 300000,
  },
}

module.exports = nextConfig
