import { useState } from 'react';
import { BadgeCanvas } from './components/BadgeCanvas';
import { SplitFlapBoard } from './components/SplitFlapBoard';
import { SocialLinks } from './components/SocialLinks';
import { ErrorBoundary } from './ErrorBoundary';

function App() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#111] overflow-hidden">
      {/* Full-screen Three.js canvas.
          While dragging, raise above the board so the badge travels over it. */}
      <div
        className="absolute inset-0"
        style={{ zIndex: dragging ? 20 : 1 }}
      >
        <ErrorBoundary inline>
          <BadgeCanvas
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
          />
        </ErrorBoundary>
      </div>

      {/* Board + social links — right half, pointer-events only on the elements themselves.
          Sits above canvas normally; drops below while badge is being dragged. */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-16 pointer-events-none"
        style={{ zIndex: dragging ? 5 : 10 }}
      >
        <div className="flex flex-col items-center gap-8 pointer-events-auto">
          <SplitFlapBoard />
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}

export default App;
