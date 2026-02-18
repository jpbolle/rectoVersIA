import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers pour résoudre les problèmes COOP avec Firebase Auth popups
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
