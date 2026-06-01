import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arthromed.mx',
      },
      {
        protocol: 'https',
        hostname: 'arthromed.com.mx',
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: '/register',
        destination: '/registro',
        permanent: true,
      },
    ]
  },
}

export default nextConfig

// Trigger server reload to pick up updated Prisma Client schema changes (reload at 2026-05-25 11:32)
