import { AudioWaveform, BarChart3, Compass, Grid2x2, Home, Library, Settings, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useProfile } from '../state/store';
import { Avatar, Logo } from './ui';
import './Shell.css';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/learn', label: 'Learn', icon: Compass },
  { to: '/songs', label: 'Songs', icon: Library },
  { to: '/chords', label: 'Chords', icon: Grid2x2, railOnly: true },
  { to: '/synth', label: 'Synths', icon: AudioWaveform, railOnly: true },
  { to: '/studio', label: 'Studio', icon: Sparkles },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
];

export function Shell({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const navigate = useNavigate();
  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <button className="rail-logo" onClick={() => navigate('/')} aria-label="Clef Coach home">
          <Logo size={40} />
        </button>
        <div className="rail-items">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}>
              <n.icon size={22} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
        <NavLink to="/settings" className={({ isActive }) => `rail-item rail-settings ${isActive ? 'active' : ''}`}>
          {profile ? <Avatar name={profile.name} hue={profile.hue} size={32} /> : <Settings size={22} />}
          <span>Settings</span>
        </NavLink>
      </nav>
      <div className="shell-main">{children}</div>
      <nav className="tabs" aria-label="Main">
        {NAV.filter(n => !n.railOnly).map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <n.icon size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="display page-title">{title}</h1>
        {sub && <p className="dim page-sub">{sub}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}

export function MobileSettingsButton() {
  const profile = useProfile();
  return (
    <NavLink to="/settings" className="mobile-settings" aria-label="Settings">
      {profile ? <Avatar name={profile.name} hue={profile.hue} size={36} /> : <Settings size={22} />}
    </NavLink>
  );
}
