import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import TacBracket from '@/components/ui/TacBracket';
import TacBtn from '@/components/ui/TacBtn';
import CapRow from '@/components/ui/CapRow';
import { C, MONO, DISPLAY } from '@/constants/theme';

export default function TitleScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Status bar row */}
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>04:21:08</Text>
          <Text style={styles.statusText}>5G ▍▍▍▍ 87%</Text>
        </View>

        {/* Logo section */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoSymbol}>※</Text>
          </View>
          <Text style={styles.tagline}>TACTICAL HEX COMMAND</Text>
          <Text style={styles.titleJa}>戦略ゲーム</Text>
          <Text style={styles.opLabel}>—— OP. 0451 ——</Text>
        </View>

        {/* Readout */}
        <View style={styles.readoutWrap}>
          <TacBracket label="SYS / READOUT" padding={12}>
            <View style={styles.capGrid}>
              <View style={styles.capCol}>
                <CapRow left="OPERATOR" right="MAJ. SAITO" />
                <CapRow left="CLEAR" right="14 / 24" />
                <CapRow left="UNITS" right="08 / 20" />
              </View>
              <View style={styles.capDivider} />
              <View style={styles.capCol}>
                <CapRow left="DIVISION" right="3RD / TAC" />
                <CapRow left="RANK" right="A-2" />
                <CapRow left="ITEMS" right="06 / 10" />
              </View>
            </View>
            <View style={styles.separator} />
            <Text style={styles.lastSortie}>
              {'  > LAST SORTIE · 03:14 · VICT — RUINS-04'}
            </Text>
          </TacBracket>
        </View>

        {/* Button section */}
        <View style={styles.buttons}>
          <TacBtn
            primary
            full
            kbd="A"
            onPress={() => router.push('/game/stage-select')}
          >
            作戦開始 / SORTIE
          </TacBtn>
          <TacBtn full ghost>
            ユニット編成 / ROSTER
          </TacBtn>
          <TacBtn full ghost>
            キャラ作成 / FORGE
          </TacBtn>
          <View style={styles.smallRow}>
            <TacBtn small ghost style={styles.flexBtn}>
              SETTINGS
            </TacBtn>
            <TacBtn small ghost style={styles.flexBtn}>
              RECORDS
            </TacBtn>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ◢ CLASSIFIED · UNAUTH. USE PROHIBITED ◣
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  scroll: {
    flex: 1,
    backgroundColor: C.bg0,
  },
  content: {
    paddingBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink3,
  },
  logoSection: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  logoBox: {
    width: 84,
    height: 84,
    borderWidth: 1.5,
    borderColor: C.amber,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSymbol: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 42,
    color: C.amber,
    transform: [{ rotate: '-45deg' }],
    lineHeight: 50,
  },
  tagline: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
    letterSpacing: 3,
    marginTop: 14,
  },
  titleJa: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 38,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: 0.6,
    lineHeight: 42,
  },
  opLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.amber,
    letterSpacing: 3.2,
    marginTop: 4,
  },
  readoutWrap: {
    paddingHorizontal: 20,
  },
  capGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  capCol: {
    flex: 1,
    gap: 4,
  },
  capDivider: {
    width: 1,
    backgroundColor: C.line,
    marginHorizontal: 4,
  },
  separator: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    marginVertical: 10,
  },
  lastSortie: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  buttons: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  smallRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
  footer: {
    paddingBottom: 18,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink4,
  },
});
