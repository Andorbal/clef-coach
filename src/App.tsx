import { HashRouter, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const InstrumentsPreview = lazy(() => import('./dev/InstrumentsPreview'));

export default function App() {
  return (
    <HashRouter>
      <div className="ambient" />
      <div className="app-root">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/dev/instruments" element={<InstrumentsPreview />} />
            <Route path="*" element={<div className="page"><h1 className="display">Clef Coach</h1></div>} />
          </Routes>
        </Suspense>
      </div>
    </HashRouter>
  );
}
