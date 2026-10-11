import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Date du build, affichée en pied de page (« Application mise à jour le … »).
  // Le VPS reconstruit à chaque déploiement : c'est donc la date de mise en ligne.
  env: {
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
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
