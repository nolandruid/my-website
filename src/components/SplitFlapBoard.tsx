/**
 * Split-flap departure board.
 * Scramble effect inspired by magnum6actual/flipoff (MIT).
 * Audio clip sourced from the same repo (MIT).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { QUOTES } from '../data/quotes';

const ROWS = 4;
const COLS = 18;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?\' ';
const SCRAMBLE_COLORS = [
  '#00AAFF', '#00FFCC', '#AA00FF',
  '#FF2D00', '#FFCC00', '#FFFFFF',
];
const SCRAMBLE_INTERVAL_MS = 110;  // slower — visible scramble
const MAX_SCRAMBLES = 13;
const COL_STAGGER_MS = 25;         // delay between columns within a row
const ROW_STAGGER_MS = 1600;       // each row starts this many ms after the previous
const SETTLE_MS = 180;
const CYCLE_MS = 15000;

// ── helpers ──────────────────────────────────────────────────────────────────

function formatGrid(quote: string): string[][] {
  const words = quote.split(' ');
  const rawLines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= COLS) {
      current += ' ' + word;
    } else {
      rawLines.push(current);
      current = word;
    }
  }
  if (current) rawLines.push(current);

  // Centre vertically in ROWS rows
  while (rawLines.length < ROWS) {
    rawLines.unshift('');
    if (rawLines.length < ROWS) rawLines.push('');
  }
  rawLines.length = ROWS;

  // Centre-align each line within COLS cols
  return rawLines.map((line) => {
    const pad = Math.floor((COLS - line.length) / 2);
    const padded = ' '.repeat(pad) + line;
    return padded.padEnd(COLS).split('');
  });
}

// ── component ─────────────────────────────────────────────────────────────────

export function SplitFlapBoard() {
  const frontRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );
  const innerRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );
  const displayedGrid = useRef<string[][]>(formatGrid(QUOTES[0]));
  const isTransitioning = useRef(false);

  const [quoteIdx, setQuoteIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio('/flap.m4a');
    audio.preload = 'auto';
    audioRef.current = audio;
  }, []);

  // Animate a single tile: scramble then settle on targetChar
  const animateTile = useCallback(
    (row: number, col: number, targetChar: string, delayMs: number) => {
      setTimeout(() => {
        const front = frontRefs.current[row]?.[col];
        const inner = innerRefs.current[row]?.[col];
        if (!front || !inner) return;

        const span = front.querySelector('span') as HTMLSpanElement;
        let count = 0;
        const maxScrambles = MAX_SCRAMBLES + Math.floor(Math.random() * 4);

        const id = setInterval(() => {
          const randChar = CHARSET[Math.floor(Math.random() * CHARSET.length)];
          span.textContent = randChar === ' ' ? '' : randChar;
          const bg = SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];
          front.style.backgroundColor = bg;
          span.style.color = bg === '#FFFFFF' || bg === '#FFCC00' ? '#111' : '';

          count++;
          if (count >= maxScrambles) {
            clearInterval(id);
            front.style.backgroundColor = '';
            span.style.color = '';
            span.textContent = targetChar === ' ' ? '' : targetChar;

            inner.style.transition = `transform ${SETTLE_MS}ms ease-out`;
            inner.style.transform = 'perspective(500px) rotateX(-8deg)';
            setTimeout(() => {
              inner.style.transform = '';
              setTimeout(() => (inner.style.transition = ''), SETTLE_MS);
            }, SETTLE_MS);
          }
        }, SCRAMBLE_INTERVAL_MS);
      }, delayMs);
    },
    [],
  );

  const transitionTo = useCallback(
    (nextIdx: number) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      const nextGrid = formatGrid(QUOTES[nextIdx]);
      const current = displayedGrid.current;

      // Animate rows one after another; play audio at the moment each row starts
      nextGrid.forEach((rowChars, r) => {
        const rowDelay = r * ROW_STAGGER_MS;
        const rowHasChange = rowChars.some((char, c) => char !== current[r]?.[c]);
        if (rowHasChange) {
          setTimeout(() => {
            if (soundRef.current && audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }, rowDelay);
        }
        rowChars.forEach((char, c) => {
          if (char !== current[r]?.[c]) {
            animateTile(r, c, char, rowDelay + c * COL_STAGGER_MS);
          }
        });
      });

      displayedGrid.current = nextGrid;
      setQuoteIdx(nextIdx);

      // Unlock after all rows finish
      const totalDuration =
        ROWS * ROW_STAGGER_MS + COLS * COL_STAGGER_MS + MAX_SCRAMBLES * SCRAMBLE_INTERVAL_MS + 500;
      setTimeout(() => {
        isTransitioning.current = false;
      }, totalDuration);
    },
    [animateTile],
  );

  // Auto-cycle
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx((idx) => {
        const next = (idx + 1) % QUOTES.length;
        transitionTo(next);
        return idx;
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [transitionTo]);

  const handleNext = useCallback(() => {
    setQuoteIdx((idx) => {
      const next = (idx + 1) % QUOTES.length;
      transitionTo(next);
      return idx;
    });
  }, [transitionTo]);

  const initialGrid = formatGrid(QUOTES[0]);

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {/* Board */}
      <div
        className="split-flap-board px-4 py-4 rounded-lg"
        style={{ display: 'grid', gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: '6px' }}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: COLS }, (_, c) => {
              const ch = initialGrid[r][c];
              return (
                <div key={c} className="tile">
                  <div
                    className="tile-inner"
                    ref={(el) => { innerRefs.current[r][c] = el; }}
                  >
                    <div
                      className="tile-front"
                      ref={(el) => { frontRefs.current[r][c] = el; }}
                    >
                      <span>{ch === ' ' ? '' : ch}</span>
                    </div>
                    <div className="tile-back">
                      <span />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={handleNext}
          className="px-4 py-1.5 text-sm font-mono font-semibold tracking-widest
                     border border-neutral-700 text-neutral-300
                     hover:border-neutral-400 hover:text-white
                     transition-colors duration-150 rounded"
        >
          NEXT →
        </button>
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="text-sm text-neutral-600 hover:text-neutral-300 transition-colors"
          title={soundOn ? 'Mute' : 'Unmute'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
