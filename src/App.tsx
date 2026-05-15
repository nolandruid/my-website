import { BadgeCanvas } from './components/BadgeCanvas';
import { SplitFlapBoard } from './components/SplitFlapBoard';
import { SocialLinks } from './components/SocialLinks';
import { ErrorBoundary } from './ErrorBoundary';

function App() {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#111] overflow-hidden">
      {/* Full-screen Three.js canvas — badge anchor shifted left internally */}
      <ErrorBoundary inline>
        <BadgeCanvas />
      </ErrorBoundary>

      {/* HTML overlay — right half: split-flap board */}
      <div className="absolute inset-0 pointer-events-none flex">
        <div className="flex-1" /> {/* left half: let Three.js handle mouse events */}
        <div className="flex-1 flex items-center justify-center pointer-events-auto">
          <SplitFlapBoard />
        </div>
      </div>

      {/* Social links — bottom centre */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto">
        <SocialLinks />
      </div>
    </div>
  );
}

export default App;
