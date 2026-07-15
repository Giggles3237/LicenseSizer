# LicenseSizer

LicenseSizer is a privacy-first browser application that turns a phone photo into a clean PDF with the license image placed at the nominal ID-1 dimensions of **85.60 × 53.98 mm**.

The application runs entirely in the browser. License images and generated PDF bytes are not uploaded to an application server, stored in browser databases, or added to the service-worker cache.

## Features

- Rear-camera capture with file-upload fallback
- Full-screen mobile camera with a high-contrast ID-1 framing guide
- On-device OpenCV contour analysis, confidence scoring, landscape rotation, and visible manual fallback
- Front-only or front-and-back sessions
- Local blur, lighting, and glare guidance
- Touch, pointer, and keyboard-accessible four-corner editing
- Local projective perspective correction
- Exact Letter and A4 PDF geometry
- Stacked, separate-page, and front-only layouts
- Standard and high-detail output
- Optional side labels and crop marks
- Native file sharing where supported, with download fallback
- Installable shell with careful static-asset-only offline caching
- Explicit cleanup of media tracks, object URLs, canvases, and active session references

LicenseSizer does **not** verify identity, validate a license, decode barcodes, or certify authenticity.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Camera capture requires a secure context; localhost is treated as secure by modern browsers. Test the deployed HTTPS origin on physical iOS and Android devices before release.

## Validation

```bash
npm run build
npm test
npm run lint
```

The tests verify rendered product content, the exact ID-1 point geometry, removal of starter-preview code, and key privacy boundaries.

## Privacy architecture

- Sources remain as in-memory `Blob` objects for the active session.
- Image analysis, crop correction, and PDF composition execute in the browser.
- No account, upload endpoint, OCR, telemetry, or persistent document history exists.
- The service worker caches only same-origin documents, scripts, styles, fonts, and the manifest.
- Starting over stops the camera, revokes object URLs, and drops session references. JavaScript cannot promise immediate physical memory erasure; the browser controls garbage collection.
- Files saved or shared by the user are subsequently controlled by the browser, operating system, and chosen destination.

See [docs/architecture.md](docs/architecture.md) and [docs/threat-model.md](docs/threat-model.md) for more detail.

## Deployment

The project is configured as a Cloudflare-compatible Sites application through `.openai/hosting.json`. Production must use HTTPS and should set:

- `Content-Security-Policy` restricting scripts, workers, frames, and connections to the application origin
- `Permissions-Policy: camera=(self)`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` after the production domain is stable

Verify camera permission, file sharing, PDF download, offline reload, and cache/storage contents on the final deployed origin.
