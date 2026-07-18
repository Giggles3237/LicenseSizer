# Threat model

Driver's-license images and generated PDFs are sensitive personal data even though LicenseSizer does not interpret their contents.

## In scope

- Accidental content upload or telemetry leakage
- Persistent browser storage and service-worker caching
- Camera streams left active after navigation or backgrounding
- Malicious or excessively large image inputs
- Object-URL and canvas lifecycle leaks
- Third-party script exfiltration
- Cross-organization authorization failures
- Forged billing or activity events
- Users mistaking resizing for identity verification

## Controls

- No image/PDF upload, OCR, or document-content endpoint
- Clerk-managed authentication with server-side organization and admin checks
- Stripe webhook signature verification over the raw request body
- Same-origin, allowlisted, size-limited activity ingestion
- Minimal activity records with no customer or document content
- No localStorage, sessionStorage, IndexedDB, or persistent document model
- Same-origin runtime dependencies and restrictive production-header guidance
- 25 MB encoded-file limit and 60 MP decoded-pixel limit
- Browser decoder followed by canvas re-encoding, which strips source metadata from output
- Camera tracks stopped on exit, backgrounding, replacement, and start-over
- Blob URLs revoked when replaced or cleared
- Service worker excludes images, media, Blob URLs, and PDFs
- Consistent non-verification wording

## Residual risks

- Browser, operating-system, or first-party build compromise
- Browser-managed memory or disk caches outside application control
- Files retained in Downloads or external share destinations
- A user selecting the wrong recipient
- Public dealer-link discovery and destination spam
- Dependency, identity-provider, database, payment-provider, or hosting compromise
- Poor source images that remain visually ambiguous
- Printer-driver scaling that changes physical output

Production release requires a deployed-origin network/storage inspection and organizational review of lawful purpose, consent, retention, and secure transfer outside this application.
