import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // transpilePackages ensures Next.js processes the DS ESM through its pipeline,
  // which is what triggers RSC boundary checking.
  transpilePackages: ['@lando-labs/lando-ds'],
}

export default nextConfig
