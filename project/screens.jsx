// All screens in the tactical UI flow
const { C, Bracket, Header, Meter, StatRow, Tag, Btn, Scanlines, MiniMap, CapRow,
  Screen, PhoneTop, UnitGlyph, hexPath, MAPS, HexMap } = window;
const PHONE_W = 412;
const PHONE_H = 892;
const SCREEN_W = PHONE_W - 16;   // android frame border 8px each side
const SCREEN_H = PHONE_H - 16;

// ── 1. TITLE ──────────────────────────────────────────────────
function TitleScreen() {
  return (
    <Screen bg={C.bg0}>
      {/* status bar simulated */}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px',
        fontFamily:'var(--mono)', fontSize:10, color: C.ink3, letterSpacing:'.18em' }}>
        <span>04:21:08</span>
        <span>5G ▍▍▍▍ 87%</span>
      </div>
      {/* big mark */}
      <div style={{ padding: '40px 24px 0', textAlign:'center' }}>
        <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <div style={{ width:84, height:84, border:`1.5px solid ${C.amber}`, transform:'rotate(45deg)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ transform:'rotate(-45deg)', fontFamily:'var(--display)', fontSize:42, fontWeight:700, color: C.amber }}>※</div>
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.3em', marginTop:14 }}>TACTICAL HEX COMMAND</div>
          <div style={{ fontFamily:'var(--display)', fontSize:38, fontWeight:700, color: C.ink, letterSpacing:'.06em', lineHeight:1 }}>戦略ゲーム</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color: C.amber, letterSpacing:'.32em', marginTop:4 }}>—— OP. 0451 ——</div>
        </div>
      </div>

      {/* mid HUD scan */}
      <div style={{ padding:'40px 20px 0' }}>
        <Bracket label="SYS / READOUT" color={C.amber} padding={12} style={{ background: C.bg1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <CapRow left="OPERATOR" right="MAJ. SAITO" />
            <CapRow left="DIVISION" right="3RD / TAC" />
            <CapRow left="CLEAR" right="14 / 24" />
            <CapRow left="RANK" right="A-2" />
            <CapRow left="UNITS" right="08 / 20" />
            <CapRow left="ITEMS" right="06 / 10" />
          </div>
          <div style={{ marginTop:10, height:1, background:`repeating-linear-gradient(90deg, ${C.line} 0 4px, transparent 4px 8px)` }}/>
          <div style={{ marginTop:10, fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.14em' }}>
            &gt; LAST SORTIE · 03:14 · VICT — RUINS-04
          </div>
        </Bracket>
      </div>

      {/* menu */}
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:10 }}>
        <Btn primary full kbd="A">作戦開始 / SORTIE</Btn>
        <Btn full ghost>ユニット編成 / ROSTER</Btn>
        <Btn full ghost>キャラ作成 / FORGE</Btn>
        <div style={{ display:'flex', gap:10 }}>
          <Btn small ghost style={{ flex:1 }}>SETTINGS</Btn>
          <Btn small ghost style={{ flex:1 }}>RECORDS</Btn>
        </div>
      </div>

      {/* bottom legalese */}
      <div style={{ position:'absolute', bottom:18, left:0, right:0, textAlign:'center',
        fontFamily:'var(--mono)', fontSize:9, color: C.ink4, letterSpacing:'.22em' }}>
        ◢ CLASSIFIED · UNAUTH. USE PROHIBITED ◣
      </div>
    </Screen>
  );
}

// ── 2. STAGE SELECT ───────────────────────────────────────────
function StageScreen() {
  const stages = [
    { id:'M-01', name:'渓谷の哨戒', mode:'殲滅戦', diff:'NORMAL', clear:true,  rank:'S' },
    { id:'M-02', name:'廃墟の確保', mode:'陣地確保', diff:'NORMAL', clear:true,  rank:'A' },
    { id:'M-03', name:'夜霧の街', mode:'生存戦',   diff:'HARD',   clear:true,  rank:'B' },
    { id:'M-04', name:'貯水池の罠', mode:'脱出戦',   diff:'HARD',   clear:false, rank:'—', current:true },
    { id:'M-05', name:'第七区画',  mode:'攻防非対称', diff:'EXPERT', clear:false, rank:'—', locked:true },
    { id:'M-06', name:'前線突破',  mode:'ペイロード', diff:'EXPERT', clear:false, rank:'—', locked:true },
  ];
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="MENU › OPS › DEPLOY" mid="作戦選択" right="04:21" />
      {/* big map ribbon */}
      <div style={{ padding:'14px 14px 8px' }}>
        <Bracket label="THEATRE / SECTOR-7" color={C.amber} padding={10} style={{ background: C.bg1 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <MiniMap size={84} dots={[
              {x:18,y:54,r:1.3,c:C.amber},{x:24,y:48,r:1.3,c:C.amber},
              {x:32,y:40,r:1.5,c:C.amberBright},{x:42,y:32,r:1.3,c:C.ink3},
              {x:54,y:22,r:1.3,c:C.ink3},{x:62,y:14,r:1.3,c:C.ink3},
            ]}/>
            <div style={{ flex:1 }}>
              <CapRow left="THEATRE" right="SECTOR 7"/>
              <CapRow left="WEATHER" right="OVERCAST"/>
              <CapRow left="VISIBILITY" right="0.8 KM"/>
              <CapRow left="HOSTILES" right="EST. 12"/>
              <div style={{ marginTop:6, display:'flex', gap:4 }}>
                <Tag color={C.amber}>HARD</Tag>
                <Tag color={C.cyan}>NEW</Tag>
              </div>
            </div>
          </div>
        </Bracket>
      </div>
      <div style={{ padding:'4px 14px', fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.18em' }}>
        &gt; 6 MISSIONS · 3 LOCKED · CURSOR ON M-04
      </div>
      {/* mission list */}
      <div style={{ padding:'4px 14px', display:'flex', flexDirection:'column', gap:6 }}>
        {stages.map(s => (
          <div key={s.id} style={{
            position:'relative', padding:'10px 12px',
            border:`1px solid ${s.current ? C.amber : C.line}`,
            background: s.current ? 'linear-gradient(90deg,#2a1a08, #14181b 60%)' : C.bg1,
            display:'grid', gridTemplateColumns:'52px 1fr auto', gap:10, alignItems:'center',
            opacity: s.locked ? 0.45 : 1,
          }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color: s.current ? C.amber : C.ink2, letterSpacing:'.12em' }}>{s.id}</div>
            <div>
              <div style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:600, color: C.ink, letterSpacing:'.04em' }}>
                {s.locked ? '— LOCKED —' : s.name}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:3, fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.14em' }}>
                <span>{s.mode}</span>
                <span style={{ color: s.diff==='EXPERT' ? C.red : s.diff==='HARD' ? C.amber : C.ink2 }}>{s.diff}</span>
              </div>
            </div>
            <div style={{ textAlign:'right', minWidth:42 }}>
              {s.current ? (
                <div style={{ fontFamily:'var(--mono)', fontSize:9, color: C.amber, letterSpacing:'.18em' }}>▶ NOW</div>
              ) : s.clear ? (
                <div>
                  <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, color: s.rank==='S'?C.amberBright:C.ink2 }}>{s.rank}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:8, color: C.ink3 }}>CLR</div>
                </div>
              ) : (
                <div style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink3 }}>—</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'14px', position:'absolute', bottom:0, left:0, right:0,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn primary full kbd="A">M-04 へ展開 / DEPLOY</Btn>
      </div>
    </Screen>
  );
}

// ── 3. UNIT SELECT (戦略フェーズ) ──────────────────────────────
function UnitSelectScreen() {
  const roster = [
    { kind:'TANKER',    name:'タンカー',    in:true,  pri:true  },
    { kind:'ATTACKER',  name:'アタッカー',  in:true },
    { kind:'HEALER',    name:'ヒーラー',    in:true },
    { kind:'SEEKER',    name:'シーカー',    in:true },
    { kind:'ARCHER',    name:'アーチャー',  in:true },
    { kind:'ASSASSIN',  name:'アサシン',    reserve:true },
    { kind:'SNIPER',    name:'スナイパー' },
    { kind:'ENGINEER',  name:'エンジニア' },
    { kind:'BERSERKER', name:'バーサーカー' },
    { kind:'ILLUSION',  name:'イリュージョニスト', locked:true },
  ];
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="OPS › DEPLOY › ROSTER" mid="編成 ／ 5+1" right="STEP 2/4"/>
      {/* picked slots */}
      <div style={{ padding:'14px 14px 10px' }}>
        <Bracket label="SQUAD / SELECTED" color={C.amber} count="5+1" padding={10} style={{ background: C.bg1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
            {roster.filter(u => u.in || u.reserve).map((u,i) => (
              <div key={u.kind} style={{
                position:'relative', aspectRatio:'1', border:`1px solid ${u.reserve ? C.line : C.amber}`,
                background: u.reserve ? C.bg2 : 'linear-gradient(180deg,#2a1a08,#14181b)',
                display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column'
              }}>
                <UnitGlyph kind={u.kind} size={22} color={u.reserve ? C.ink2 : C.amber}/>
                <div style={{ fontFamily:'var(--mono)', fontSize:7, color: u.reserve ? C.ink3 : C.amber, letterSpacing:'.16em', marginTop:2 }}>
                  {u.reserve ? 'RES' : `0${i+1}`}
                </div>
                {u.pri && <div style={{ position:'absolute', top:-1, left:-1, width:6, height:6, background: C.amber }}/>}
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, display:'flex', justifyContent:'space-between',
            fontFamily:'var(--mono)', fontSize:9, color: C.ink3, letterSpacing:'.14em' }}>
            <span>主力 5 ／ 予備 1</span>
            <span>POINTS USED · <span style={{ color:C.amber }}>32 / 60</span></span>
          </div>
        </Bracket>
      </div>

      {/* available roster */}
      <div style={{ padding:'4px 14px' }}>
        <Header k="ROSTER" label="利用可能ユニット" right="10 / 20"/>
      </div>
      <div style={{ padding:'0 14px', display:'flex', flexDirection:'column', gap:6 }}>
        {roster.map(u => (
          <div key={u.kind} style={{
            display:'grid', gridTemplateColumns:'34px 1fr 90px 22px', gap:10, alignItems:'center',
            padding:'8px 10px',
            border:`1px solid ${u.in ? C.amber : C.line}`,
            background: u.in ? 'linear-gradient(90deg,#2a1a08 0%, #14181b 50%)' : C.bg1,
            opacity: u.locked ? 0.4 : 1,
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:`1px solid ${u.in?C.amber:C.line}`, background:C.bg0 }}>
              <UnitGlyph kind={u.kind} size={20} color={u.in ? C.amber : C.ink2}/>
            </div>
            <div>
              <div style={{ fontFamily:'var(--display)', fontSize:13, fontWeight:600, color:C.ink, letterSpacing:'.04em' }}>{u.name}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.14em' }}>{u.kind}</div>
            </div>
            <div>
              <div style={{ display:'flex', gap:1, height:3 }}>
                {[12,14,8,10,11].map((v,i) => (
                  <div key={i} style={{ flex:1, background:C.bg3 }}>
                    <div style={{ width:`${v*5}%`, height:'100%', background: u.in ? C.amber : C.ink3 }}/>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:C.ink3, letterSpacing:'.14em', marginTop:2 }}>HP·ATK·DEF·MV·SCN</div>
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color: u.in ? C.amber : C.ink3, textAlign:'center' }}>
              {u.locked ? '✕' : u.in ? '●' : u.reserve ? 'R' : '○'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding:'12px 14px', position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn ghost style={{ flex:1 }}>＜ BACK</Btn>
        <Btn primary style={{ flex:2 }} kbd="A">カスタマイズへ ▶</Btn>
      </div>
    </Screen>
  );
}

// ── 4. UNIT CUSTOMIZE (10pt 振り分け) ──────────────────────────
function CustomizeScreen() {
  const stats = [
    { code:'HP ', kana:'体力',  value:14, base:10, color: C.amber },
    { code:'ATK', kana:'攻撃',  value:18, base:10, color: C.amber },
    { code:'DEF', kana:'防御',  value:8,  base:10, color: C.amber },
    { code:'MV ', kana:'移動',  value:10, base:10, color: C.amber },
    { code:'SCN', kana:'索敵',  value:6,  base:10, color: C.amber },
  ];
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="OPS › DEPLOY › TUNE" mid="ユニット調整" right="STEP 3/4"/>

      {/* unit hero card */}
      <div style={{ padding:'14px 14px 6px' }}>
        <Bracket color={C.amber} padding={12} style={{ background: C.bg1 }} label="UNIT 02" count="ATTACKER">
          <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{ width:96, height:96, border:`1px solid ${C.amber}`, background: C.bg0, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              <UnitGlyph kind="ATTACKER" size={56} color={C.amberBright}/>
              <div style={{ position:'absolute', top:4, left:4, fontFamily:'var(--mono)', fontSize:8, color:C.amber, letterSpacing:'.18em' }}>02</div>
              <div style={{ position:'absolute', bottom:4, right:6, fontFamily:'var(--mono)', fontSize:8, color:C.ink3, letterSpacing:'.18em' }}>SR · LV.7</div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, color:C.ink, letterSpacing:'.04em' }}>アタッカー</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>ATTACKER · CLASS-A</div>
              <div style={{ marginTop:8, display:'flex', gap:4, flexWrap:'wrap' }}>
                <Tag color={C.amber}>攻撃力重視</Tag>
                <Tag color={C.cyan}>+ATK aura</Tag>
              </div>
              <div style={{ marginTop:8, padding:'6px 8px', border:`1px dashed ${C.line}`, fontFamily:'Noto Sans JP', fontSize:11, color:C.ink2, lineHeight:1.5 }}>
                周囲2マス以内の味方の攻撃力 <span style={{ color:C.amber }}>+2</span>。アサシンに強い／タンカーに弱い。
              </div>
            </div>
          </div>
        </Bracket>
      </div>

      {/* point allocation */}
      <div style={{ padding:'8px 14px' }}>
        <Header k="ALLOC" label="ポイント振り分け" right="6 / 10 PT"/>
        <div style={{ background: C.bg1, border:`1px solid ${C.line}`, padding:'10px 12px' }}>
          {stats.map(s => (
            <div key={s.code} style={{ display:'grid', gridTemplateColumns:'58px 1fr 60px', gap:10, alignItems:'center', padding:'5px 0', borderBottom:`1px dashed ${C.line}` }}>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:10, color: C.ink2, letterSpacing:'.14em' }}>{s.code}</div>
                <div style={{ fontFamily:'Noto Sans JP', fontSize:9, color: C.ink3 }}>{s.kana}</div>
              </div>
              <div>
                <div style={{ display:'flex', gap:1, height:8 }}>
                  {Array.from({length:20}).map((_,i) => (
                    <div key={i} style={{
                      flex:1, background: i < s.base ? C.bg4 : C.bg2,
                      borderTop: i < s.value ? `1px solid ${s.color}` : 'none',
                      ...(i < s.value && i >= s.base ? { background: s.color } : {}),
                      ...(i < Math.min(s.base, s.value) ? { background: C.amberSoft } : {}),
                    }}/>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'flex-end' }}>
                <button style={{ width:18, height:18, border:`1px solid ${C.line}`, background:'transparent', color:C.ink2, fontFamily:'var(--mono)', fontSize:11, cursor:'pointer' }}>−</button>
                <span style={{ fontFamily:'var(--mono)', fontSize:13, color:C.amber, minWidth:18, textAlign:'center' }}>{String(s.value).padStart(2,'0')}</span>
                <button style={{ width:18, height:18, border:`1px solid ${C.amber}`, background: C.amberSoft, color:C.amber, fontFamily:'var(--mono)', fontSize:11, cursor:'pointer' }}>＋</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:10, color:C.ink3, letterSpacing:'.14em' }}>
            <span>残 PT</span>
            <span style={{ color:C.amber, fontFamily:'var(--display)', fontSize:18, fontWeight:700 }}>04</span>
          </div>
        </div>
      </div>

      {/* relationship hex */}
      <div style={{ padding:'4px 14px 0' }}>
        <Header k="REL" label="相性" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ border:`1px solid ${C.line}`, background: C.bg1, padding:'6px 8px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.green, letterSpacing:'.16em' }}>STRONG VS</div>
            <div style={{ display:'flex', gap:6, marginTop:4, alignItems:'center' }}>
              <UnitGlyph kind="ASSASSIN" size={16} color={C.green}/>
              <span style={{ fontFamily:'Noto Sans JP', fontSize:11, color:C.ink }}>アサシン</span>
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:10, color:C.green }}>+30%</span>
            </div>
          </div>
          <div style={{ border:`1px solid ${C.line}`, background: C.bg1, padding:'6px 8px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.red, letterSpacing:'.16em' }}>WEAK VS</div>
            <div style={{ display:'flex', gap:6, marginTop:4, alignItems:'center' }}>
              <UnitGlyph kind="TANKER" size={16} color={C.red}/>
              <span style={{ fontFamily:'Noto Sans JP', fontSize:11, color:C.ink }}>タンカー</span>
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:10, color:C.red }}>−30%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'12px 14px', position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn ghost style={{ flex:1 }}>＜ 戻る</Btn>
        <Btn primary style={{ flex:2 }} kbd="A">確定 / NEXT</Btn>
      </div>
    </Screen>
  );
}

// ── 5. ITEM SELECT ───────────────────────────────────────────
function ItemScreen() {
  const items = [
    { id:'IT-01', name:'照明弾',     code:'FLARE',     have:3, picked:true,  desc:'2T 指定エリア可視化' },
    { id:'IT-02', name:'EMP手榴弾',  code:'EMP-GRD',   have:2, picked:true,  desc:'1T 移動力 −50%' },
    { id:'IT-03', name:'補給パック', code:'RESUPPLY',  have:4, desc:'HP +30%' },
    { id:'IT-04', name:'迷彩ネット', code:'CAMO-NET',  have:1, desc:'2T 索敵されにくい' },
    { id:'IT-05', name:'地雷',       code:'MINE',      have:2, desc:'設置・踏むとDMG' },
    { id:'IT-06', name:'ドローン偵察', code:'DRONE',   have:1, desc:'1T エリア完全索敵' },
    { id:'IT-07', name:'縦断爆撃',   code:'CARPET',    have:0, desc:'全敵に大DMG (300)', locked:true },
    { id:'IT-08', name:'煙幕',       code:'SMOKE',     have:2, desc:'広範囲索敵無効' },
  ];
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="OPS › DEPLOY › LOAD" mid="アイテム ／ 2" right="STEP 4/4"/>

      <div style={{ padding:'14px 14px 8px' }}>
        <Bracket label="LOADOUT" count="2 / 2" color={C.amber} padding={10} style={{ background: C.bg1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {items.filter(i => i.picked).map(i => (
              <div key={i.id} style={{ padding:'8px', border:`1px solid ${C.amber}`, background:'linear-gradient(180deg,#2a1a08,#14181b)' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.amber, letterSpacing:'.16em' }}>{i.id}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>×1</span>
                </div>
                <div style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:600, color:C.ink, marginTop:6 }}>{i.name}</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.14em' }}>{i.code}</div>
                <div style={{ marginTop:6, fontFamily:'Noto Sans JP', fontSize:10, color:C.ink2 }}>{i.desc}</div>
              </div>
            ))}
          </div>
        </Bracket>
      </div>

      <div style={{ padding:'4px 14px' }}>
        <Header k="STOCK" label="所持アイテム" right={`${items.length} TYPES`}/>
      </div>
      <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {items.map(i => (
          <div key={i.id} style={{
            padding:'8px 10px',
            border:`1px solid ${i.picked ? C.amber : C.line}`,
            background: i.picked ? '#2a1a08' : C.bg1,
            opacity: i.locked ? 0.4 : 1,
            position:'relative',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.14em' }}>{i.id}</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:9, color:i.have? C.amber : C.ink3 }}>×{i.have}</span>
            </div>
            <div style={{ fontFamily:'var(--display)', fontSize:12, fontWeight:600, color:C.ink, marginTop:3, letterSpacing:'.04em' }}>{i.name}</div>
            <div style={{ fontFamily:'Noto Sans JP', fontSize:9, color:C.ink3, marginTop:2, letterSpacing:'.04em' }}>{i.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:'12px 14px', position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn ghost style={{ flex:1 }}>＜</Btn>
        <Btn primary style={{ flex:2 }} kbd="A">出撃 / DEPLOY</Btn>
      </div>
    </Screen>
  );
}

// MISSION START — looping cinematic overlay for the hex map
function MissionStartOverlay({ accent = '#ff8a1e' }) {
  const id = React.useId().replace(/:/g, '');
  const css = `
    @keyframes ms-bar-top-${id}   { 0%{transform:translateY(-100%)} 6%,40%{transform:translateY(0)} 50%,100%{transform:translateY(-100%)} }
    @keyframes ms-bar-bot-${id}   { 0%{transform:translateY(100%)}  6%,40%{transform:translateY(0)} 50%,100%{transform:translateY(100%)} }
    @keyframes ms-sweep-${id}     { 0%,8%{transform:translateX(-110%)} 22%{transform:translateX(110%)} 100%{transform:translateX(110%)} }
    @keyframes ms-text-${id}      {
      0%,10%   { opacity:0; transform:translate(-50%,-50%) scaleX(.4); letter-spacing:.6em; filter:blur(6px); }
      18%      { opacity:1; transform:translate(-50%,-50%) scaleX(1);  letter-spacing:.34em; filter:blur(0); }
      28%      { transform:translate(-50%,-50%) translateX(-2px); }
      30%      { transform:translate(-50%,-50%) translateX(2px); }
      32%      { transform:translate(-50%,-50%) translateX(-1px); }
      34%,42%  { opacity:1; transform:translate(-50%,-50%); }
      50%,100% { opacity:0; transform:translate(-50%,-50%) translateY(-6px); }
    }
    @keyframes ms-sub-${id}       { 0%,16%{opacity:0; transform:translate(-50%,8px)} 22%,42%{opacity:1; transform:translate(-50%,0)} 50%,100%{opacity:0} }
    @keyframes ms-mark-${id}      { 0%,12%{opacity:0; transform:scale(.5)} 20%,42%{opacity:1; transform:scale(1)} 50%,100%{opacity:0} }
    @keyframes ms-scan-${id}      { 0%,14%{opacity:0} 18%{opacity:.6} 42%{opacity:.6} 48%,100%{opacity:0} }
    .ms-${id} { animation-duration: 6s; animation-iteration-count: infinite; animation-timing-function: cubic-bezier(.2,.7,.2,1); }
  `;
  const bar = { position:'absolute', left:0, right:0, height:'22%', background:'linear-gradient(180deg, rgba(7,9,10,.95), rgba(7,9,10,.55))', borderColor:accent, willChange:'transform' };
  return (
    <div style={{ position:'absolute', inset:'10px 8px 6px', pointerEvents:'none', overflow:'hidden' }}>
      <style>{css}</style>
      {/* black bars from top/bottom */}
      <div className={`ms-${id}`} style={{ ...bar, top:0, borderBottom:`1px solid ${accent}`, animationName:`ms-bar-top-${id}` }}/>
      <div className={`ms-${id}`} style={{ ...bar, bottom:0, borderTop:`1px solid ${accent}`, animationName:`ms-bar-bot-${id}` }}/>

      {/* horizontal sweep flash */}
      <div className={`ms-${id}`} style={{
        position:'absolute', top:'40%', left:0, right:0, height:'20%',
        background:`linear-gradient(90deg, transparent 0%, ${accent}00 40%, ${accent}55 50%, ${accent}00 60%, transparent 100%)`,
        animationName:`ms-sweep-${id}`, willChange:'transform',
      }}/>

      {/* scanline behind text */}
      <div className={`ms-${id}`} style={{
        position:'absolute', top:'48%', left:0, right:0, height:1, background:accent,
        boxShadow:`0 0 6px ${accent}`, animationName:`ms-scan-${id}`,
      }}/>

      {/* corner brackets */}
      {[[0,0],[1,0],[0,1],[1,1]].map(([x,y], i) => (
        <div key={i} className={`ms-${id}`} style={{
          position:'absolute',
          left: x ? 'auto' : 8, right: x ? 8 : 'auto',
          top:  y ? 'auto' : '34%', bottom: y ? '34%' : 'auto',
          width:14, height:14,
          borderLeft:  x ? 'none' : `1.5px solid ${accent}`,
          borderRight: x ? `1.5px solid ${accent}` : 'none',
          borderTop:   y ? 'none' : `1.5px solid ${accent}`,
          borderBottom:y ? `1.5px solid ${accent}` : 'none',
          animationName:`ms-mark-${id}`,
        }}/>
      ))}

      {/* MISSION START text */}
      <div className={`ms-${id}`} style={{
        position:'absolute', top:'46%', left:'50%', transform:'translate(-50%,-50%)',
        fontFamily:'var(--display)', fontWeight:700, fontSize:30, letterSpacing:'.34em',
        color:'#f5efe2', textShadow:`0 0 14px ${accent}aa, 0 0 2px #000`,
        whiteSpace:'nowrap', animationName:`ms-text-${id}`,
      }}>
        MISSION START
      </div>

      {/* subtitle bar */}
      <div className={`ms-${id}`} style={{
        position:'absolute', top:'58%', left:'50%', transform:'translate(-50%,0)',
        display:'flex', alignItems:'center', gap:8,
        animationName:`ms-sub-${id}`,
      }}>
        <span style={{ display:'inline-block', width:18, height:1, background:accent }}/>
        <span style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.32em', color:accent }}>
          OP. 0451 · M-04 · 貯水池の罠
        </span>
        <span style={{ display:'inline-block', width:18, height:1, background:accent }}/>
      </div>
    </div>
  );
}

// ── 6. TACTICS — main hex battlefield ─────────────────────────
function TacticsScreen({ tweaks }) {
  const t = tweaks || { mapPreset:'都市部 / URBAN', showFog:true, showThreat:true, showSightLines:false, accent:'#ff8a1e' };
  return (
    <Screen bg={C.bg0}>
      {/* top status bar — turn / objective */}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px',
        fontFamily:'var(--mono)', fontSize:10, color: C.ink2, letterSpacing:'.18em',
        borderBottom:`1px solid ${C.line}`, background: C.bg0 }}>
        <span style={{ color: t.accent }}>◆ FRIENDLY TURN</span>
        <span>03 / 12</span>
        <span>04:21</span>
      </div>

      {/* mission ribbon */}
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.line}`, background: C.bg1,
        display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center' }}>
        <div style={{ width:42, height:42, border:`1px solid ${t.accent}`, transform:'rotate(45deg)',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ transform:'rotate(-45deg)', fontFamily:'var(--display)', fontSize:14, fontWeight:700, color:t.accent }}>04</span>
        </div>
        <div>
          <div style={{ fontFamily:'var(--display)', fontSize:13, fontWeight:600, color:C.ink, letterSpacing:'.06em' }}>M-04 · 貯水池の罠</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>OBJ · 全敵殲滅 ／ HVT 隔離</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>残ターン</div>
          <div style={{ fontFamily:'var(--display)', fontSize:18, fontWeight:700, color:t.accent }}>09</div>
        </div>
      </div>

      {/* HEX MAP */}
      <div style={{ padding:'10px 8px 6px', position:'relative', overflow:'hidden' }}>
        <HexMap preset={t.mapPreset} width={SCREEN_W - 16} showFog={t.showFog} showThreat={t.showThreat} showSightLines={t.showSightLines} accent={t.accent}/>
        <MissionStartOverlay accent={t.accent}/>

        {/* mini compass overlay */}
        <div style={{ position:'absolute', top:16, right:14, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:8, color:t.accent, letterSpacing:'.2em' }}>N</div>
          <div style={{ width:18, height:18, border:`1px solid ${t.accent}`, borderRadius:'50%', position:'relative' }}>
            <div style={{ position:'absolute', top:-2, left:'50%', width:1, height:6, background:t.accent }}/>
          </div>
        </div>
        {/* legend */}
        <div style={{ position:'absolute', top:16, left:14, padding:'4px 6px', background:'rgba(7,9,10,.85)',
          border:`1px solid ${C.line}`, fontFamily:'var(--mono)', fontSize:8, color: C.ink3, letterSpacing:'.14em', lineHeight:1.6 }}>
          <div><span style={{ color:t.accent }}>◆</span> ALLY 5</div>
          <div><span style={{ color:C.red }}>◆</span> SPOTTED 2 / 5</div>
          <div><span style={{ color:C.ink2 }}>▓</span> FOG · {t.showFog ? 'ON':'OFF'}</div>
        </div>
      </div>

      {/* selected unit panel */}
      <div style={{ padding:'4px 12px 10px' }}>
        <Bracket label="UNIT B-01 · TANKER" count="ACTIVE" color={t.accent} padding={10} style={{ background: C.bg1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'56px 1fr 78px', gap:10, alignItems:'center' }}>
            <div style={{ width:54, height:54, border:`1px solid ${t.accent}`, background:C.bg0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <UnitGlyph kind="TANKER" size={32} color={t.accent}/>
            </div>
            <div>
              <div style={{ fontFamily:'var(--display)', fontSize:13, fontWeight:600, color:C.ink }}>タンカー / B-01</div>
              <div style={{ display:'flex', gap:8, marginTop:3 }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink2, letterSpacing:'.14em' }}>HP <span style={{ color:t.accent }}>92/100</span></span>
                <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink2, letterSpacing:'.14em' }}>POS <span style={{ color:C.ink }}>B8</span></span>
                <span style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink2, letterSpacing:'.14em' }}>地形 <span style={{ color:C.ink }}>建物</span></span>
              </div>
              <div style={{ marginTop:6, display:'flex', gap:1, height:4 }}>
                {Array.from({length:20}).map((_,i) => (
                  <div key={i} style={{ flex:1, background: i < 18 ? t.accent : C.bg3 }}/>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.14em', color:C.ink3 }}>
                <span>ATK 06</span><span>DEF <span style={{ color:t.accent }}>16</span></span>
                <span>MV  04</span><span>SCN 04</span>
              </div>
              <Tag color={C.cyan}>DEF aura +2</Tag>
            </div>
          </div>
        </Bracket>
      </div>

      {/* action bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 10px 12px', background:'linear-gradient(180deg, transparent, #07090a 40%)' }}>
        <div style={{ display:'flex', gap:6, marginBottom:8, justifyContent:'center' }}>
          {['移動 / MV','攻撃 / ATK','索敵 / SCN','待機 / END'].map((l,i) => (
            <div key={i} style={{
              flex:1, padding:'10px 6px', border:`1px solid ${i===0?t.accent:C.line}`,
              background: i===0 ? '#2a1a08' : C.bg1,
              fontFamily:'var(--display)', fontSize:11, fontWeight:700, color: i===0 ? t.accent : C.ink2,
              letterSpacing:'.14em', textAlign:'center', textTransform:'uppercase',
              clipPath:'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
            }}>{l}</div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>
          <span>ITEM · 照明弾 / EMP</span>
          <span>SWAP · 1 / 1</span>
          <span>END TURN [▶]</span>
        </div>
      </div>
    </Screen>
  );
}

// ── 7. COMBAT FORECAST ────────────────────────────────────────
function CombatScreen({ tweaks }) {
  const t = tweaks || { accent:'#ff8a1e', mapPreset:'都市部 / URBAN' };
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="TAC › ENG › PREVIEW" mid="戦闘予測" right="T 03"/>
      <div style={{ padding:'10px 8px 6px', position:'relative' }}>
        <HexMap preset={t.mapPreset} width={SCREEN_W - 16} accent={t.accent} focusCell={[8,2]} />
        {/* engagement vignette */}
        <div style={{ position:'absolute', inset:'10px 8px 6px', pointerEvents:'none',
          background:'radial-gradient(circle at 70% 22%, transparent 0%, transparent 22%, rgba(7,9,10,.55) 60%)' }}/>
      </div>

      {/* attacker / defender panels */}
      <div style={{ padding:'4px 12px', display:'grid', gridTemplateColumns:'1fr 36px 1fr', gap:8, alignItems:'stretch' }}>
        {/* attacker */}
        <div style={{ border:`1px solid ${t.accent}`, background:'linear-gradient(180deg,#2a1a08,#14181b)', padding:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:9, color:t.accent, letterSpacing:'.18em' }}>
            <span>ATK · B-02</span><span>+30%</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            <UnitGlyph kind="ATTACKER" size={28} color={t.accent}/>
            <div>
              <div style={{ fontFamily:'var(--display)', fontSize:13, fontWeight:700, color:C.ink }}>アタッカー</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.14em' }}>D5 → E4</div>
            </div>
          </div>
          <div style={{ marginTop:8, fontFamily:'var(--mono)', fontSize:10, color:C.ink2, letterSpacing:'.14em', lineHeight:1.7 }}>
            ATK <span style={{ color:t.accent }}>18</span> · MV 12 · DEF 04<br/>
            HP <span style={{ color:t.accent }}>78</span> / 100
          </div>
        </div>

        {/* vs */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
          <div style={{ fontFamily:'var(--display)', fontSize:24, fontWeight:700, color:C.amber }}>VS</div>
          <div style={{ width:1, flex:1, background:`repeating-linear-gradient(0deg, ${C.line} 0 4px, transparent 4px 8px)` }}/>
          <div style={{ fontFamily:'var(--mono)', fontSize:8, color:C.ink3, letterSpacing:'.18em' }}>RNG 1</div>
        </div>

        {/* defender */}
        <div style={{ border:`1px solid ${C.red}`, background:'linear-gradient(180deg,#2a0f0d,#14181b)', padding:'10px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:9, color:C.red, letterSpacing:'.18em' }}>
            <span>DEF · R-03</span><span>−30%</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            <UnitGlyph kind="ASSASSIN" size={28} color={C.red}/>
            <div>
              <div style={{ fontFamily:'var(--display)', fontSize:13, fontWeight:700, color:C.ink }}>アサシン</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.14em' }}>E4 · 平地</div>
            </div>
          </div>
          <div style={{ marginTop:8, fontFamily:'var(--mono)', fontSize:10, color:C.ink2, letterSpacing:'.14em', lineHeight:1.7 }}>
            ATK 14 · MV 16 · DEF <span style={{ color:C.red }}>02</span><br/>
            HP <span style={{ color:C.red }}>88</span> / 100
          </div>
        </div>
      </div>

      {/* damage forecast */}
      <div style={{ padding:'10px 12px' }}>
        <Bracket label="FORECAST / DMG" color={t.accent} padding={12} style={{ background: C.bg1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.18em' }}>ESTIMATED DMG</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontFamily:'var(--display)', fontSize:36, fontWeight:700, color:t.accent }}>142</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.ink3 }}>± 38</span>
              </div>
              <div style={{ display:'flex', gap:1, height:4, marginTop:2 }}>
                {Array.from({length:20}).map((_,i) => (
                  <div key={i} style={{ flex:1, background: i < 14 ? t.accent : C.bg3 }}/>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.18em' }}>HIT · KILL</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontFamily:'var(--display)', fontSize:24, fontWeight:700, color:C.ink }}>92</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, color:C.ink3 }}>%</span>
                <span style={{ marginLeft:'auto', fontFamily:'var(--display)', fontSize:24, fontWeight:700, color:C.red }}>K</span>
              </div>
              <div style={{ marginTop:6, fontFamily:'var(--mono)', fontSize:9, color:C.ink2, letterSpacing:'.14em', lineHeight:1.6 }}>
                · 相性 +30%<br/>
                · 地形 平地 +0<br/>
                · 高度差 0<br/>
              </div>
            </div>
          </div>
        </Bracket>
      </div>

      <div style={{ padding:'8px 12px', position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn ghost style={{ flex:1 }}>＜ CANCEL</Btn>
        <Btn primary style={{ flex:2 }} kbd="A">攻撃実行 / FIRE</Btn>
      </div>
    </Screen>
  );
}

// ── 8. RESULT ─────────────────────────────────────────────────
function ResultScreen() {
  return (
    <Screen bg={C.bg0}>
      <PhoneTop left="OPS › DEBRIEF" mid="作戦終了" right="04:33"/>

      {/* Big VICTORY */}
      <div style={{ padding:'30px 16px 12px', textAlign:'center', position:'relative' }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:10, color:C.ink3, letterSpacing:'.32em' }}>—— DEBRIEF ——</div>
        <div style={{ fontFamily:'var(--display)', fontSize:48, fontWeight:700, color:C.amberBright, letterSpacing:'.14em', marginTop:6, lineHeight:1 }}>VICTORY</div>
        <div style={{ fontFamily:'Noto Sans JP', fontSize:12, color:C.ink2, marginTop:4, letterSpacing:'.16em' }}>作戦目標を達成</div>
        {/* rank */}
        <div style={{ marginTop:14, display:'inline-flex', gap:14, alignItems:'flex-end' }}>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.18em' }}>RANK</div>
            <div style={{ fontFamily:'var(--display)', fontSize:64, fontWeight:700, color:C.amber, lineHeight:1 }}>S</div>
          </div>
          <div style={{ textAlign:'left', paddingBottom:8 }}>
            <CapRow left="TURN" right="09 / 12"/>
            <CapRow left="SURV" right="5 / 5"/>
            <CapRow left="KILL" right="07"/>
            <CapRow left="DMG"  right="-04%"/>
          </div>
        </div>
      </div>

      {/* score breakdown */}
      <div style={{ padding:'8px 14px' }}>
        <Bracket label="SCORE / BREAKDOWN" color={C.amber} padding={10} style={{ background: C.bg1 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              ['クリア時間', '残3T × 10', '+30'],
              ['残存ユニット', '5体', '+250'],
              ['特殊条件', 'HVT撃破', '+80'],
              ['撃破数', '7体', '+140'],
              ['低被害クリア', '−4%', '+90'],
              ['難易度補正', '×1.5 (HARD)', 'x1.5'],
            ].map(([a,b,c],i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'baseline',
                paddingBottom:5, borderBottom:`1px dashed ${C.line}` }}>
                <span style={{ fontFamily:'Noto Sans JP', fontSize:11, color:C.ink2 }}>{a}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:10, color:C.ink3, letterSpacing:'.14em' }}>{b}</span>
                <span style={{ fontFamily:'var(--display)', fontSize:14, fontWeight:700, color:C.amber }}>{c}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingTop:4 }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:C.ink, letterSpacing:'.18em' }}>TOTAL · POINTS</span>
              <span style={{ fontFamily:'var(--display)', fontSize:30, fontWeight:700, color:C.amberBright }}>885</span>
            </div>
          </div>
        </Bracket>
      </div>

      {/* rewards */}
      <div style={{ padding:'8px 14px' }}>
        <Header k="LOOT" label="獲得報酬" right="03"/>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {[
            { name:'ドローン偵察', code:'DRONE', n:'×2' },
            { name:'迷彩ネット', code:'CAMO', n:'×1' },
            { name:'新ユニット解放', code:'ENGINEER', n:'NEW' },
          ].map((r,i) => (
            <div key={i} style={{ padding:'8px', border:`1px solid ${C.amber}`, background:'#2a1a08' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:9, color:C.ink3, letterSpacing:'.16em' }}>{r.code}</div>
              <div style={{ fontFamily:'var(--display)', fontSize:11, fontWeight:600, color:C.ink, marginTop:2, lineHeight:1.2 }}>{r.name}</div>
              <div style={{ marginTop:4, fontFamily:'var(--display)', fontSize:14, fontWeight:700, color:C.amber }}>{r.n}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'10px 14px', position:'absolute', bottom:0, left:0, right:0, display:'flex', gap:8,
        background:'linear-gradient(180deg, transparent, #07090a 30%)' }}>
        <Btn ghost style={{ flex:1 }}>RECORDS</Btn>
        <Btn primary style={{ flex:2 }} kbd="A">次の作戦へ</Btn>
      </div>
    </Screen>
  );
}

Object.assign(window, {
  PHONE_W, PHONE_H, SCREEN_W, SCREEN_H,
  TitleScreen, StageScreen, UnitSelectScreen, CustomizeScreen,
  ItemScreen, TacticsScreen, CombatScreen, ResultScreen,
});
