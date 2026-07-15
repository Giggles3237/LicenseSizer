# Architecture

LicenseSizer is a client-only React application built with vinext/Vite and deployed as a Cloudflare-compatible worker plus static assets. There is no application data API or persistent database.

## Runtime flow

1. The user grants rear-camera access or selects an image.
2. The browser decodes an oriented working copy and calculates coarse quality signals.
3. The user confirms four normalized corner coordinates using touch, pointer, or keyboard controls.
4. A projective transform resamples the selected quadrilateral onto a canonical ID-1 raster.
5. `pdf-lib` embeds the corrected JPEG at exact PDF-point dimensions.
6. The resulting Blob is shared through the Web Share API or downloaded through a temporary object URL.
7. Starting over stops media tracks, revokes object URLs, and drops references.

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

The first release intentionally favors explicit user crop confirmation over uncalibrated automatic document detection.
