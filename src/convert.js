/**
 * Song conversion + PDF layout math.
 *
 * This file is a faithful port of the production code in gitarologia-fe:
 *   - convertSong (+ helpers)      → components/dashboard/songbook/helpers.js
 *   - measurement / layout / pagination → utils/songbook/pdfGenerator.js
 *
 * Keep it in sync with those two files. The React-PDF <Document> component that
 * consumes this output lives in ./SongPdf.jsx and mirrors the JSX in
 * pdfGenerator.js. Because the preview uses the same renderer as the real app,
 * the output here is a 1:1 match to the exported PDF.
 */

// ── Layout constants (from pdfGenerator.js) ────────────────────────────────
export const CONTENT_ROW_HEIGHT = 30;
export const CONTENT_ROW_HEIGHT_NO_CHORD = 16;
export const SPACER_HEIGHT = 12;
export const COLUMN_MARGIN_H = 6;
export const BODY_FONT_SIZE = 10;
export const CHORD_SUPER_FONT_SIZE = 7;
export const CHORD_COLOR = '#9333ea';
export const GRAD_FROM = '#01eedd';
export const GRAD_TO = '#9333ea';

export const CONTENT_PADDING_H = 0;
export const CONTENT_PADDING_V = 22;
export const A4_WIDTH = 595;
export const A4_HEIGHT = 841.89;
export const HEADER_HEIGHT = 38;
export const HEADER_MARGIN_BOTTOM = 14;

const FOOTER_RESERVE = 22;
const COLUMN_HEIGHT_SAFETY = 10;
export const COLUMN_HARD_LIMIT =
  A4_HEIGHT -
  HEADER_HEIGHT -
  HEADER_MARGIN_BOTTOM -
  CONTENT_PADDING_V -
  FOOTER_RESERVE -
  COLUMN_HEIGHT_SAFETY;

// ═══════════════════════════════════════════════════════════════════════════
// convertSong (port of components/dashboard/songbook/helpers.js)
// ═══════════════════════════════════════════════════════════════════════════

export const transposeNoteNumber = (noteNum, offset) =>
  ((Number(noteNum) - 1 + ((Number(offset) % 12) + 12)) % 12) + 1;

export const getNotesMap = locale => ({
  1: 'C',
  2: 'C#',
  3: 'D',
  4: 'Eb',
  5: 'E',
  6: 'F',
  7: 'F#',
  8: 'G',
  9: 'Ab',
  10: 'A',
  11: locale === 'sr' ? 'Hb' : 'Bb',
  12: locale === 'sr' ? 'H' : 'B'
});

const CYRILLIC_LATIN_HOMOGLYPHS = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  ј: 'j',
  і: 'i'
};

const normalizeCyrillicHomoglyphs = text =>
  text.replace(/[А-я]/g, ch => CYRILLIC_LATIN_HOMOGLYPHS[ch] || ch);

export const convertSong = (chords, locale, offset = 0) => {
  const notesMap = getNotesMap(locale);
  const numOffset = Number(offset);
  const normalizedChords = normalizeCyrillicHomoglyphs(chords);

  let textChords = normalizedChords.replace(
    /\b(1[0-2]|[1-9])(\w*)\b/g,
    (match, num, suffix) => {
      const transposedNum =
        numOffset !== 0 ? transposeNoteNumber(num, numOffset) : Number(num);
      const note = notesMap[transposedNum];
      return note ? note + suffix : match;
    }
  );

  let textSpaces = textChords
    .replace(/ /g, '\u00A0')
    .replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0')
    .replace(/;;/g, ';;;;');

  const songRowsNormalised = textSpaces
    .split(';')
    .map(row => {
      let newRow = '';
      if (row[0] !== '[') {
        newRow = '[ ]' + row;
      } else {
        newRow = row;
      }
      return newRow;
    })
    .map(row => {
      let newRow = '';
      if (row.slice(-1) === ']') {
        newRow = row + ' ';
      } else {
        newRow = row;
      }
      return newRow;
    })
    .map(row => row.replace(/\](?=\[)/g, ']\u00A0'));

  const output = songRowsNormalised.map(line => {
    const chordLyricPairs = [];
    const chordLyricRegex = /\[([^\]]+)\]([^\[]+)/g;

    let match;
    while ((match = chordLyricRegex.exec(line)) !== null) {
      chordLyricPairs.push({ chord: match[1], lyric: match[2] });
    }

    return chordLyricPairs;
  });

  return output;
};

// ═══════════════════════════════════════════════════════════════════════════
// Measurement + layout + pagination (port of utils/songbook/pdfGenerator.js)
// ═══════════════════════════════════════════════════════════════════════════

const METRICS_FONT_FAMILY = 'DejaVuSansCondensedPdfMetrics';
let metricsCtx = null;
let metricsFontPromise = null;
let metricsFontFailed = false;

export async function ensureMetricsFont(fontUrl) {
  if (metricsFontPromise) return metricsFontPromise;
  metricsFontPromise = (async () => {
    try {
      if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
        metricsFontFailed = true;
        return;
      }
      const fontFace = new FontFace(METRICS_FONT_FAMILY, `url(${fontUrl})`);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch {
      metricsFontFailed = true;
    }
  })();
  return metricsFontPromise;
}

function measureTextPt(text, sizePt) {
  if (!text) return 0;
  if (metricsFontFailed) {
    return text.length * (sizePt >= 11 ? 5.2 : 3.8);
  }
  if (!metricsCtx) {
    metricsCtx = document.createElement('canvas').getContext('2d');
  }
  metricsCtx.font = `${sizePt}pt ${METRICS_FONT_FAMILY}`;
  return metricsCtx.measureText(text).width * 0.75;
}

export function splitChordSegments(chordText) {
  const segments = [];
  let ci = 0;
  while (ci < chordText.length) {
    if (
      chordText[ci] === '7' ||
      chordText[ci] === 'b' ||
      chordText[ci] === '#'
    ) {
      let sup = '';
      while (
        ci < chordText.length &&
        (chordText[ci] === '7' ||
          chordText[ci] === 'b' ||
          chordText[ci] === '#')
      ) {
        sup += chordText[ci++];
      }
      segments.push({ text: sup, isSuper: true });
    } else {
      let norm = '';
      while (
        ci < chordText.length &&
        chordText[ci] !== '7' &&
        chordText[ci] !== 'b' &&
        chordText[ci] !== '#'
      ) {
        norm += chordText[ci++];
      }
      segments.push({ text: norm, isSuper: false });
    }
  }
  return segments;
}

function measureChordWidth(chordText) {
  if (!chordText) return 0;
  const hasSuper =
    chordText.includes('7') ||
    chordText.includes('b') ||
    chordText.includes('#');
  if (!hasSuper) {
    return measureTextPt(chordText, BODY_FONT_SIZE) + 4;
  }
  let width = 0;
  for (const seg of splitChordSegments(chordText)) {
    width += measureTextPt(
      seg.text,
      seg.isSuper ? CHORD_SUPER_FONT_SIZE : BODY_FONT_SIZE
    );
  }
  return width + 4;
}

export function isEmptyRow(row) {
  if (!row || row.length === 0) return true;
  return row.every(
    pair =>
      (!pair.chord || pair.chord.trim() === '') &&
      (!pair.lyric || pair.lyric.trim() === '')
  );
}

export function rowHasChords(row) {
  if (!row) return false;
  return row.some(pair => {
    const chordText = pair.chord !== ' ' ? pair.chord : '';
    return chordText.trim() !== '';
  });
}

export function collapseEmptyRows(rows) {
  const result = [];
  let prevWasEmpty = false;

  for (const row of rows) {
    if (isEmptyRow(row)) {
      if (!prevWasEmpty && result.length > 0) {
        result.push([]);
      }
      prevWasEmpty = true;
    } else {
      result.push(row);
      prevWasEmpty = false;
    }
  }

  if (result.length > 0 && isEmptyRow(result[result.length - 1])) {
    result.pop();
  }

  return result;
}

const rowHeight = row =>
  isEmptyRow(row)
    ? SPACER_HEIGHT
    : rowHasChords(row)
    ? CONTENT_ROW_HEIGHT
    : CONTENT_ROW_HEIGHT_NO_CHORD;

function splitIntoVerses(rows) {
  const verses = [];
  let current = [];
  for (const row of rows) {
    if (isEmptyRow(row)) {
      if (current.length) {
        verses.push(current);
        current = [];
      }
    } else {
      current.push(row);
    }
  }
  if (current.length) verses.push(current);
  return verses;
}

const blockHeight = block => block.reduce((sum, r) => sum + rowHeight(r), 0);

function toBlocks(verses, limit) {
  const blocks = [];
  for (const verse of verses) {
    if (blockHeight(verse) <= limit) {
      blocks.push(verse);
      continue;
    }
    let chunk = [];
    let h = 0;
    for (const row of verse) {
      const rh = rowHeight(row);
      if (chunk.length && h + rh > limit) {
        blocks.push(chunk);
        chunk = [];
        h = 0;
      }
      chunk.push(row);
      h += rh;
    }
    if (chunk.length) blocks.push(chunk);
  }
  return blocks;
}

function packColumns(blocks, limit) {
  const columns = [];
  let current = [];
  let currentH = 0;
  for (const block of blocks) {
    const bH = blockHeight(block);
    const gap = current.length ? SPACER_HEIGHT : 0;
    if (current.length && currentH + gap + bH > limit) {
      columns.push(current);
      current = [];
      currentH = 0;
    }
    current.push(block);
    currentH += (current.length > 1 ? SPACER_HEIGHT : 0) + bH;
  }
  if (current.length) columns.push(current);
  return columns;
}

function balancedSplit(heights, k) {
  const n = heights.length;
  if (k >= n) return heights.map(() => 1);

  const feasible = cap => {
    let groups = 1;
    let cur = 0;
    for (const h of heights) {
      const add = cur === 0 ? h : SPACER_HEIGHT + h;
      if (cur + add > cap) {
        groups++;
        cur = h;
        if (groups > k) return false;
      } else {
        cur += add;
      }
    }
    return true;
  };

  let lo = Math.max(...heights);
  let hi = heights.reduce((s, h) => s + h + SPACER_HEIGHT, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (feasible(mid)) hi = mid;
    else lo = mid + 1;
  }

  const sizes = [];
  let cur = 0;
  let count = 0;
  for (const h of heights) {
    const add = count === 0 ? h : SPACER_HEIGHT + h;
    if (count > 0 && cur + add > lo) {
      sizes.push(count);
      cur = h;
      count = 1;
    } else {
      cur += add;
      count++;
    }
  }
  if (count) sizes.push(count);
  return sizes;
}

function blocksToColumn(blocks) {
  const column = [];
  blocks.forEach((block, i) => {
    if (i > 0) column.push([]);
    for (const row of block) column.push(row);
  });
  return column;
}

export function paginateRows(rows, maxCols) {
  if (!rows || rows.length === 0) {
    return [Array.from({ length: maxCols }, () => [])];
  }

  const verses = splitIntoVerses(rows);
  if (verses.length === 0) {
    return [Array.from({ length: maxCols }, () => [])];
  }

  const blocks = toBlocks(verses, COLUMN_HARD_LIMIT);
  const greedyColumns = packColumns(blocks, COLUMN_HARD_LIMIT);

  const pages = [];
  for (let p = 0; p * maxCols < greedyColumns.length; p++) {
    const pageColumns = greedyColumns.slice(p * maxCols, (p + 1) * maxCols);
    const pageBlocks = pageColumns.flat();
    const k = pageColumns.length;
    const sizes = balancedSplit(pageBlocks.map(blockHeight), k).filter(
      s => s > 0
    );

    const cols = [];
    let idx = 0;
    for (const size of sizes) {
      cols.push(blocksToColumn(pageBlocks.slice(idx, idx + size)));
      idx += size;
    }
    pages.push(cols);
  }

  return pages;
}

export async function detectLayout(rows, fontUrl) {
  await ensureMetricsFont(fontUrl);

  let maxRowWidth = 0;

  for (const row of rows) {
    if (isEmptyRow(row)) continue;
    let rowWidth = 0;
    for (let i = 0; i < row.length; i++) {
      const pair = row[i];
      const chord = (pair.chord || '').trim();
      // Trailing whitespace on the last pair renders past the last visible
      // glyph, so trim it before measuring.
      let lyric = pair.lyric || '';
      if (i === row.length - 1) lyric = lyric.replace(/\s+$/, '');
      const lyricVisible = lyric.trim().length > 0;
      const chordWidth = measureChordWidth(chord);
      const lyricWidth = lyricVisible ? measureTextPt(lyric, BODY_FONT_SIZE) : 0;
      rowWidth += Math.max(chordWidth, lyricWidth);
    }
    if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
  }

  const neededWidth = Math.ceil(maxRowWidth);
  const contentAreaWidth = A4_WIDTH - 2 * CONTENT_PADDING_H;

  const twoColAvailable = contentAreaWidth / 2 - 2 * COLUMN_MARGIN_H;
  const oneColAvailable = contentAreaWidth - 2 * COLUMN_MARGIN_H;

  const cols = neededWidth > twoColAvailable ? 1 : 2;
  const minColWidth = cols === 2 ? 120 : 300;
  const colWidth =
    cols === 2
      ? Math.max(minColWidth, neededWidth)
      : Math.min(oneColAvailable, Math.max(minColWidth, neededWidth));

  return { cols, colWidth };
}

export function formatTransposeText(
  offset,
  courseOffset,
  transposeLabel,
  originalLabel,
  courseLabel
) {
  const sign = offset > 0 ? '+' : '';
  if (offset === 0) {
    return `${transposeLabel}: ${originalLabel}`;
  }
  const isCourseOffset =
    typeof courseOffset === 'number' &&
    !isNaN(courseOffset) &&
    offset === courseOffset;
  const value = `${sign}${offset}`;
  return `${transposeLabel}: ${
    isCourseOffset ? `${courseLabel} (${value})` : value
  }`;
}
