import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com; worker-src 'self' blob:; img-src 'self' blob: data: https://img.clerk.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.neon.tech; frame-src https://*.clerk.accounts.dev https://*.clerk.com; object-src 'none'; base-uri 'self'; form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com; frame-ancestors 'none'; upgrade-insecure-requests" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
