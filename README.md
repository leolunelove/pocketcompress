<div align="center">

# PocketCompress

**Less file, same image.**

A small, quiet tool for lossless PNG compression.  
Drop, choose, or paste your images. Download them a little lighter.

Lossless PNG compression · Private image conversion · On your device

[**Open PocketCompress ↗**](https://pocketcompress.leolune.fun/)

[Usage](#usage) · [Install](#install-and-use-offline) · [Privacy](#privacy) · [Quality and limits](#quality-and-limits) · [Development](#development)

</div>

---

## Usage

1. **Add your PNGs.** Drag them in, choose files, or paste with `⌘ V` on macOS or `Ctrl V` on Windows and Linux.
2. **Let PocketCompress work.** Progress and results stay inside the drop area.
3. **Download.** Save an individual PNG or the whole batch as `pocketcompress.zip`.

You can add more images to a batch, remove individual files, or clear everything and start again. No account, settings, or quality slider required.

## Convert to PNG

Choose **Convert to PNG** above the same drop area to convert still JPG, WebP, AVIF and HEIC/HEIF photos. Compression remains the default. Paste, batches and downloads work in both modes, and switching modes keeps existing results.

Conversion creates a standard 8-bit sRGB PNG without photo metadata, then automatically applies lossless PNG optimization. It keeps the optimized file only when smaller and pixel-equivalent to the converted PNG. If optimization fails, the converted PNG remains available. It does not restore lost detail or preserve HDR; PNGs can be larger than the original. HEIC collections use the primary photo; animations are not converted. Transparency is retained where the source format provides it.

The HEIC decoder loads only when native decoding is unavailable. After its first online use it is cached for offline use on that device; it is not part of the initial app download. JPEG, WebP and AVIF use the browser decoder, so support depends on the browser.

## Privacy

Your images are processed in your browser, on your device. PocketCompress has no image-upload endpoint, database, or analytics.

Image data stays in memory while the page is open; the app does not save it to browser storage. Downloads are saved to your device when you request them.

## Install and use offline

The discreet **Install app** link beside the creator credit appears once offline setup is ready. Supported browsers open their installation prompt; other browsers show brief instructions for adding PocketCompress to your home screen or Dock. The link disappears in the installed app.

Load the app online once before using it offline. The page, ZIP library, and both compression and pixel-verification engines are cached locally. Your PNGs and compressed results are never cached or retained by the app. If your browser clears the app cache, open it online again to restore offline access.

## Quality and limits

PocketCompress optimizes the PNG file without changing its decoded pixels. It preserves transparency and 16-bit detail, then checks the result against the original. If a result is larger or fails that check, it keeps the original.

Already optimized PNGs may stay the same size.

| Limit | Supported |
| :--- | :--- |
| Format | Compression: still PNG. Conversion: JPG, WebP, AVIF and HEIC/HEIF still photos |
| Image size | Up to 50 MiB per file |
| Dimensions | Up to 24 million pixels per image |
| Batch size | Up to 50 files, totaling 250 MiB |

## Development

<details>
<summary><strong>Local setup, project layout, and hosting</strong></summary>

### Run locally

From the repository root:

```sh
python3 -m http.server 4173 --directory dist
```

Open [localhost:4173](http://localhost:4173). No build step or package installation is required. Serve the files over HTTP so the compressor's Web Worker can load.

### Project layout

```text
pocketcompress/
├── .github/workflows/pages.yml   # GitHub Pages deployment
├── dist/
│   ├── index.html               # Page structure
│   ├── style.css                # Layout and micro-interactions
│   ├── app.js                   # Input, queue, results, and downloads
│   ├── compress-worker.js       # Compression and pixel verification
│   ├── manifest.webmanifest     # App identity and installation
│   ├── pwa.js                   # Install UI and offline registration
│   ├── sw.js                    # App-only offline cache
│   ├── icons/                   # Home screen and Dock icons
│   └── vendor/                  # Bundled codecs and their licenses
└── README.md
```

### Hosting

The GitHub Actions workflow publishes `dist` to GitHub Pages when changes reach `main`. The repository's Pages publishing source is set to **GitHub Actions**.

Installation and offline setup require HTTPS or localhost. All app paths are relative, including the service worker scope, so deployment under a GitHub Pages repository path is supported. When releasing changes, bump `VERSION` in `dist/sw.js` to replace the cached app files together. Updates activate after the existing app sessions close, preserving any active compression queue.

### Dependencies

HEIC fallback uses libheif-js 1.23.5 (LGPL-3.0); source and license references are included in `dist/vendor/heif/`. Compression uses OxiPNG, pixel verification uses a PNG decoder, and batch downloads use JSZip. These dependencies are bundled with the application; their licenses remain alongside the vendored code.

</details>

---

<div align="center">

Created by [@leo](https://leolune.com)

</div>
