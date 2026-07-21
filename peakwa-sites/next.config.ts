import type { NextConfig } from 'next';

const isSearchIndexable =
  process.env.NEXT_PUBLIC_ALLOW_SEARCH_INDEXING === 'true' ||
  (process.env.NEXT_PUBLIC_ALLOW_SEARCH_INDEXING !== 'false' &&
    !/(localhost|127\.0\.0\.1)/.test(process.env.NEXT_PUBLIC_SITE_BASE_URL ?? ''));

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.pexels.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: isSearchIndexable ? 'index, follow' : 'noindex, nofollow',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
