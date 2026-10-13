/** Renders the app icon at 1024px for screenshot-based PNG generation (dev only). */
export default function IconPreview() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const maskable = params.get('maskable') === '1';
  const size = 1024;
  // staff space and G-line baseline (the clef glyph's origin sits on the G line)
  const sp = maskable ? 74 : 90;
  const base = maskable ? 579 : 591;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'grid', placeItems: 'start' }}>
      <div
        id="icon"
        style={{
          width: size,
          height: size,
          borderRadius: maskable ? 0 : 0,
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(120% 120% at 30% 15%, #2a2560 0%, #121633 45%, #070810 100%)',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 1024 1024" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff1cc" />
              <stop offset="0.45" stopColor="#f4c97a" />
              <stop offset="1" stopColor="#c98a2e" />
            </linearGradient>
            <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(244,201,122,0.45)" />
              <stop offset="1" stopColor="rgba(244,201,122,0)" />
            </radialGradient>
          </defs>
          <circle cx="512" cy="520" r="420" fill="url(#glow)" />
          {[-1, 0, 1, 2, 3].map(i => (
            <line key={i} x1={maskable ? 190 : 120} x2={maskable ? 834 : 904} y1={base - i * sp} y2={base - i * sp} stroke="rgba(255,226,168,0.3)" strokeWidth={maskable ? 6 : 7} strokeLinecap="round" />
          ))}
          <text x="512" y={base} textAnchor="middle" fontFamily="Bravura" fontSize={sp * 4} fill="url(#gold)" style={{ filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.55))' }}>
            {'\uE050'}
          </text>
        </svg>
      </div>
    </div>
  );
}
