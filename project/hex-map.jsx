// Hex grid battlefield map
const { hexPath } = window;
const TILE_IMG = {
  '.': 'assets/tile-plains.png',
  '^': 'assets/tile-mountain.png',
  'f': 'assets/tile-forest.png',
  '~': 'assets/tile-water.png',
  '#': 'assets/tile-building.png',
  'x': 'assets/tile-rubble.png',
};
// Terrain codes: . plain  ^ height  f forest  ~ water  # building  x rubble
const TERRAIN = {
  '.': { name: '平地', code: 'PLN', def: 0, mv: 1, fill: '#1a1f1d', stroke: '#252b29', label: '#4a5248' },
  '^': { name: '高地', code: 'HGT', def: 3, mv: 2, fill: '#2a2418', stroke: '#3a3120', label: '#9a7a3f' },
  'f': { name: '森林', code: 'FOR', def: 2, mv: 2, fill: '#162119', stroke: '#1f3025', label: '#4a8055' },
  '~': { name: '水場', code: 'WTR', def:-1, mv: 3, fill: '#0e1a23', stroke: '#1a2b39', label: '#3a5e7a' },
  '#': { name: '建物', code: 'BLD', def: 4, mv: 1, fill: '#23201a', stroke: '#3b362a', label: '#a08755' },
  'x': { name: '丘陵', code: 'HIL', def: 1, mv: 2, fill: '#1a2218', stroke: '#2b3325', label: '#6a8055' },
};

// Map presets — each is 10 rows × 10 chars
const MAPS = {
  '都市部 / URBAN': [
    '..##..f...',
    '.##....f..',
    '.#..^^.fff',
    '...^##..f.',
    '..^.##....',
    '..xx..~~..',
    '...x.~~...',
    'f...~~..##',
    'ff.~~...##',
    '.f....x...',
  ],
  '渓谷 / VALLEY': [
    '^^^.....^^',
    '^^......^^',
    '^...ff..^.',
    '....fff...',
    '...~~~....',
    '...~~~....',
    '...~~~....',
    '...fff....',
    '^...ff...^',
    '^^.....^^^',
  ],
  '森林帯 / WOODS': [
    'fff..fff..',
    'ff..ffff..',
    'f...ff^^..',
    '...ff^^^..',
    '..ff..^^..',
    '..ff..xx..',
    '...ff.xx..',
    'f..fff.ff.',
    'ff..fff.ff',
    'fff..ff.ff',
  ],
  '廃墟 / RUINS': [
    '##..xx..##',
    '#x..xx..x#',
    'xx....xx..',
    '..####....',
    '..####.xx.',
    '.xx.##....',
    '....##.xx.',
    'xx....xx..',
    '#x..xx..x#',
    '##..xx..##',
  ],
};

// Convert (col,row) → pixel for pointy-top hexes (offset row layout)
function hexCenter(col, row, r) {
  const sqrt3 = Math.sqrt(3);
  const x = sqrt3 * r * (col + 0.5 + (row % 2 ? 0.5 : 0));
  const y = r + row * 1.5 * r;
  return { x, y };
}

function HexMap({ preset = '都市部 / URBAN', width = 360, showFog = true, showThreat = true, showSightLines = false, accent = '#ff8a1e', interactive = true, units = null, focusCell = null }) {
  const map = MAPS[preset] || MAPS['都市部 / URBAN'];
  const cols = 10, rows = 10;
  const r = 18; // hex radius (corner-to-center)
  const pad = 6;
  const sqrt3 = Math.sqrt(3);
  const w = pad * 2 + sqrt3 * r * (cols + 0.5);
  const h = pad * 2 + r * (1.5 * (rows - 1) + 2);
  const scale = width / w;

  // Default units (placed for the urban scene)
  const defaultBlue = [
    { col: 1, row: 8, kind: 'TANKER',   id: 'B1', hp: 92 },
    { col: 2, row: 7, kind: 'ATTACKER', id: 'B2', hp: 78 },
    { col: 3, row: 8, kind: 'HEALER',   id: 'B3', hp: 100 },
    { col: 0, row: 6, kind: 'SEEKER',   id: 'B4', hp: 64 },
    { col: 4, row: 6, kind: 'ARCHER',   id: 'B5', hp: 85 },
  ];
  const defaultRed = [
    { col: 7, row: 1, kind: 'SNIPER',   id: 'R1', hp: 100, spotted: false },
    { col: 8, row: 2, kind: 'TANKER',   id: 'R2', hp: 100, spotted: true },
    { col: 6, row: 2, kind: 'ATTACKER', id: 'R3', hp: 88,  spotted: true },
    { col: 9, row: 4, kind: 'ASSASSIN', id: 'R4', hp: 100, spotted: false, ghost: true },
    { col: 5, row: 1, kind: 'ARCHER',   id: 'R5', hp: 100, spotted: false },
  ];

  const blue = (units && units.blue) || defaultBlue;
  const red  = (units && units.red)  || defaultRed;

  // Selected unit (Tanker) — highlight movement range
  const sel = blue[0];
  const selCenter = hexCenter(sel.col, sel.row, r);
  const moveCells = [];
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    const dx = Math.abs(c - sel.col); const dy = Math.abs(rr - sel.row);
    if (dx + dy > 0 && dx + dy <= 3 && map[rr][c] !== '~' && map[rr][c] !== '#') moveCells.push([c, rr]);
  }

  // Threat tiles (red ranged units' arcs)
  const threatCells = [];
  if (showThreat) {
    red.filter(u => u.spotted).forEach(u => {
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        const d = Math.abs(c - u.col) + Math.abs(rr - u.row);
        if (d > 0 && d <= 3) threatCells.push([c, rr]);
      }
    });
  }

  return (
    <svg width={width} height={h * scale} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      <defs>
        <pattern id="fogPat" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#05070a" />
          <circle cx="1" cy="1" r="0.4" fill="#0e1216" />
        </pattern>
        <pattern id="threatPat" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="#e23a2b" strokeWidth="0.6" opacity=".5" />
        </pattern>
        <radialGradient id="moveGlow">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </radialGradient>
        <filter id="hexShadow">
          <feDropShadow dx="0" dy="0.5" stdDeviation="0.4" floodOpacity="0.4" floodColor="#000"/>
        </filter>
        {/* painted terrain tile clip — pointy-top hex */}
        <clipPath id="hexClip" clipPathUnits="objectBoundingBox">
          <polygon points="0.5,0 1,0.25 1,0.75 0.5,1 0,0.75 0,0.25"/>
        </clipPath>
      </defs>

      {/* outer frame */}
      <rect x="0.5" y="0.5" width={w-1} height={h-1} fill="#06080a" stroke="#2d343a" strokeWidth="0.5" />
      {/* corner ticks */}
      {[[0,0],[w,0],[0,h],[w,h]].map(([x,y], i) => (
        <g key={i} stroke={accent} strokeWidth="0.6">
          <line x1={x + (i%2?-6:6)} y1={y} x2={x} y2={y}/>
          <line x1={x} y1={y + (i>1?-6:6)} x2={x} y2={y}/>
        </g>
      ))}

      {/* grid coordinates */}
      {Array.from({length:cols}).map((_,i) => (
        <text key={'cx'+i} x={pad + sqrt3*r*(i + 0.5)} y={9} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="5" fill="#3f4347">{String.fromCharCode(65+i)}</text>
      ))}

      {/* hex tiles */}
      {map.map((row, ri) => row.split('').map((ch, ci) => {
        const t = TERRAIN[ch] || TERRAIN['.'];
        const { x, y } = hexCenter(ci, ri, r);
        const cx = pad + x;
        const cy = pad + y;
        const isMove = moveCells.some(([c, r]) => c === ci && r === ri);
        const isThreat = threatCells.some(([c, r]) => c === ci && r === ri);
        const isSel = ci === sel.col && ri === sel.row;
        const isFocus = focusCell && focusCell[0] === ci && focusCell[1] === ri;
        const painted = TILE_IMG[ch];
        return (
          <g key={`${ci}-${ri}`}>
            <path d={hexPath(cx, cy, r - 0.6)} fill={painted ? '#0a0c0a' : t.fill} stroke={t.stroke} strokeWidth="0.6" filter="url(#hexShadow)" />
            {painted && (
              <g clipPath={`url(#hexClipTile-${ci}-${ri})`}>
                <clipPath id={`hexClipTile-${ci}-${ri}`}><path d={hexPath(cx, cy, r - 0.9)} /></clipPath>
                <image
                  href={painted}
                  x={cx - (r - 0.6)}
                  y={cy - (r - 0.6)}
                  width={(r - 0.6) * 2}
                  height={(r - 0.6) * 2}
                  preserveAspectRatio="xMidYMid slice"
                />
                {/* subtle inner shadow ring */}
                <path d={hexPath(cx, cy, r - 0.9)} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8"/>
              </g>
            )}
            {/* tactical glyphs for non-painted terrain */}
            {!painted && ch === '~' && <g stroke={t.label} strokeWidth="0.6" fill="none">
              <path d={`M ${cx-5} ${cy-1} q 2 -2 4 0 q 2 2 4 0`}/><path d={`M ${cx-5} ${cy+3} q 2 -2 4 0 q 2 2 4 0`}/></g>}
            {!painted && ch === '#' && <g stroke={t.label} strokeWidth="0.6" fill="none">
              <rect x={cx-5} y={cy-4} width="10" height="8"/><line x1={cx} y1={cy-4} x2={cx} y2={cy+4}/><line x1={cx-5} y1={cy} x2={cx+5} y2={cy}/></g>}
            {!painted && ch === 'x' && <g stroke={t.label} strokeWidth="0.6" fill="none">
              <path d={`M ${cx-4} ${cy+3} L ${cx-1} ${cy-2} L ${cx+2} ${cy+3} L ${cx+5} ${cy-1}`}/></g>}
            {/* threat overlay */}
            {isThreat && <path d={hexPath(cx, cy, r - 1)} fill="url(#threatPat)" opacity="0.55" />}
            {/* movement overlay */}
            {isMove && (
              <path d={hexPath(cx, cy, r - 1.5)} fill="none" stroke={accent} strokeWidth="0.5" strokeDasharray="1.2 1.2" opacity="0.85" />
            )}
            {isSel && <path d={hexPath(cx, cy, r - 0.6)} fill="none" stroke={accent} strokeWidth="1.5" />}
            {isFocus && <path d={hexPath(cx, cy, r - 0.6)} fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="2 1.2" />}
            {/* coord micro-label */}
            <text x={cx - sqrt3*r/2 + 3} y={cy - r + 8} fontFamily="JetBrains Mono" fontSize="3" fill="#3f4347">{String.fromCharCode(65+ci)}{ri}</text>
          </g>
        );
      }))}

      {/* fog of war: dim cells far from blue units */}
      {showFog && map.map((row, ri) => row.split('').map((ch, ci) => {
        const minDist = Math.min(...blue.map(u => Math.abs(u.col - ci) + Math.abs(u.row - ri)));
        if (minDist <= 3) return null;
        const { x, y } = hexCenter(ci, ri, r);
        const cx = pad + x;
        const cy = pad + y;
        return <path key={`fog-${ci}-${ri}`} d={hexPath(cx, cy, r - 0.6)} fill="url(#fogPat)" opacity={minDist > 5 ? 0.85 : 0.55} />;
      }))}

      {/* sight lines (debug) */}
      {showSightLines && red.filter(u => u.spotted).map(u => {
        const a = hexCenter(sel.col, sel.row, r);
        const b = hexCenter(u.col, u.row, r);
        return <line key={u.id} x1={pad + a.x} y1={pad + a.y}
          x2={pad + b.x} y2={pad + b.y} stroke="#e23a2b" strokeWidth="0.4" strokeDasharray="1 1" opacity=".5"/>;
      })}

      {/* units */}
      {[...blue, ...red].map((u) => {
        const isRed = red.includes(u);
        if (isRed && !u.spotted && !u.ghost) return null;
        const { x, y } = hexCenter(u.col, u.row, r);
        const cx = pad + x;
        const cy = pad + y;
        const col = isRed ? '#e23a2b' : accent;
        const ghost = isRed && u.ghost;
        return (
          <g key={u.id} opacity={ghost ? 0.55 : 1}>
            <path d={hexPath(cx, cy, r - 2)} fill={isRed ? '#2a0f0d' : '#3a2310'} stroke={col} strokeWidth={ghost ? 0.6 : 1} strokeDasharray={ghost ? '1.5 1.2' : 'none'} />
            <text x={cx} y={cy + 1.5} textAnchor="middle" fontFamily="Rajdhani" fontSize="9" fontWeight="700" fill={col}>{u.id}</text>
            {/* HP bar */}
            <rect x={cx - 7} y={cy + r - 6} width="14" height="1.5" fill="#0a0c0d" stroke={col} strokeWidth="0.2"/>
            <rect x={cx - 7} y={cy + r - 6} width={14 * (u.hp/100)} height="1.5" fill={col}/>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, { TERRAIN, MAPS, HexMap });
