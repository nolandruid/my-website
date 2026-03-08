import type { SleepEntry } from '../types/profile';

const demoSleep: SleepEntry[] = [
  { date: '2026-03-05', hours: 7.5, quality: 'good' },
  { date: '2026-03-06', hours: 6.2, quality: 'ok' },
  { date: '2026-03-07', hours: 8.1, quality: 'great' },
];

export function SleepOverview() {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 space-y-2">
      <h2 className="text-sm font-medium text-slate-100 uppercase tracking-[0.15em]">
        Sleep
      </h2>
      <p className="text-xs text-slate-400">
        Placeholder data – real routine coming soon.
      </p>
      <div className="mt-2 space-y-1 text-xs text-slate-300">
        {demoSleep.map((night) => (
          <div
            key={night.date}
            className="flex items-center justify-between text-[11px]"
          >
            <span className="text-slate-500">{night.date}</span>
            <span className="font-mono">{night.hours.toFixed(1)} h</span>
            <span className="capitalize text-slate-400">{night.quality}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

