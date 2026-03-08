import { BadgeCanvas } from './components/BadgeCanvas';
import { ErrorBoundary } from './ErrorBoundary';

function App() {
  return (
    <div className="fixed inset-0 w-full h-full bg-[#111]">
      <ErrorBoundary inline>
        <BadgeCanvas />
      </ErrorBoundary>
    </div>
  );
}

export default App;
