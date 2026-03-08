import type { Project } from '../types/profile';

const demoProjects: Project[] = [
  {
    id: 'badge',
    name: '3D Vercel-style Badge',
    description: 'Interactive lanyard card with physics, inspired by Vercel Ship.',
    link: 'https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber',
  },
  {
    id: 'life-dashboard',
    name: 'Life Dashboard',
    description: 'Sleep, habits, and projects tracked in one place.',
  },
];

export function ProjectList() {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 space-y-2">
      <h2 className="text-sm font-medium text-slate-100 uppercase tracking-[0.15em]">
        Projects
      </h2>
      <p className="text-xs text-slate-400">
        A tiny preview of what&apos;s coming.
      </p>
      <div className="mt-2 space-y-2 text-xs text-slate-300">
        {demoProjects.map((project) => (
          <div key={project.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{project.name}</span>
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-sky-400 hover:text-sky-300"
                >
                  View
                </a>
              )}
            </div>
            <p className="text-slate-400 text-[11px]">{project.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

