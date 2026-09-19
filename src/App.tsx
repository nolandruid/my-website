import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Read the initial theme: stored preference first, then system preference. */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage may be unavailable (private mode, blocked cookies) */
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Reflect the choice on the root element for CSS variables to pick up.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore write failures */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle];
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="page">
      <main className="content">
        {/* Hero: name replaces the reference site's signature */}
        <header className="hero">
          <div className="name-row">
            <h1 className="name">Nolan Druid</h1>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          {/* TODO: Nolan to edit - one-line intro of what you're doing right now */}
          <p className="tagline">
            Student, builder, and blockchain enthusiast based in Ottawa.
          </p>
        </header>

        {/* ── /now ── */}
        <section className="section" aria-labelledby="now-heading">
          <h2 id="now-heading" className="section-label">now</h2>
          {/* TODO: Nolan to edit - what you're focused on these days */}
          <ul className="bullets">
            <li>
              <span className="emoji" aria-hidden="true">🎓</span>
              Studying at <strong>Carleton University</strong> and building things on
              the side.
            </li>
            <li>
              <span className="emoji" aria-hidden="true">⛓️</span>
              Getting involved with{' '}
              <a href="https://ottawablockchain.ca" target="_blank" rel="noreferrer">
                Ottawa Blockchain
              </a>
              , exploring decentralized tech and community.
            </li>
            <li>
              <span className="emoji" aria-hidden="true">💻</span>
              Learning in public and shipping small projects on{' '}
              <a href="https://github.com/nolandruid" target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </li>
          </ul>
        </section>

        {/* ── /projects ── */}
        <section className="section" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="section-label">projects</h2>
          {/* TODO: Nolan to edit - replace the placeholder projects below with real ones */}
          <ul className="cards">
            <li className="card">
              <a href="https://ottawablockchain.ca" target="_blank" rel="noreferrer">
                Ottawa Blockchain
              </a>
              <p className="card-desc">
                Community and events around blockchain and Web3 in Ottawa.
              </p>
            </li>
            {/* TODO: Nolan to edit - placeholder project */}
            <li className="card">
              <span className="card-title-static">Project One</span>
              <p className="card-desc">
                A short description of something you built. Add a link when it's live.
              </p>
            </li>
            {/* TODO: Nolan to edit - placeholder project */}
            <li className="card">
              <span className="card-title-static">Project Two</span>
              <p className="card-desc">
                Another placeholder. Swap in a real project and a one-line summary.
              </p>
            </li>
          </ul>
        </section>

        {/* ── /about ── */}
        <section className="section" aria-labelledby="about-heading">
          <h2 id="about-heading" className="section-label">about</h2>
          {/* TODO: Nolan to edit - a couple of sentences about who you are */}
          <p className="prose">
            I'm Nolan, a Carleton University student and builder based in Ottawa. I like
            learning how things work, contributing to communities, and turning ideas
            into working software.
          </p>
        </section>

        {/* ── /elsewhere ── */}
        <section className="section" aria-labelledby="elsewhere-heading">
          <h2 id="elsewhere-heading" className="section-label">elsewhere</h2>
          <ul className="links">
            <li>
              <a href="https://github.com/nolandruid" target="_blank" rel="noreferrer">
                <GitHubIcon /> GitHub
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/nolandruid/"
                target="_blank"
                rel="noreferrer"
              >
                <LinkedInIcon /> LinkedIn
              </a>
            </li>
            <li>
              <a href="https://ottawablockchain.ca" target="_blank" rel="noreferrer">
                <span className="emoji" aria-hidden="true">⛓️</span> Ottawa Blockchain
              </a>
            </li>
          </ul>
        </section>

        <footer className="footer">
          <span className="footer-name">Nolan Druid</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
