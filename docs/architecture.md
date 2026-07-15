# Architecture

LicenseSizer is a client-only React application built with vinext/Vite and deployed as a Cloudflare-compatible worker plus static assets. There is no application data API or persistent database.

## Runtime flow

1. The user grants rear-camera access or selects an image.
2. The browser decodes an oriented working copy and calculates coarse quality signals.
3. A local Sobel/connected-edge pass proposes four card corners and rotates portrait-oriented detections into landscape order.
4. The user confirms the visible result or adjusts normalized corner coordinates using touch, pointer, or keyboard controls.
5. A projective transform resamples the selected quadrilateral onto a canonical ID-1 raster.
6. `pdf-lib` embeds the corrected JPEG at exact PDF-point dimensions.
7. The resulting Blob is shared through the Web Share API or downloaded through a temporary object URL.
8. Starting over stops media tracks, revokes object URLs, and drops references.

## Important constants

- ID-1 width: `85.60 × 72 / 25.4 = 242.645669... pt`
- ID-1 height: `53.98 × 72 / 25.4 = 153.014173... pt`
- Standard raster: 674 × 425 px
- High-detail raster: 1011 × 638 px

Image DPI metadata does not control physical placement. The PDF drawing matrix does.

## Boundaries

- `app/license-sizer-app.tsx`: workflow, media lifecycle, accessible UI, cleanup
- `lib/image-processing.ts`: validation, quality signals, rotation, perspective correction
- `lib/pdf.ts`: page geometry, image placement, marks, metadata, filename
- `public/sw.js`: static application-shell caching only

Automatic detection is always shown for user confirmation; low-confidence results fall back to the safe default handles instead of silently cropping.
