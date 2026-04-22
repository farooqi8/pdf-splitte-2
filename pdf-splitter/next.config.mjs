/** @type {import('next').NextConfig} */
const nextConfig = {
  // In dev, Strict Mode’s mount–unmount–remount can clear file inputs and ref-based upload state.
  reactStrictMode: false,
  // Let Node load pdfjs from node_modules; webpack bundling breaks pdf.mjs (defineProperty errors).
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', '@thednp/dommatrix'],
  },
}

export default nextConfig
