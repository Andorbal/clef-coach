/**
 * The band's mixer: where the band comes from (the song's own parts or the arranger),
 * its style, and per track volume, pan, mute, solo, reverb and sound. Everything has a
 * sensible default — the panel is there for those who want it.
 */
import { AudioLines, Drum, FilePlus2, Guitar, Headphones, Music2, Piano, RotateCcw, Waves } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BAND_STYLES, type BandStyle } from '../music/band';
import { gmProgramName } from '../music/gm';
import type { SongDef } from '../music/parse';
import type { BandSource } from '../perform/arranger';
import { builtinFor, builtinLabel } from '../perform/builtin';
import { type BandMix, type TrackMix, DEFAULT_MIX, trackMix } from '../perform/performer';
import type { PerfTrack } from '../perform/types';
import type { BandControls } from '../perform/useBand';
import { useBankPresets, useMidiOutputs, useSoundBanks } from '../audio/samples/useSoundBanks';
import { newSongId } from '../songs/format';
import { tracksToBandParts } from '../perform/writeBand';
import type { Score } from '../music/score';
import { useApp, useDevice } from '../state/store';
import { SoundPicker } from './SoundPicker';
import { Modal, Segmented } from './ui';
import './BandPanel.css';

function roleIcon(t: PerfTrack): ReactNode {
  if (t.drums) return <Drum size={16} />;
  if (t.role === 'bass') return <AudioLines size={16} />;
  if (t.role === 'pad') return <Waves size={16} />;
  if (t.role === 'chords') return /guitar/i.test(gmProgramName(t.program)) ? <Guitar size={16} /> : <Piano size={16} />;
  return <Music2 size={16} />;
}

/** What a track sounds like, for its row: its GM sound, and the built-in one standing in for it. */
export function soundLabel(t: PerfTrack): string {
  const sound = t.sound ?? builtinFor(t.program, t.drums);
  const built = builtinLabel(sound);
  if (t.drums || t.sound) return built;
  const gm = gmProgramName(t.program);
  return gm.toLowerCase().includes(built.toLowerCase()) ? gm : `${gm} (as ${built.toLowerCase()})`;
}

export function BandPanel({ open, onClose, song, score, band }: { open: boolean; onClose: () => void; song: SongDef; score: Score; band: BandControls }) {
  const device = useDevice();
  const navigate = useNavigate();
  const isImported = useApp(s => !!s.data.songs?.[song.id]);
  const saveSong = useApp(s => s.saveSong);
  const [saved, setSaved] = useState<string | null>(null);
  const banks = useSoundBanks();
  const presets = useBankPresets(open ? banks : []);
  const gmBank = banks.find(b => b.id === device.sounds?.gmBank);
  const outputs = useMidiOutputs();
  const midiOut = outputs.find(o => o.id === device.sounds?.bandMidiOut);
  const sounds = band.prefs.sounds ?? {};
  const { arrangement, mix, source, style } = band;
  const tracks = arrangement?.tracks ?? [];
  const setMix = (m: BandMix) => band.setPrefs({ mix: m });
  const setTrack = (t: PerfTrack, patch: Partial<TrackMix>) => setMix({ ...mix, tracks: { ...mix.tracks, [t.id]: { ...mix.tracks[t.id], ...patch } } });
  const hasOwn = !!song.band?.length;
  const showStyle = source !== 'song' || !hasOwn;
  return (
    <Modal open={open} onClose={onClose} title="Band & mix" wide>
      <div className="band-panel">
        {hasOwn && (
          <div className="set-row">
            <span>
              The band
              <span className="faint toggle-sub">
                {source === 'song' ? 'The parts written for this song.' : source === 'auto' ? 'An automatic band, from the chords.' : 'The song’s parts, and an automatic band for whatever they leave out.'}
              </span>
            </span>
            <Segmented
              size="sm"
              value={source}
              onChange={(v: BandSource) => band.setPrefs({ source: v })}
              options={[
                { value: 'song', label: 'Song’s parts' },
                { value: 'auto', label: 'Automatic' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>
        )}
        {showStyle && (
          <div className="band-styles">
            <span className="band-label">Style</span>
            <div className="chip-row">
              {BAND_STYLES.map(s => (
                <button key={s.id} className={`chip-btn ${style === s.id ? 'on' : ''}`} title={s.blurb} onClick={() => band.setPrefs({ style: s.id as BandStyle })}>
                  {s.id === 'auto' && arrangement ? `Automatic (${BAND_STYLES.find(x => x.id === arrangement.style)?.name})` : s.name}
                </button>
              ))}
            </div>
            {arrangement?.inferredChords && <p className="faint band-note">This song has no chord symbols, so the band works its chords out from the music.</p>}
          </div>
        )}

        <div className="mixer" role="table" aria-label="Mixer">
          {tracks.map(t => {
            const m = trackMix(mix, t);
            return (
              <div key={t.id} className={`mix-row ${m.mute ? 'muted' : ''}`} role="row">
                <div className="mix-name">
                  <span className="mix-icon">{roleIcon(t)}</span>
                  <span className="mix-title">
                    <strong>{t.name}</strong>
                    <span className="faint">{soundLabel(t)}</span>
                  </span>
                </div>
                <div className="mix-buttons">
                  <button className={`mix-toggle ${m.mute ? 'on mute' : ''}`} aria-pressed={m.mute} onClick={() => setTrack(t, { mute: !m.mute })} title="Mute">
                    M
                  </button>
                  <button className={`mix-toggle ${m.solo ? 'on solo' : ''}`} aria-pressed={m.solo} onClick={() => setTrack(t, { solo: !m.solo })} title="Solo">
                    S
                  </button>
                </div>
                <label className="mix-slider">
                  <span className="faint">Volume</span>
                  <input type="range" min={0} max={1} step={0.02} value={m.volume} onChange={e => setTrack(t, { volume: Number(e.target.value) })} aria-label={`${t.name} volume`} />
                </label>
                <label className="mix-slider">
                  <span className="faint">Pan {m.pan === 0 ? 'C' : m.pan < 0 ? `L${Math.round(-m.pan * 100)}` : `R${Math.round(m.pan * 100)}`}</span>
                  <input type="range" min={-1} max={1} step={0.05} value={m.pan} onChange={e => setTrack(t, { pan: Number(e.target.value) })} onDoubleClick={() => setTrack(t, { pan: t.pan })} aria-label={`${t.name} pan`} />
                </label>
                <label className="mix-slider">
                  <span className="faint">Reverb</span>
                  <input type="range" min={0} max={1} step={0.05} value={m.reverb} onChange={e => setTrack(t, { reverb: Number(e.target.value) })} aria-label={`${t.name} reverb`} />
                </label>
                {(banks.length > 0 || outputs.length > 0) && (
                  <div className="mix-sound-row">
                    <span className="faint">Sound</span>
                    <SoundPicker
                      label={`${t.name} sound`}
                      value={sounds[t.id]}
                      onChange={c => {
                        const next = { ...sounds };
                        if (c) next[t.id] = c;
                        else delete next[t.id];
                        band.setPrefs({ sounds: next });
                      }}
                      banks={banks}
                      presets={presets}
                      program={t.program}
                      drums={t.drums}
                      builtinLabel={soundLabel(t)}
                      defaultLabel={`Default: ${midiOut ? `MIDI ${midiOut.name}` : gmBank ? gmBank.name : 'built-in'}`}
                      midiOutputs={outputs}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {!tracks.length && <p className="faint">This song has nothing for a band to play.</p>}
        </div>

        <div className="mix-master">
          <label className="mix-slider">
            <span>Band volume</span>
            <input type="range" min={0} max={1} step={0.02} value={mix.master} onChange={e => setMix({ ...mix, master: Number(e.target.value) })} />
          </label>
          <label className="mix-slider">
            <span>Room</span>
            <input type="range" min={0} max={1} step={0.05} value={mix.reverb} onChange={e => setMix({ ...mix, reverb: Number(e.target.value) })} />
          </label>
          <button className="btn btn-sm btn-ghost" onClick={() => setMix(DEFAULT_MIX)}>
            <RotateCcw size={14} /> Reset the mix
          </button>
        </div>
        {tracks.some(t => t.source === 'auto') && (
          <div className="band-keep">
            <span className="faint">
              {isImported
                ? 'Keep this band: it’s written into the song as band parts, to edit by hand or share with the song.'
                : 'Keep this band: a copy of the song with the band written in goes to My songs, to edit by hand or share.'}
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                const parts = tracksToBandParts(tracks, score);
                const kept = isImported ? { ...song, band: parts } : { ...song, id: newSongId(song.title), title: `${song.title} (with band)`, band: parts };
                if (!saveSong(kept)) {
                  setSaved('There’s no room left on this device to save it.');
                  return;
                }
                if (isImported) {
                  band.setPrefs({ source: 'song' });
                  setSaved('Written into the song.');
                } else {
                  onClose();
                  navigate(`/song/${kept.id}`);
                }
              }}
            >
              <FilePlus2 size={14} /> {isImported ? 'Write it into the song' : 'Save a copy with this band'}
            </button>
            {saved && <span className="faint">{saved}</span>}
          </div>
        )}
        {device.inputMode === 'mic' && (
          <p className="band-tip">
            <Headphones size={15} /> You’re using the microphone: wear headphones so the band isn’t mistaken for your playing.
          </p>
        )}
      </div>
    </Modal>
  );
}
