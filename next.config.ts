import type { NextConfig } from "next";

// clerk.licenseresizer.com / accounts.licenseresizer.com are the production
// Clerk instance's custom-domain hosts; the wildcard Clerk entries only cover
// development instances, so without these the sign-in flow cannot load.
const clerkHosts = "https://clerk.licenseresizer.com https://accounts.licenseresizer.com https://*.clerk.accounts.dev https://*.clerk.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${clerkHosts} https://challenges.cloudflare.com https://www.googletagmanager.com https://tagmanager.google.com`,
  `script-src-elem 'self' 'unsafe-inline' ${clerkHosts} https://challenges.cloudflare.com https://www.googletagmanager.com https://tagmanager.google.com`,
  "worker-src 'self' blob:",
  "img-src 'self' blob: data: https://img.clerk.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://ssl.gstatic.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${clerkHosts} https://clerk-telemetry.com https://*.clerk-telemetry.com https://*.neon.tech https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://tagassistant.google.com`,
  `frame-src ${clerkHosts} https://challenges.cloudflare.com https://www.googletagmanager.com https://tagassistant.google.com`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${clerkHosts}`,
  "frame-ancestors 'self' https://tagassistant.google.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
