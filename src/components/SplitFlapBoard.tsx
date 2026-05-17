/**
 * Split-flap departure board.
 * Scramble effect inspired by magnum6actual/flipoff (MIT).
 * Audio clip sourced from the same repo (MIT).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { QUOTES } from '../data/quotes';

const ROWS = 6;
const COLS = 18;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?\' ';
const SCRAMBLE_COLORS = [
  '#00AAFF', '#00FFCC', '#AA00FF',
  '#FF2D00', '#FFCC00', '#FFFFFF',
];
const SCRAMBLE_INTERVAL_MS = 110;  // slower — visible scramble
const MAX_SCRAMBLES = 13;
const COL_STAGGER_MS = 25;         // delay between columns within a row
const ROW_STAGGER_MS = 750;        // each row starts ~halfway through the previous row's scramble
const SETTLE_MS = 180;
const CYCLE_MS = 15000;

// ── helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fitsBoard(quote: string): boolean {
  const words = quote.split(' ');
  let lines = 0;
  let cur = '';
  for (const word of words) {
    if (word.length > COLS) return false;
    if (!cur) { cur = word; }
    else if (cur.length + 1 + word.length <= COLS) { cur += ' ' + word; }
    else { lines++; cur = word; if (lines >= ROWS) return false; }
  }
  return true;
}

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

  // Place content in the upper third so short quotes don't sink to the middle
  const topPad = Math.floor((ROWS - rawLines.length) / 2);
  const padded: string[] = [...Array(topPad).fill(''), ...rawLines];
  while (padded.length < ROWS) padded.push('');
  padded.length = ROWS;
  const result = padded;

  // Centre-align each line within COLS cols
  return result.map((line) => {
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
  const [pool, setPool] = useState<string[]>(shuffle(QUOTES));
  const poolRef = useRef(pool);
  poolRef.current = pool;

  // Fetch fresh quotes from type.fit, filter to ones that fit the board, merge + reshuffle
  useEffect(() => {
    fetch('https://type.fit/api/quotes')
      .then((r) => r.json())
      .then((data: Array<{ text: string }>) => {
        const fetched = data
          .map((q) => q.text.toUpperCase().replace(/\s+/g, ' ').trim())
          .filter((q) => fitsBoard(q) && q.length > 8);
        setPool(shuffle([...QUOTES, ...fetched]));
      })
      .catch(() => {});
  }, []);

  const displayedGrid = useRef<string[][]>(formatGrid(pool[0]));
  const isTransitioning = useRef(false);
  const currentIdxRef = useRef(0);
  const stopAudioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playAudioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Cancel any pending audio timers from a previous (possibly interrupted) transition
      if (stopAudioTimer.current !== null) {
        clearTimeout(stopAudioTimer.current);
        stopAudioTimer.current = null;
      }
      if (playAudioTimer.current !== null) {
        clearTimeout(playAudioTimer.current);
        playAudioTimer.current = null;
      }

      const nextGrid = formatGrid(poolRef.current[nextIdx] ?? poolRef.current[0]);
      const current = displayedGrid.current;

      // Stagger rows relative to the first row that has changes, so empty leading
      // rows don't cause a visible delay before anything moves
      let firstChangingRow = ROWS;
      nextGrid.forEach((rowChars, r) => {
        if (firstChangingRow === ROWS && rowChars.some((char, c) => char !== current[r]?.[c])) {
          firstChangingRow = r;
        }
      });

      // Compute min/max tile delays for audio start and stop
      let minChangeDelay = Infinity;
      let maxChangeDelay = -Infinity;
      nextGrid.forEach((rowChars, r) => {
        rowChars.forEach((char, c) => {
          if (char !== current[r]?.[c]) {
            const d = (r - firstChangingRow) * ROW_STAGGER_MS + c * COL_STAGGER_MS;
            if (d < minChangeDelay) minChangeDelay = d;
            if (d > maxChangeDelay) maxChangeDelay = d;
          }
        });
      });
      if (minChangeDelay !== Infinity) {
        playAudioTimer.current = setTimeout(() => {
          playAudioTimer.current = null;
          if (soundRef.current && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }, minChangeDelay + SCRAMBLE_INTERVAL_MS);
      }

      // Animate rows, staggered from the first changing row
      nextGrid.forEach((rowChars, r) => {
        const rowDelay = (r - firstChangingRow) * ROW_STAGGER_MS;
        rowChars.forEach((char, c) => {
          if (char !== current[r]?.[c]) {
            animateTile(r, c, char, rowDelay + c * COL_STAGGER_MS);
          }
        });
      });

      displayedGrid.current = nextGrid;
      currentIdxRef.current = nextIdx;
      setQuoteIdx(nextIdx);

      // Stop audio and unlock when the last changing tile settles
      // MAX_SCRAMBLES+3 covers the random extra scrambles; SETTLE_MS*2 covers both settle phases
      const totalDuration =
        maxChangeDelay + (MAX_SCRAMBLES + 3) * SCRAMBLE_INTERVAL_MS + SETTLE_MS * 2;
      stopAudioTimer.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        stopAudioTimer.current = null;
        isTransitioning.current = false;
      }, totalDuration);
    },
    [animateTile],
  );

  // Auto-cycle
  useEffect(() => {
    const id = setInterval(() => {
      const next = (currentIdxRef.current + 1) % poolRef.current.length;
      transitionTo(next);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [transitionTo]);

  const handleNext = useCallback(() => {
    isTransitioning.current = false; // user intent overrides guard
    const next = (currentIdxRef.current + 1) % poolRef.current.length;
    transitionTo(next);
  }, [transitionTo]);

  const initialGrid = formatGrid(pool[0]);

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
          onClick={() => {
            const next = !soundRef.current;
            soundRef.current = next;
            setSoundOn(next);
          }}
          className="text-sm text-neutral-600 hover:text-neutral-300 transition-colors"
          title={soundOn ? 'Mute' : 'Unmute'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
