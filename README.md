# LicenseResizer

LicenseResizer is a privacy-first document capture and delivery product for automotive dealerships. A dealership creates an organization, configures its delivery destination and PDF policy, then shares a branded customer link. The customer photographs a driver's license, confirms the crop, and sends the locally generated PDF through the device's native share sheet.

License images and PDF bytes stay in volatile browser memory. LicenseResizer stores dealership configuration, subscription state, and minimal workflow events; it does not store license images, PDFs, customer names, filenames, or document content.

## Product surfaces

- `/` — generic private capture and delivery flow
- `/d/[slug]` — dealership-branded customer landing page
- `/d/[slug]/scan` — dealership-configured customer capture flow
- `/dashboard` — Clerk-protected dealer console for reporting, delivery policy, organization membership, and billing
- `/privacy`, `/terms`, `/security`, `/subprocessors`, `/support` — public trust, legal, and support center
- `/api/webhooks/stripe` — signed Stripe subscription webhook

Dealer admins control whether the optional back is offered or omitted; Letter/A4 output; stacked/separate-page layout; image detail; labels; crop marks; destination email/phone; and preset message. Customers and dealer users do not see PDF configuration controls.

Dealer admins can also customize a public landing page with a readable dealership link, logo, headline, description, call-to-action, address, public phone and email, website, Facebook page, brand colors, and Classic, Modern, or Minimal layout. New organizations receive the dealership-name slug when available and a numeric suffix only when needed to keep links unique.

## Stack

- Next.js 16 deployed to Vercel
- Clerk Organizations for authentication, invitations, admins, and members
- Neon Postgres with Drizzle ORM for dealership profiles, activity events, and subscription entitlements
- Stripe Checkout and Customer Portal for individual and dealer subscriptions
- OpenCV.js and pdf-lib for on-device correction and exact PDF geometry

## Local setup

Requirements: Node.js 22.13 or newer.

1. Copy `.env.example` to `.env.local` and add Clerk, Neon, and Stripe test credentials.
2. In Clerk, enable Organizations and require organization membership for the dealer console.
3. Create recurring Stripe Prices for the dealer plan and individual plan. Set `STRIPE_DEALER_PRICE_ID` and `STRIPE_INDIVIDUAL_PRICE_ID`; `STRIPE_PRICE_ID` remains supported as a legacy dealer-price fallback.
4. Apply the database migration with `npm run db:migrate`.
5. Start the application with `npm run dev`.

For local Stripe webhook testing, forward events to `/api/webhooks/stripe` and place the signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe the production endpoint to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, and `customer.subscription.resumed`. In Stripe Billing settings, enable the customer trial-ending reminder email. First trials use Checkout without collecting payment details and cancel automatically if the trial ends without a payment method.

The individual plan is capped at 100 PDFs per calendar month. Usage is counted from `pdf_created` activity events, checked before PDF generation, and reset at the start of each UTC month. Dealer plans default to unlimited monthly PDFs unless a limit is stored on the subscription.

## Validation

```bash
npm run build
npm test
npm run lint
```

The suite verifies exact ID-1 geometry, perspective correction, orientation behavior, camera-guide mapping, crop suggestions, privacy boundaries, and core customer delivery content.

## Deployment

Import the repository into Vercel and configure every value in `.env.example` for Preview and Production. Use separate Clerk, Neon, and Stripe test resources for Preview. Apply migrations to the production Neon database before promoting the first production deployment. Configure the Stripe production webhook only after the final HTTPS domain is stable.

The native Web Share API can attach the generated PDF to user-selected applications such as Mail or Messages. Browsers do not permit a site to silently select a recipient or confirm delivery. `mailto:` and `sms:` fallbacks can preset the destination and message but cannot attach a local PDF, so the interface explains that the user must attach the downloaded file. Activity reporting describes handoff options opened, not confirmed sends or receipts.

LicenseResizer resizes and corrects a document image. It does not verify identity, validate a license, decode a barcode, or certify authenticity.
