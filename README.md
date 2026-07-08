# Gitarologia — Song Checker

A live preview tool for **coded songs**. Paste a coded song on the left, fill in
the header fields, and the right pane shows the **exported PDF in real time** —
updating as you type.

The preview is not an approximation: it uses the exact same renderer
(`@react-pdf/renderer`), the same Roboto fonts, and a faithful port of the same
conversion + pagination logic as the main Gitarologia app. What you see here is
byte-for-byte what the app exports.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## Usage

- **Artist / Song title / Rhythm** — appear in the PDF header.
- **Transpose (semitones)** — shifts every chord and updates the "Akordi" header
  value (`0` = original).
- **Notation** — Serbian (`H` / `Hb`) or English (`B` / `Bb`).
- **Coded song** — the numeric-chord format:
  - numbers `1`–`12` are chords (with optional suffix, e.g. `10m`, `5b7`)
  - `;` = new line
  - `;;` = blank line (verse separator — the layout keeps verses together)
  - `[chord]lyric` places a chord above a lyric fragment
- **Download PDF** — saves the current preview as `<Artist> - <Title>.pdf`.

## Keeping in sync with the main app

Two files are direct ports of the production code and must be kept in sync if the
export logic changes in `gitarologia-fe`:

| This repo          | Source in `gitarologia-fe`                              |
| ------------------ | ------------------------------------------------------- |
| `src/convert.js`   | `components/dashboard/songbook/helpers.js` (convertSong) + `utils/songbook/pdfGenerator.js` (measurement / layout / pagination) |
| `src/SongPdf.jsx`  | the `<Document>` JSX + `StyleSheet` in `utils/songbook/pdfGenerator.js` |

## Deploy

### GitHub Pages (default)

Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and deploys
to `https://<user>.github.io/gitarologia-songchecker/`.

One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub
Actions**. If you rename the repo, update `VITE_BASE` in the workflow to match.

### Vercel (alternative)

Import the repo — framework preset **Vite**, build `npm run build`, output `dist`.
No `VITE_BASE` needed (served from root).

## Tech

Vite + React + `@react-pdf/renderer`. No backend — everything runs in the browser.
