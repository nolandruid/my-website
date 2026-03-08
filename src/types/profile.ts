export interface SleepEntry {
  date: string;
  hours: number;
  quality: 'poor' | 'ok' | 'good' | 'great';
}

export interface Habit {
  id: string;
  name: string;
  streakDays: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  link?: string;
}

