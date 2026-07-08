/**
 * React-PDF <Document> for a single song.
 *
 * Mirrors the JSX + StyleSheet inside generateAndDownloadSongPdf() in
 * gitarologia-fe/utils/songbook/pdfGenerator.js. Keep in sync with that file.
 * Layout math (convertSong, detectLayout, paginateRows, …) lives in ./convert.js.
 */
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  Defs,
  LinearGradient,
  Stop
} from '@react-pdf/renderer';
import {
  A4_WIDTH,
  HEADER_HEIGHT,
  HEADER_MARGIN_BOTTOM,
  CONTENT_PADDING_H,
  CONTENT_PADDING_V,
  SPACER_HEIGHT,
  COLUMN_MARGIN_H,
  BODY_FONT_SIZE,
  CHORD_SUPER_FONT_SIZE,
  CHORD_COLOR,
  GRAD_FROM,
  GRAD_TO,
  isEmptyRow,
  rowHasChords,
  splitChordSegments,
  formatTransposeText
} from './convert.js';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    fontFamily: 'DejaVuSansCondensed'
  },
  headerWrapper: {
    position: 'relative',
    width: A4_WIDTH,
    height: HEADER_HEIGHT,
    marginBottom: HEADER_MARGIN_BOTTOM
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0
  },
  headerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: A4_WIDTH,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 40
  },
  headerTitle: {
    fontSize: 15,
    color: 'white'
  },
  headerTitleArtist: {
    fontWeight: 700
  },
  headerTitleSong: {
    fontWeight: 400
  },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'white',
    opacity: 0.4,
    marginHorizontal: 14
  },
  headerRight: {
    justifyContent: 'center',
    minWidth: 120
  },
  headerMetaLine: {
    fontSize: 8,
    marginBottom: 2
  },
  headerMetaLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: 'white'
  },
  headerMetaValue: {
    fontSize: 8,
    color: 'white'
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: CONTENT_PADDING_H,
    paddingBottom: CONTENT_PADDING_V
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4
  },
  group: {
    flexDirection: 'column'
  },
  chord: {
    fontSize: BODY_FONT_SIZE,
    fontWeight: 400,
    color: CHORD_COLOR,
    height: 14,
    paddingRight: 4
  },
  lyric: {
    fontSize: BODY_FONT_SIZE,
    color: '#1a1a1a'
  },
  spacer: {
    height: SPACER_HEIGHT
  },
  footer: {
    marginTop: 10,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 10,
    color: '#aaaaaa'
  }
});

const SongRow = ({ pairs }) => {
  const showChords = rowHasChords(pairs);

  return (
    <View style={styles.row}>
      {pairs.map((pair, i) => {
        if (!showChords) {
          return (
            <View key={i} style={styles.group}>
              <Text style={styles.lyric}>{pair.lyric}</Text>
            </View>
          );
        }

        const chordText = pair.chord !== ' ' ? pair.chord : '';
        const hasSuper =
          chordText.includes('7') ||
          chordText.includes('b') ||
          chordText.includes('#');

        let chordElement;
        if (!chordText || !hasSuper) {
          chordElement = <Text style={styles.chord}>{chordText}</Text>;
        } else {
          const segments = splitChordSegments(chordText);
          chordElement = (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: 14,
                paddingRight: 4
              }}
            >
              {segments.map((seg, idx) =>
                seg.isSuper ? (
                  <Text
                    key={idx}
                    style={{
                      fontSize: CHORD_SUPER_FONT_SIZE,
                      fontWeight: 400,
                      color: CHORD_COLOR,
                      marginBottom: 4
                    }}
                  >
                    {seg.text}
                  </Text>
                ) : (
                  <Text
                    key={idx}
                    style={{
                      fontSize: BODY_FONT_SIZE,
                      fontWeight: 400,
                      color: CHORD_COLOR
                    }}
                  >
                    {seg.text}
                  </Text>
                )
              )}
            </View>
          );
        }

        return (
          <View key={i} style={styles.group}>
            {chordElement}
            <Text style={styles.lyric}>{pair.lyric}</Text>
          </View>
        );
      })}
    </View>
  );
};

const SongColumn = ({ rows, maxWidth }) => (
  <View
    style={{
      flexDirection: 'column',
      maxWidth,
      marginHorizontal: COLUMN_MARGIN_H
    }}
  >
    {rows.map((rowPairs, i) =>
      isEmptyRow(rowPairs) ? (
        <View key={i} style={styles.spacer} />
      ) : (
        <SongRow key={i} pairs={rowPairs} />
      )
    )}
  </View>
);

/**
 * @param {Object} props
 * @param {string} props.artistName
 * @param {string} props.songTitle
 * @param {string} props.rhythm
 * @param {string} props.rhythmLabel
 * @param {string} props.transposeLabel
 * @param {string} props.originalLabel
 * @param {string} props.courseLabel
 * @param {number} props.transposeOffset
 * @param {number} [props.courseOffset]
 * @param {number} props.colWidth
 * @param {Array} props.pages  Output of paginateRows()
 */
const SongPdf = ({
  artistName,
  songTitle,
  rhythm,
  rhythmLabel,
  transposeLabel,
  originalLabel,
  courseLabel,
  transposeOffset,
  courseOffset,
  colWidth,
  pages
}) => {
  const transposeText = formatTransposeText(
    transposeOffset,
    courseOffset,
    transposeLabel,
    originalLabel,
    courseLabel
  );
  const tColonIdx = transposeText.indexOf(': ');
  const tLabel =
    tColonIdx >= 0 ? transposeText.slice(0, tColonIdx) : transposeText;
  const tValue = tColonIdx >= 0 ? transposeText.slice(tColonIdx + 2) : '';

  return (
    <Document>
      {pages.map((pageColumns, pageIdx) => (
        <Page
          key={pageIdx}
          size="A4"
          orientation="portrait"
          style={styles.page}
        >
          <View style={styles.headerWrapper}>
            <Svg style={styles.headerBg} width={A4_WIDTH} height={HEADER_HEIGHT}>
              <Defs>
                <LinearGradient id="hgrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor={GRAD_FROM} stopOpacity="1" />
                  <Stop offset="100%" stopColor={GRAD_TO} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={A4_WIDTH}
                height={HEADER_HEIGHT}
                fill="url(#hgrad)"
              />
            </Svg>

            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>
                  <Text style={styles.headerTitleArtist}>{artistName}</Text>
                  <Text style={styles.headerTitleSong}> - {songTitle}</Text>
                </Text>
              </View>
              <View style={styles.headerDivider} />
              <View style={styles.headerRight}>
                <Text style={styles.headerMetaLine}>
                  <Text style={styles.headerMetaLabel}>{rhythmLabel}: </Text>
                  <Text style={styles.headerMetaValue}>{rhythm}</Text>
                </Text>
                <Text style={styles.headerMetaLine}>
                  <Text style={styles.headerMetaLabel}>{tLabel}: </Text>
                  <Text style={styles.headerMetaValue}>{tValue}</Text>
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.contentArea}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row' }}>
                {pageColumns.map((col, ci) => (
                  <SongColumn key={ci} rows={col} maxWidth={colWidth} />
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>www.gitarologia.com</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default SongPdf;
