import type { Habit } from '../types/profile';

const demoHabits: Habit[] = [
  { id: 'reading', name: 'Read 20 minutes', streakDays: 5 },
  { id: 'coding', name: 'Code something small', streakDays: 14 },
  { id: 'steps', name: 'Walk 6k steps', streakDays: 3 },
];

export function HabitList() {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 space-y-2">
      <h2 className="text-sm font-medium text-slate-100 uppercase tracking-[0.15em]">
        Habits
      </h2>
      <p className="text-xs text-slate-400">
        Demo streaks – will sync with real data later.
      </p>
      <ul className="mt-2 space-y-1 text-xs text-slate-300">
        {demoHabits.map((habit) => (
          <li key={habit.id} className="flex items-center justify-between">
            <span>{habit.name}</span>
            <span className="font-mono text-slate-400">
              {habit.streakDays}d
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

