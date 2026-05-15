import { useState } from 'react';
import { BadgeCanvas } from './components/BadgeCanvas';
import { SplitFlapBoard } from './components/SplitFlapBoard';
import { SocialLinks } from './components/SocialLinks';
import { ErrorBoundary } from './ErrorBoundary';

function App() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#111] overflow-hidden">
      {/* Three.js canvas — hidden on mobile, full-screen on md+ */}
      <div
        className="hidden md:block absolute inset-0"
        style={{ zIndex: dragging ? 20 : 1 }}
      >
        <ErrorBoundary inline>
          <BadgeCanvas
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
        </ErrorBoundary>
      </div>

      {/* Board + social links
          Mobile: centered; Desktop: right-aligned with badge on left */}
      <div
        className="absolute inset-0 flex items-center justify-center md:justify-end md:pr-16 pointer-events-none"
        style={{ zIndex: dragging ? 5 : 10 }}
      >
        <div className="flex flex-col items-center gap-8 pointer-events-auto px-4 md:px-0">
          <SplitFlapBoard />
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}

export default App;
