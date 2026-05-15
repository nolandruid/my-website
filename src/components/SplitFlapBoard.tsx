import { useState, useEffect, useRef, useCallback } from 'react';
import { QUOTES } from '../data/quotes';

const FLIP_DURATION_MS = 260;
const STAGGER_MS = 18;
const CYCLE_MS = 11000;
const MAX_LINE_LEN = 20;

function splitIntoLines(text: string, maxLen: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxLen) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function playClick(ctx: AudioContext, volume: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

interface CharProps {
  char: string;
  flipping: boolean;
  delay: number;
}

function SplitFlapChar({ char, flipping, delay }: CharProps) {
  return (
    <span
      className={`split-flap-char${flipping ? ' split-flap-animate' : ''}`}
      style={flipping ? { animationDelay: `${delay}ms` } : undefined}
    >
      {char === ' ' ? ' ' : char}
    </span>
  );
}

export function SplitFlapBoard() {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [lines, setLines] = useState(() => splitIntoLines(QUOTES[0], MAX_LINE_LEN));
  const [flipping, setFlipping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const triggerFlip = useCallback((nextIdx: number) => {
    const nextText = QUOTES[nextIdx];
    const nextLines = splitIntoLines(nextText, MAX_LINE_LEN);
    const charCount = nextText.replace(/ /g, '').length;

    setFlipping(true);

    // Staggered click sounds
    if (soundRef.current) {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      for (let i = 0; i < Math.min(charCount, 24); i++) {
        setTimeout(() => playClick(ctx, 0.12), i * STAGGER_MS);
      }
    }

    // Swap text at midpoint of animation (chars are invisible during flip)
    const swapAt = FLIP_DURATION_MS / 2;
    setTimeout(() => {
      setLines(nextLines);
      setQuoteIdx(nextIdx);
    }, swapAt);

    // Clear flipping state after all chars finish
    const done = FLIP_DURATION_MS + charCount * STAGGER_MS + 80;
    setTimeout(() => setFlipping(false), done);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx((idx) => {
        const next = (idx + 1) % QUOTES.length;
        triggerFlip(next);
        return idx; // actual update happens inside triggerFlip
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [triggerFlip]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Board */}
      <div className="split-flap-board px-6 py-5 rounded-lg flex flex-col gap-1">
        {lines.map((line, li) => (
          <div key={li} className="flex justify-center">
            {line.split('').map((char, ci) => (
              <SplitFlapChar
                key={`${li}-${ci}`}
                char={char}
                flipping={flipping}
                delay={ci * STAGGER_MS + li * 4}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Sound toggle */}
      <button
        onClick={() => setSoundOn((s) => !s)}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        title={soundOn ? 'Mute' : 'Unmute'}
      >
        {soundOn ? '🔊 sound' : '🔇 muted'}
      </button>
    </div>
  );
}
