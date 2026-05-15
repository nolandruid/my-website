import { BadgeCanvas } from './components/BadgeCanvas';
import { SplitFlapBoard } from './components/SplitFlapBoard';
import { SocialLinks } from './components/SocialLinks';
import { ErrorBoundary } from './ErrorBoundary';

function App() {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#111] overflow-hidden flex">
      {/* Left half — Three.js canvas only. Badge stays here; no z-index conflict with HTML. */}
      <div className="w-1/2 h-full">
        <ErrorBoundary inline>
          <BadgeCanvas />
        </ErrorBoundary>
      </div>

      {/* Right half — departure board + social links */}
      <div className="w-1/2 h-full flex flex-col items-center justify-center gap-8">
        <SplitFlapBoard />
        <SocialLinks />
      </div>
    </div>
  );
}

export default App;
