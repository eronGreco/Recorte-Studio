# Recorte Studio

**An open-source Silhouette Studio alternative focused on a simpler print-and-cut workflow.**

[Português / full README](../README.md) · [MIT license](../LICENSE)

![Recorte Studio desktop editor](screenshots/editor.webp)

The goal is to replace Silhouette Studio in my own workflow: import artwork,
adjust cut contours, add bleed, arrange a sheet, pair front and back designs,
print, and send the cut to a Silhouette CAMEO 4. It is built around my needs;
other makers may find the same approach useful.

UI and UX are the priority. Implemented features are available together,
without subscriptions, accounts, paid tiers, or uploading artwork.

## Features

- Automatic image tracing with inward/outward offsets in millimetres.
- User-controlled contour smoothing and separate sharp/rounded corner controls.
- Local simulated bleed extending edge colours with adjustable blur.
- Linked duplex artwork: back positions follow the front while text remains readable.
- Automatic sheet nesting that respects registration-mark exclusion zones and keeps overflow pieces outside the sheet.
- True vector cut shapes, linked holes, layers and magnetic alignment guides.
- Editable rotation and dimensions beside the selection, with proportional scaling by default.
- Artwork replacement while retaining the arrangement; silhouette changes require confirmation.
- Searchable material presets, personal settings and line segment overcut.
- Six small A–F material calibration cuts in a user-selected unused area of the sheet.
- Configurable registration marks, print guides, SVG export and duplex PDF output.
- Native Windows USBPRINT communication with CAMEO 4.
- Independent project tabs with session recovery and one shared machine job owned by its project.
- Front-only PDF when no back artwork exists; configurable page sizes and orientation.

The official Silhouette software places some features in paid editions:
[SVG import and layers](https://silhouetteamerica.freshdesk.com/support/solutions/articles/35000273383-designer-edition-features)
require Designer Edition or above, and
[SVG export](https://silhouetteamerica.freshdesk.com/support/solutions/articles/35000273385-business-edition-features)
requires Business Edition. Those features are included here under MIT.

## Version 0.12.2

Independent project tabs, a redesigned cut dialog, searchable layers with drag-and-drop, context menus, optional back pages, configurable paper sizes and clearer help. Long USB paths are sent in command-aligned blocks with READY flow control; physical confirmation of that change is still pending. See the [changelog](../CHANGELOG.md).

## Install on Windows

Download **Recorte-Studio-Setup-VERSION-x64.exe** from the [latest release](https://github.com/eronGreco/Recorte-Studio/releases/latest). Node.js and Python are bundled. The installer is not code-signed yet. Updates are announced at startup and downloaded through the release page; installation is manual.

## Run from source

Current target: Windows 10/11, Node.js 24, Python 3.12+, CAMEO 4 over USB,
AutoBlade in holder 1. A4 has physical production experience; additional paper sizes within the 60–304.8 mm-per-side registration range still need physical validation.

```powershell
git clone https://github.com/eronGreco/Recorte-Studio.git
cd Recorte-Studio
npm ci
npm start
```

Set `RECORTE_PYTHON` to your Python executable if it is not on PATH.
Python is required for USB communication, not ordinary editing or export.

Open `test/fixtures/demo.recorte` for the synthetic demo shown above.
`npm test` runs offline unit suites; `npm run test:ui` runs Electron tests
with simulated hardware and separate data directories.

## Current limits

This is an actively developed desktop application. Production cutting has been
confirmed on one CAMEO 4; software pause/resume still needs complete physical
validation. Software controls act between complete passes; use the machine's
physical control for immediate interruption.

No `.studio3`, editable PDF import, Bluetooth, other cutter models, or claimed
macOS/Linux hardware support yet. Other devices need model-specific evidence.

Created by [Eron Greco](https://github.com/eronGreco). Independent project;
not affiliated with Silhouette America.
