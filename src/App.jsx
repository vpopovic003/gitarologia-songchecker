import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Font, pdf } from '@react-pdf/renderer';
import SongPdf from './SongPdf.jsx';
import { convertSong, collapseEmptyRows, detectLayout, paginateRows } from './convert.js';

// Font files live in /public/fonts and are served under the configured base path.
const FONT_REGULAR = `${import.meta.env.BASE_URL}fonts/Roboto-Regular.ttf`;
const FONT_BOLD = `${import.meta.env.BASE_URL}fonts/Roboto-Bold.ttf`;

// Register the same Roboto faces the production PDF uses (once).
Font.register({
  family: 'Roboto',
  fonts: [
    { src: FONT_REGULAR, fontWeight: 400 },
    { src: FONT_BOLD, fontWeight: 700 }
  ]
});

// Locale-specific header labels (mirrors utils/locales/{sr,en}/…/topBar.js).
const LABELS = {
  sr: { rhythm: 'Ritam', chords: 'Akordi', original: 'Originalni', course: 'Prilagođeni' },
  en: { rhythm: 'Rhythm', chords: 'Chords', original: 'Original', course: 'Adjusted' }
};

const SAMPLE_SONG = `[10m]Kad sam bio [8]mlad i [1]lud
[5m]sve je bilo [10m]lako
[10m]sad kad znam gde [8]hoću [1]da
[5m]put mi nije [10m]jasan;;
[3]Refren ide [7]ovako
[10]pevaj sada [1]glasno
[3]nek se čuje [7]nadaleko
[10]sve do zore [1]rano`;

const DEBOUNCE_MS = 350;

export default function App() {
  const [artist, setArtist] = useState('Izvođač');
  const [title, setTitle] = useState('Naziv pesme');
  const [rhythm, setRhythm] = useState('Pop-rok');
  const [transpose, setTranspose] = useState(0);
  const [locale, setLocale] = useState('sr');
  const [song, setSong] = useState(SAMPLE_SONG);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | busy | error
  const [errorMsg, setErrorMsg] = useState('');

  const blobRef = useRef(null);
  const timerRef = useRef(null);
  const prevUrlRef = useRef(null);
  const runIdRef = useRef(0);

  const render = useCallback(async () => {
    const runId = ++runIdRef.current;
    setStatus('busy');
    setErrorMsg('');
    try {
      const offset = Number(transpose) || 0;
      const labels = LABELS[locale];

      const collapsed = collapseEmptyRows(convertSong(song, locale, offset));
      const { cols, colWidth } = await detectLayout(collapsed, FONT_REGULAR);
      const pages = paginateRows(collapsed, cols);

      const doc = (
        <SongPdf
          artistName={artist}
          songTitle={title}
          rhythm={rhythm}
          rhythmLabel={labels.rhythm}
          transposeLabel={labels.chords}
          originalLabel={labels.original}
          courseLabel={labels.course}
          transposeOffset={offset}
          courseOffset={undefined}
          colWidth={colWidth}
          pages={pages}
        />
      );

      const blob = await pdf(doc).toBlob();
      // Ignore results from a superseded run (user kept typing).
      if (runId !== runIdRef.current) return;

      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setPreviewUrl(url);
      setStatus('idle');
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setStatus('error');
      setErrorMsg(err?.message || String(err));
    }
  }, [artist, title, rhythm, transpose, locale, song]);

  // Debounced re-render on any input change.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(render, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [render]);

  // Revoke the last object URL on unmount.
  useEffect(
    () => () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    },
    []
  );

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artist} - ${title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [artist, title]);

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>Gitarologia — Song Checker</h1>
          <div className="subtitle">
            Paste a coded song, edit the fields, see the exported PDF live.
          </div>
        </div>
        <button className="btn" onClick={handleDownload} disabled={!blobRef.current}>
          Download PDF
        </button>
      </div>

      <div className="panes">
        <div className="pane pane--left">
          <div className="fields">
            <div className="field">
              <label htmlFor="artist">Artist</label>
              <input id="artist" value={artist} onChange={e => setArtist(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="title">Song title</label>
              <input id="title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rhythm">Rhythm</label>
              <input id="rhythm" value={rhythm} onChange={e => setRhythm(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="transpose">Transpose (semitones)</label>
              <input
                id="transpose"
                type="number"
                value={transpose}
                onChange={e => setTranspose(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="locale">Notation</label>
              <select id="locale" value={locale} onChange={e => setLocale(e.target.value)}>
                <option value="sr">Serbian (H / Hb)</option>
                <option value="en">English (B / Bb)</option>
              </select>
            </div>
          </div>

          <div className="editor">
            <label htmlFor="song">
              Coded song — numeric chords, <code>;</code> = new line, <code>;;</code> = blank
              line, <code>[chord]lyric</code>
            </label>
            <textarea
              id="song"
              value={song}
              spellCheck={false}
              onChange={e => setSong(e.target.value)}
            />
          </div>
        </div>

        <div className="pane pane--right">
          <div className="preview-toolbar">
            <div className="status">
              <span
                className={`dot ${
                  status === 'busy' ? 'dot--busy' : status === 'error' ? 'dot--error' : ''
                }`}
              />
              {status === 'busy'
                ? 'Rendering…'
                : status === 'error'
                ? 'Error'
                : 'Up to date'}
            </div>
            <div>Live PDF preview (A4) — identical to the exported file</div>
          </div>

          {status === 'error' && <div className="error-box">{errorMsg}</div>}

          {previewUrl && (
            <iframe
              key="preview"
              className="preview-frame"
              title="PDF preview"
              src={`${previewUrl}#toolbar=1&navpanes=0`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
