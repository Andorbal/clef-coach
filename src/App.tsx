import { lazy, Suspense, useEffect, useRef } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ComponentType } from 'react';
import { hasAudioContext, setMasterVolume, unlockAudio } from './audio/context';
import { setSynthCacheBudget, synth } from './audio/synth';
import { deviceCapability } from './platform';
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
const ChordChart = lazy(() => import('./screens/ChordChart'));
const Progress = lazy(() => import('./screens/Progress'));
const Settings = lazy(() => import('./screens/Settings'));
const SoundsSettings = lazy(() => import('./screens/SoundsSettings'));
const InstrumentsPreview = lazy(() => import('./dev/InstrumentsPreview'));
const NotationPreview = lazy(() => import('./dev/NotationPreview'));
const IconPreview = lazy(() => import('./dev/IconPreview'));

/** `screen`: what it guards is a screen (see Screen); the Shell marks its own, inside it. */
function RequireProfile({ children, screen = true }: { children: React.ReactNode; screen?: boolean }) {
  const has = useApp(s => !!s.data.activeProfileId && !!s.data.profiles[s.data.activeProfileId]);
  if (!has) return <Navigate to="/welcome" replace />;
  return screen ? <Screen>{children}</Screen> : <>{children}</>;
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

/**
 * Leaving a screen (back, a tab, a link) silences whatever it was playing — a song
 * preview, a chord, the other hand. Screens stop their own playback too; this is the
 * safety net for anything still ringing.
 */
function StopSoundOnNavigate() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (hasAudioContext()) synth.stopAll();
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
  // sampled instruments chosen for this device (their banks open when first needed)
  useEffect(() => {
    if (device.sounds) void import('./audio/samples/apply').then(m => m.applySoundSettings(device.sounds));
  }, [device.sounds]);
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

// rendered notes are kept for reuse: a band needs many more than one instrument, so
// devices with memory to spare keep more of them
{
  const cap = deviceCapability();
  setSynthCacheBudget((cap.low ? 64 : cap.memoryGB !== undefined && cap.memoryGB >= 8 ? 256 : 128) * 1024 * 1024);
}

/** While a screen's code downloads (the first visit to it): a thin bar along the top. */
const Fallback = () => <div className="route-loading" role="progressbar" aria-label="Loading" />;

/**
 * A screen, taking down index.html's loading screen when it first shows. Its marker sits
 * beside the screen, so it appears only with it: not with a first render that only
 * redirects (to /welcome, say), nor while the screen's code is still downloading (whether
 * Suspense shows its fallback or a navigation keeps the old screen up meanwhile).
 */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BootDone />
    </>
  );
}

function BootDone() {
  useEffect(() => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.classList.add('boot-done');
    setTimeout(() => boot.remove(), 300);
  }, []);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <div className="ambient">
        {/* 160px larger than the glowing disc on every side: room for its soft edge */}
        <div className="orb" style={{ width: 840, height: 840, left: 'calc(-8% - 160px)', top: 'calc(-12% - 160px)', ['--orb' as string]: 'rgba(120,92,255,0.5)' }} />
        <div className="orb" style={{ width: 740, height: 740, right: 'calc(-6% - 160px)', top: 'calc(20% - 160px)', ['--orb' as string]: 'rgba(244,201,122,0.35)', animationDelay: '-9s' }} />
      </div>
      <ScrollToTop />
      <StopSoundOnNavigate />
      <AudioSettingsSync />
      <div className="app-root">
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/welcome" element={<Screen><Onboarding /></Screen>} />
            <Route path="/lesson/:trackId/:lessonId" element={<RequireProfile><Keyed C={LessonPlayer} /></RequireProfile>} />
            <Route path="/song/:songId" element={<RequireProfile><Keyed C={SongStudio} /></RequireProfile>} />
            <Route path="/studio/free" element={<RequireProfile><FreePlay /></RequireProfile>} />
            <Route path="/studio/fretboard" element={<RequireProfile><FretExplorer /></RequireProfile>} />
            <Route path="/studio/tuner" element={<RequireProfile><Tuner /></RequireProfile>} />
            <Route path="/studio/gym" element={<RequireProfile><Gym /></RequireProfile>} />
            <Route path="/studio/scales" element={<RequireProfile><Scales /></RequireProfile>} />
            <Route path="/studio/metronome" element={<RequireProfile><MetronomeTool /></RequireProfile>} />
            <Route path="/dev/instruments" element={<Screen><InstrumentsPreview /></Screen>} />
            <Route path="/dev/notation" element={<Screen><NotationPreview /></Screen>} />
            <Route path="/dev/icon" element={<Screen><IconPreview /></Screen>} />
            <Route
              path="*"
              element={
                <RequireProfile screen={false}>
                  <Shell>
                    <Suspense fallback={<Fallback />}>
                      <Screen>
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/learn" element={<Learn />} />
                          <Route path="/track/:trackId" element={<Keyed C={TrackMap} />} />
                          <Route path="/songs" element={<Songs />} />
                          <Route path="/songs/import" element={<SongImport />} />
                          <Route path="/studio" element={<Studio />} />
                          <Route path="/chords" element={<ChordChart />} />
                          <Route path="/progress" element={<Progress />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/settings/sounds" element={<SoundsSettings />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </Screen>
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
