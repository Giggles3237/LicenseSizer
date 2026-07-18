# Architecture

LicenseSizer is a Next.js application deployed to Vercel. It combines a public, browser-only license capture workflow with a server-side dealership control plane.

## Customer data flow

1. A customer opens `/d/[slug]`; the server returns only the dealership's delivery and PDF policy.
2. The browser captures or selects an image and runs validation, edge detection, quality analysis, crop correction, and PDF composition locally.
3. The customer reviews the corrected front/back images.
4. The browser generates the PDF at the dealer-administered geometry and quality settings.
5. The customer invokes the native share sheet, downloads the PDF, or opens an email/text fallback.
6. The browser drops image/PDF references when the customer clears the session.

No image or PDF endpoint exists. The server receives only allowlisted activity names such as `session_started`, `pdf_created`, or `share_opened`.

## Control plane

- Clerk Organizations owns users, invitations, organization membership, and the `org:admin`/`org:member` roles.
- Neon Postgres stores dealer delivery profiles, document policy, activity events, and Stripe entitlement status.
- Stripe Checkout collects payment details. Signed webhooks update the organization subscription record. Stripe Customer Portal handles invoices, payment methods, and cancellations.
- Dealer API routes require Clerk authentication and enforce the active organization and admin role server-side.
- Public dealership links become available only to active or trialing subscriptions when Stripe is configured.

## Privacy boundary

Activity records contain organization ID, optional signed-in Clerk user ID, customer/user actor type, event type, optional delivery channel, and timestamp. They contain no customer identity, source address, license data, image, PDF, filename, message body, destination, or crop geometry.

## Exact output

- ID-1 width: `85.60 × 72 / 25.4 = 242.645669... pt`
- ID-1 height: `53.98 × 72 / 25.4 = 153.014173... pt`
- Standard raster: 674 × 425 px
- High-detail raster: 1011 × 638 px

PDF drawing geometry, not image DPI metadata, controls physical placement.
