import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const GTM_CONTAINER_ID = "GTM-KT4RJD74";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;
  const title = "LicenseResizer — Private license collection for dealerships";
  const description = "Give customers a branded link to create and deliver clean, true-size driver's-license PDFs—without storing their license images.";
  return {
    metadataBase,
    title,
    description,
    applicationName: "LicenseResizer",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: "/og.png", width: 1536, height: 896, alt: "LicenseResizer private license collection for dealerships" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const appContent = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? <ClerkProvider>{children}</ClerkProvider>
    : children;

  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`,
          }}
        />
        {/* End Google Tag Manager */}
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {appContent}
        <Analytics />
      </body>
    </html>
  );
}
