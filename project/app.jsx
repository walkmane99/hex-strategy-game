// App — design canvas layout with all screens in Android frames + tweaks panel
const { AndroidDevice, DesignCanvas, DCSection, DCArtboard,
  TweaksPanel, TweakSection, TweakSelect, TweakToggle, TweakColor, useTweaks,
  PHONE_W, PHONE_H, MAPS,
  TitleScreen, StageScreen, UnitSelectScreen, CustomizeScreen,
  ItemScreen, TacticsScreen, CombatScreen, ResultScreen } = window;

function PhoneCard({ children }) {
  return (
    <AndroidDevice width={PHONE_W} height={PHONE_H} dark>
      {children}
    </AndroidDevice>
  );
}

function App() {
  const [t, setTweak] = useTweaks(window.__TWEAK_DEFAULTS);

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="flow" title="OPS // FLOW" subtitle="作戦開始から結果まで · 8 screens">
          <DCArtboard id="title"     label="01 · TITLE"        width={PHONE_W} height={PHONE_H}>
            <PhoneCard><TitleScreen/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="stage"     label="02 · MISSION SELECT" width={PHONE_W} height={PHONE_H}>
            <PhoneCard><StageScreen/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="roster"    label="03 · ROSTER · 戦略" width={PHONE_W} height={PHONE_H}>
            <PhoneCard><UnitSelectScreen/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="customize" label="04 · TUNE · 振り分け" width={PHONE_W} height={PHONE_H}>
            <PhoneCard><CustomizeScreen/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="items"     label="05 · LOADOUT"       width={PHONE_W} height={PHONE_H}>
            <PhoneCard><ItemScreen/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="tactics"   label="06 · TACTICS · 戦術" width={PHONE_W} height={PHONE_H}>
            <PhoneCard><TacticsScreen tweaks={t}/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="combat"    label="07 · ENGAGEMENT"    width={PHONE_W} height={PHONE_H}>
            <PhoneCard><CombatScreen tweaks={t}/></PhoneCard>
          </DCArtboard>
          <DCArtboard id="result"    label="08 · DEBRIEF"       width={PHONE_W} height={PHONE_H}>
            <PhoneCard><ResultScreen/></PhoneCard>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="TWEAKS · 戦場マップ">
        <TweakSection label="MAP">
          <TweakSelect label="マップ" value={t.mapPreset}
            options={Object.keys(MAPS)}
            onChange={(v) => setTweak('mapPreset', v)} />
        </TweakSection>
        <TweakSection label="OVERLAYS">
          <TweakToggle label="索敵霧 / FOG"      value={t.showFog}        onChange={(v) => setTweak('showFog', v)} />
          <TweakToggle label="脅威範囲 / THREAT" value={t.showThreat}     onChange={(v) => setTweak('showThreat', v)} />
          <TweakToggle label="視線 / SIGHT"      value={t.showSightLines} onChange={(v) => setTweak('showSightLines', v)} />
        </TweakSection>
        <TweakSection label="ACCENT">
          <TweakColor label="アクセント色"
            value={t.accent}
            options={['#ff8a1e', '#e23a2b', '#2ec5d3', '#5eaa3a', '#c8a64a']}
            onChange={(v) => setTweak('accent', v)} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
