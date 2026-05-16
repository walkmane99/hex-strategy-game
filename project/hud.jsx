// Tactical HUD primitives — frames, brackets, meters, chips
const { useState, useMemo } = React;

const C = {
  bg0: '#07090a', bg1: '#0d1012', bg2: '#14181b', bg3: '#1c2125', bg4: '#262c30',
  line: '#2d343a', lineStrong: '#3d464d',
  ink: '#e6e2d6', ink2: '#aaa69a', ink3: '#6b6b62', ink4: '#3f4347',
  amber: '#ff8a1e', amberBright: '#ffb547', amberSoft: '#6b3a06',
  red: '#e23a2b', redSoft: '#4a1410',
  cyan: '#2ec5d3', green: '#5eaa3a', olive: '#4a4f2a',
};

// Corner brackets — wraps any block with [ ] tactical corners
function Bracket({ children, color = C.amber, size = 10, thickness = 1, padding = 10, style = {}, label, count }) {
  const corner = (pos) => {
    const s = { position: 'absolute', width: size, height: size, borderColor: color, borderStyle: 'solid', borderWidth: 0 };
    if (pos === 'tl') Object.assign(s, { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness });
    if (pos === 'tr') Object.assign(s, { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness });
    if (pos === 'bl') Object.assign(s, { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness });
    if (pos === 'br') Object.assign(s, { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness });
    return <span style={s} key={pos} />;
  };
  return (
    <div style={{ position: 'relative', padding, ...style }}>
      {['tl','tr','bl','br'].map(corner)}
      {label && (
        <div style={{ position: 'absolute', top: -6, left: 14, background: C.bg1, padding: '0 6px',
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.18em', color: color, textTransform: 'uppercase' }}>
          {label}{count != null && <span style={{ color: C.ink3, marginLeft: 6 }}>· {count}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// Block separator with title — like [ // SECTION TITLE ___________ ]
function Header({ k, label, right, color = C.amber }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 0 6px' }}>
      <span style={{ fontFamily:'var(--mono)', fontSize:9, color, letterSpacing:'.18em' }}>{`<${k}>`}</span>
      <span style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink, letterSpacing:'.22em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ flex:1, height:1, borderTop:`1px dashed ${C.line}` }} />
      {right && <span style={{ fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.16em' }}>{right}</span>}
    </div>
  );
}

// horizontal bar meter
function Meter({ value, max = 20, color = C.amber, height = 4, segments = 20, showLabel = false }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const fillSegs = Math.round(pct * segments);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%' }}>
      <div style={{ flex:1, display:'flex', gap:1, height }}>
        {Array.from({length: segments}).map((_, i) => (
          <div key={i} style={{
            flex:1, background: i < fillSegs ? color : C.bg3,
            opacity: i < fillSegs ? 1 : 0.6,
          }} />
        ))}
      </div>
      {showLabel && <span style={{ fontFamily:'var(--mono)', fontSize:10, color, minWidth:24, textAlign:'right' }}>{value}</span>}
    </div>
  );
}

// Stat row — "ATK   ████████░░  12"
function StatRow({ label, code, value, max = 20, color = C.amber }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns: '46px 1fr 26px', gap:8, alignItems:'center', padding:'4px 0' }}>
      <div style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink2, letterSpacing:'.12em' }}>
        {code}
      </div>
      <Meter value={value} max={max} color={color} segments={10} height={6} />
      <div style={{ fontFamily:'var(--mono)', fontSize:11, color: C.ink, textAlign:'right' }}>{String(value).padStart(2,'0')}</div>
    </div>
  );
}

// Tag / chip
function Tag({ children, color = C.amber, filled = false, mono = true }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 6px', border:`1px solid ${color}`,
      background: filled ? color : 'transparent',
      color: filled ? '#0b0c0d' : color,
      fontFamily: mono ? 'var(--mono)' : 'var(--display)',
      fontSize:9, letterSpacing:'.16em', textTransform:'uppercase',
    }}>{children}</span>
  );
}

// Button (tactical)
function Btn({ children, primary, ghost, full, small, onClick, kbd, style = {} }) {
  const base = {
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
    padding: small ? '7px 12px' : '12px 16px',
    border:`1px solid ${primary ? C.amber : C.line}`,
    background: primary ? C.amber : (ghost ? 'transparent' : C.bg2),
    color: primary ? '#0a0c0d' : C.ink,
    fontFamily:'var(--display)', fontSize: small ? 12 : 14, fontWeight:700,
    letterSpacing:'.18em', textTransform:'uppercase', cursor:'pointer',
    width: full ? '100%' : 'auto',
    clipPath:'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
    ...style,
  };
  return (
    <button onClick={onClick} style={base}>
      {children}
      {kbd && <span style={{ fontFamily:'var(--mono)', fontSize:10, opacity:.7, letterSpacing:'.1em' }}>[{kbd}]</span>}
    </button>
  );
}

// scanline overlay (subtle)
function Scanlines({ opacity = 0.06 }) {
  return (
    <div style={{
      position:'absolute', inset:0, pointerEvents:'none',
      background:`repeating-linear-gradient(to bottom, rgba(255,255,255,${opacity}) 0 1px, transparent 1px 3px)`,
      mixBlendMode:'overlay',
    }} />
  );
}

// faux 'mini map'
function MiniMap({ size = 70, dots = [] }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 70" style={{ background: C.bg0, border: `1px solid ${C.line}` }}>
      <defs>
        <pattern id="mmgrid" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M 7 0 L 0 0 0 7" fill="none" stroke={C.line} strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="70" height="70" fill="url(#mmgrid)" />
      <rect x="0" y="0" width="70" height="70" fill="none" stroke={C.amber} strokeWidth="0.5" strokeDasharray="2 2" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r || 1.5} fill={d.c || C.amber} />
      ))}
    </svg>
  );
}

// ASCII-style cap row
function CapRow({ left, right, color = C.ink3 }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      fontFamily:'var(--mono)', fontSize:9, color, letterSpacing:'.16em', textTransform:'uppercase' }}>
      <span>{left}</span><span>{right}</span>
    </div>
  );
}

// Phone screen wrapper — fits inside Android frame's content area
function Screen({ children, bg = C.bg1 }) {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background: bg, color: C.ink, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:`radial-gradient(rgba(255,138,30,0.04) 1px, transparent 1px)`, backgroundSize:'24px 24px' }} />
      {children}
      <Scanlines opacity={0.04} />
    </div>
  );
}

// Top topbar within phone screen — small, dense
function PhoneTop({ left, mid, right, color = C.amber }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
      borderBottom:`1px solid ${C.line}`, background: C.bg0 }}>
      <span style={{ fontFamily:'var(--mono)', fontSize:9, color, letterSpacing:'.18em' }}>◆</span>
      <span style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink, letterSpacing:'.18em' }}>{left}</span>
      {mid && <span style={{ flex:1, textAlign:'center', fontFamily:'var(--display)', fontSize:13, fontWeight:700, letterSpacing:'.18em', color: C.ink }}>{mid}</span>}
      {!mid && <span style={{ flex:1 }} />}
      {right && <span style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink2, letterSpacing:'.14em' }}>{right}</span>}
    </div>
  );
}

// Unit icon — small SVG glyph by class
function UnitGlyph({ kind, size = 18, color = C.amber }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'TANKER': return (<svg {...props}><path d="M4 14 L12 5 L20 14 Z" /><path d="M7 14 V19 H17 V14" /></svg>);
    case 'ATTACKER': return (<svg {...props}><path d="M4 20 L20 4" /><path d="M14 4 H20 V10" /><path d="M9 9 L15 15" /></svg>);
    case 'HEALER': return (<svg {...props}><path d="M12 4 V20" /><path d="M4 12 H20" /><circle cx="12" cy="12" r="8" /></svg>);
    case 'SEEKER': return (<svg {...props}><circle cx="11" cy="11" r="6" /><path d="M15 15 L20 20" /><path d="M11 8 V14 M8 11 H14" /></svg>);
    case 'ASSASSIN': return (<svg {...props}><path d="M5 19 L19 5" /><path d="M14 5 H19 V10" /><path d="M5 14 L10 19" /></svg>);
    case 'SNIPER': return (<svg {...props}><circle cx="12" cy="12" r="7" /><path d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22" /></svg>);
    case 'ARCHER': return (<svg {...props}><path d="M5 19 Q12 5 19 19" /><path d="M5 19 L19 19" /><path d="M12 5 V19" /></svg>);
    case 'ENGINEER': return (<svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 4 V8 M12 16 V20 M4 12 H8 M16 12 H20 M6 6 L8.5 8.5 M15.5 15.5 L18 18 M6 18 L8.5 15.5 M15.5 8.5 L18 6" /></svg>);
    case 'BERSERKER': return (<svg {...props}><path d="M6 20 Q9 12 12 4 Q15 12 18 20" /><path d="M9 14 H15" /></svg>);
    case 'ILLUSION': return (<svg {...props}><path d="M5 12 Q12 5 19 12 Q12 19 5 12" /><circle cx="12" cy="12" r="2" fill={color}/></svg>);
    default: return (<svg {...props}><rect x="5" y="5" width="14" height="14" /></svg>);
  }
}

// Hex shape (pointy-top default)
function hexPath(cx, cy, r, flat = false) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + (flat ? 0 : Math.PI / 6);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return 'M' + pts.map(p => p.map(v => v.toFixed(2)).join(',')).join(' L') + ' Z';
}

Object.assign(window, {
  C, Bracket, Header, Meter, StatRow, Tag, Btn, Scanlines, MiniMap, CapRow,
  Screen, PhoneTop, UnitGlyph, hexPath,
});
