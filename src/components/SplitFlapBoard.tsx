/**
 * Split-flap departure board.
 * Scramble effect inspired by magnum6actual/flipoff (MIT).
 * Audio clip sourced from the same repo (MIT).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { QUOTES } from '../data/quotes';

const ROWS = 4;
const COLS = 22;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?\' ';
const SCRAMBLE_COLORS = [
  '#00AAFF', '#00FFCC', '#AA00FF',
  '#FF2D00', '#FFCC00', '#FFFFFF',
];
const SCRAMBLE_INTERVAL_MS = 70;
const MAX_SCRAMBLES = 11;
const STAGGER_MS = 22;
const SETTLE_MS = 150;
const CYCLE_MS = 9000;

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
  // refs[row][col] → the .tile-front element
  const frontRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );
  // innerRefs[row][col] → the .tile-inner element (for settle animation)
  const innerRefs = useRef<(HTMLDivElement | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  );
  // Current displayed grid (so we only animate changed tiles)
  const displayedGrid = useRef<string[][]>(formatGrid(QUOTES[0]));

  const [quoteIdx, setQuoteIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialise audio element once
  useEffect(() => {
    const audio = new Audio('/flap.m4a');
    audio.preload = 'auto';
    audioRef.current = audio;
  }, []);

  const animateTile = useCallback(
    (row: number, col: number, targetChar: string, delay: number) => {
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
          front.style.backgroundColor =
            SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];

          // Adjust text colour for legibility on light backgrounds
          const bg = SCRAMBLE_COLORS[count % SCRAMBLE_COLORS.length];
          span.style.color = bg === '#FFFFFF' || bg === '#FFCC00' ? '#111' : '';

          count++;
          if (count >= maxScrambles) {
            clearInterval(id);
            front.style.backgroundColor = '';
            span.style.color = '';
            span.textContent = targetChar === ' ' ? '' : targetChar;

            // Settle bounce
            inner.style.transition = `transform ${SETTLE_MS}ms ease-out`;
            inner.style.transform = 'perspective(400px) rotateX(-8deg)';
            setTimeout(() => {
              inner.style.transform = '';
              setTimeout(() => (inner.style.transition = ''), SETTLE_MS);
            }, SETTLE_MS);
          }
        }, SCRAMBLE_INTERVAL_MS);
      }, delay);
    },
    [],
  );

  const transitionTo = useCallback(
    (nextIdx: number) => {
      const nextGrid = formatGrid(QUOTES[nextIdx]);
      const current = displayedGrid.current;

      // Play audio once for the whole transition
      if (soundRef.current && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }

      // Animate only tiles that change
      nextGrid.forEach((rowChars, r) => {
        rowChars.forEach((char, c) => {
          if (char !== current[r]?.[c]) {
            animateTile(r, c, char, c * STAGGER_MS + r * 3);
          }
        });
      });

      displayedGrid.current = nextGrid;
      setQuoteIdx(nextIdx);
    },
    [animateTile],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx((idx) => {
        const next = (idx + 1) % QUOTES.length;
        transitionTo(next);
        return idx; // actual state update happens inside transitionTo → setQuoteIdx
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [transitionTo]);

  // Render the initial grid once (no re-render on animation)
  const initialGrid = formatGrid(QUOTES[0]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Board */}
      <div
        className="split-flap-board px-3 py-3 rounded-lg"
        style={{ display: 'grid', gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: '3px' }}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} style={{ display: 'flex', gap: '3px' }}>
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

      {/* Sound toggle */}
      <button
        onClick={() => setSoundOn((s) => !s)}
        className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
        title={soundOn ? 'Mute' : 'Unmute'}
      >
        {soundOn ? '🔊 sound on' : '🔇 muted'}
      </button>
    </div>
  );
}
