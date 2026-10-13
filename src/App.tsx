import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ComponentType } from 'react';
import { setMasterVolume, unlockAudio } from './audio/context';
import { inputManager } from './audio/input/manager';
import { micInput } from './audio/input/mic';
import { setSfxEnabled, setSfxVolume, sfx } from './audio/sfx';
import { Shell } from './components/Shell';
import { useApp } from './state/store';
import Home from './screens/Home';

const Onboarding = lazy(() => import('./screens/Onboarding'));
const Learn = lazy(() => import('./screens/Learn'));
const TrackMap = lazy(() => import('./screens/TrackMap'));
const LessonPlayer = lazy(() => import('./screens/LessonPlayer'));
const Songs = lazy(() => import('./screens/Songs'));
const SongStudio = lazy(() => import('./screens/SongStudio'));
const SongImport = lazy(() => import('./screens/SongImport'));
const Studio = lazy(() => import('./screens/Studio'));
const FreePlay = lazy(() => import('./screens/Studio').then(m => ({ default: m.FreePlay })));
const FretExplorer = lazy(() => import('./screens/StudioTools').then(m => ({ default: m.FretExplorer })));
const Tuner = lazy(() => import('./screens/StudioTools').then(m => ({ default: m.Tuner })));
const Gym = lazy(() => import('./screens/StudioTools').then(m => ({ default: m.Gym })));
const Scales = lazy(() => import('./screens/StudioTools').then(m => ({ default: m.Scales })));
const MetronomeTool = lazy(() => import('./screens/MetronomeTool'));
const Progress = lazy(() => import('./screens/Progress'));
const Settings = lazy(() => import('./screens/Settings'));
const InstrumentsPreview = lazy(() => import('./dev/InstrumentsPreview'));
const NotationPreview = lazy(() => import('./dev/NotationPreview'));
const IconPreview = lazy(() => import('./dev/IconPreview'));

function RequireProfile({ children }: { children: React.ReactNode }) {
  const has = useApp(s => !!s.data.activeProfileId && !!s.data.profiles[s.data.activeProfileId]);
  if (!has) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

/** Remount a screen whenever its URL changes (e.g. "next lesson" from a results screen). */
function Keyed({ C }: { C: ComponentType }) {
  const loc = useLocation();
  return <C key={loc.pathname + loc.search} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Apply device + profile audio settings once on start. */
function AudioSettingsSync() {
  const device = useApp(s => s.device);
  const sfxOn = useApp(s => (s.data.activeProfileId ? s.data.profiles[s.data.activeProfileId]?.settings.sfx : true));
  useEffect(() => {
    setMasterVolume(device.volume);
    setSfxVolume(device.sfxVolume);
    micInput.setSensitivity(device.micSensitivity);
  }, [device.volume, device.sfxVolume, device.micSensitivity]);
  useEffect(() => {
    setSfxEnabled(sfxOn !== false);
  }, [sfxOn]);
  // iOS/Safari: audio (and mic processing) can only start inside a user gesture
  useEffect(() => {
    const onGesture = () => {
      unlockAudio()
        .then(() => {
          sfx.preload();
          const mode = useApp.getState().device.inputMode;
          if (mode === 'mic' && !micInput.active) inputManager.enableMic().catch(() => undefined);
          if (mode === 'midi' && !inputManager.status.midiEnabled) inputManager.enableMidi().catch(() => undefined);
        })
        .catch(() => undefined);
    };
    window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, []);
  return null;
}

const Fallback = () => <div className="route-loading" />;

export default function App() {
  return (
    <HashRouter>
      <div className="ambient">
        <div className="orb" style={{ width: 520, height: 520, left: '-8%', top: '-12%', background: 'rgba(120,92,255,0.5)' }} />
        <div className="orb" style={{ width: 420, height: 420, right: '-6%', top: '20%', background: 'rgba(244,201,122,0.35)', animationDelay: '-9s' }} />
      </div>
      <ScrollToTop />
      <AudioSettingsSync />
      <div className="app-root">
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/lesson/:trackId/:lessonId" element={<RequireProfile><Keyed C={LessonPlayer} /></RequireProfile>} />
            <Route path="/song/:songId" element={<RequireProfile><Keyed C={SongStudio} /></RequireProfile>} />
            <Route path="/studio/free" element={<RequireProfile><FreePlay /></RequireProfile>} />
            <Route path="/studio/fretboard" element={<RequireProfile><FretExplorer /></RequireProfile>} />
            <Route path="/studio/tuner" element={<RequireProfile><Tuner /></RequireProfile>} />
            <Route path="/studio/gym" element={<RequireProfile><Gym /></RequireProfile>} />
            <Route path="/studio/scales" element={<RequireProfile><Scales /></RequireProfile>} />
            <Route path="/studio/metronome" element={<RequireProfile><MetronomeTool /></RequireProfile>} />
            <Route path="/dev/instruments" element={<InstrumentsPreview />} />
            <Route path="/dev/notation" element={<NotationPreview />} />
            <Route path="/dev/icon" element={<IconPreview />} />
            <Route
              path="*"
              element={
                <RequireProfile>
                  <Shell>
                    <Suspense fallback={<Fallback />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/learn" element={<Learn />} />
                        <Route path="/track/:trackId" element={<Keyed C={TrackMap} />} />
                        <Route path="/songs" element={<Songs />} />
                        <Route path="/songs/import" element={<SongImport />} />
                        <Route path="/studio" element={<Studio />} />
                        <Route path="/progress" element={<Progress />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Shell>
                </RequireProfile>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </HashRouter>
  );
}
