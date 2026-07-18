# LicenseSizer

LicenseSizer is a privacy-first document capture and delivery product for automotive dealerships. A dealership creates an organization, configures its delivery destination and PDF policy, then shares a branded customer link. The customer photographs a driver's license, confirms the crop, and sends the locally generated PDF through the device's native share sheet.

License images and PDF bytes stay in volatile browser memory. LicenseSizer stores dealership configuration, subscription state, and minimal workflow events; it does not store license images, PDFs, customer names, filenames, or document content.

## Product surfaces

- `/` — generic private capture and delivery flow
- `/d/[slug]` — dealership-configured customer capture link
- `/dashboard` — Clerk-protected dealer console for reporting, delivery policy, organization membership, and billing
- `/api/webhooks/stripe` — signed Stripe subscription webhook

Dealer admins control whether the back is required, optional, or omitted; Letter/A4 output; stacked/separate-page layout; image detail; labels; crop marks; destination email/phone; and preset message. Customers and dealer users do not see PDF configuration controls.

## Stack

- Next.js 16 deployed to Vercel
- Clerk Organizations for authentication, invitations, admins, and members
- Neon Postgres with Drizzle ORM for dealership profiles, activity events, and subscription entitlements
- Stripe Checkout and Customer Portal for organization subscriptions
- OpenCV.js and pdf-lib for on-device correction and exact PDF geometry

## Local setup

Requirements: Node.js 22.13 or newer.

1. Copy `.env.example` to `.env.local` and add Clerk, Neon, and Stripe test credentials.
2. In Clerk, enable Organizations and require organization membership for the dealer console.
3. Create a recurring Stripe Price and set `STRIPE_PRICE_ID`.
4. Apply the database migration with `npm run db:migrate`.
5. Start the application with `npm run dev`.

For local Stripe webhook testing, forward events to `/api/webhooks/stripe` and place the signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe the production endpoint to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

## Validation

```bash
npm run build
npm test
npm run lint
```

The suite verifies exact ID-1 geometry, perspective correction, orientation behavior, camera-guide mapping, crop suggestions, privacy boundaries, and core customer delivery content.

## Deployment

Import the repository into Vercel and configure every value in `.env.example` for Preview and Production. Use separate Clerk, Neon, and Stripe test resources for Preview. Apply migrations to the production Neon database before promoting the first production deployment. Configure the Stripe production webhook only after the final HTTPS domain is stable.

The native Web Share API can attach the generated PDF to user-selected applications such as Mail or Messages. Browsers do not permit a site to silently select a recipient. `mailto:` and `sms:` fallbacks can preset the destination and message but cannot attach a local PDF, so the interface explains that the user must attach the downloaded file.

LicenseSizer resizes and corrects a document image. It does not verify identity, validate a license, decode a barcode, or certify authenticity.
