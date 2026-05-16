import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhoneTopBar from '@/components/ui/PhoneTopBar';
import TacBracket from '@/components/ui/TacBracket';
import TacHeader from '@/components/ui/TacHeader';
import TacBtn from '@/components/ui/TacBtn';
import { C, MONO, DISPLAY } from '@/constants/theme';

const ITEMS = [
  { id: 'IT-01', name: '照明弾',     code: 'FLARE',    have: 3, desc: '2T 指定エリア可視化' },
  { id: 'IT-02', name: 'EMP手榴弾',  code: 'EMP-GRD',  have: 2, desc: '1T 移動力 −50%' },
  { id: 'IT-03', name: '補給パック', code: 'RESUPPLY', have: 4, desc: 'HP +30%' },
  { id: 'IT-04', name: '迷彩ネット', code: 'CAMO-NET', have: 1, desc: '2T 索敵されにくい' },
  { id: 'IT-05', name: '地雷',       code: 'MINE',     have: 2, desc: '設置・踏むとDMG' },
  { id: 'IT-06', name: 'ドローン偵察', code: 'DRONE',  have: 1, desc: '1T エリア完全索敵' },
  { id: 'IT-07', name: '縦断爆撃',   code: 'CARPET',   have: 0, desc: '全敵に大DMG (300)', locked: true },
  { id: 'IT-08', name: '煙幕',       code: 'SMOKE',    have: 2, desc: '広範囲索敵無効' },
] as const;

type Item = typeof ITEMS[number];

const MAX_ITEMS = 2;

const LoadoutCard = React.memo(function LoadoutCard({ item }: { item: Item }) {
  return (
    <View style={styles.loadoutCard}>
      <Text style={styles.loadoutId}>{item.id}</Text>
      <Text style={styles.loadoutName}>{item.name}</Text>
      <Text style={styles.loadoutCode}>{item.code}</Text>
      <Text style={styles.loadoutDesc}>{item.desc}</Text>
    </View>
  );
});

const EmptySlot = React.memo(function EmptySlot() {
  return (
    <View style={styles.emptySlot}>
      <Text style={styles.emptySlotText}>—— EMPTY ——</Text>
    </View>
  );
});

const ItemCard = React.memo(function ItemCard({
  item,
  isPicked,
  onPress,
}: {
  item: Item;
  isPicked: boolean;
  onPress: () => void;
}) {
  const isLocked = 'locked' in item && item.locked;
  const haveColor = item.have > 0 ? C.amber : C.ink3;

  return (
    <Pressable
      onPress={onPress}
      disabled={!!isLocked}
      style={[
        styles.itemCard,
        {
          borderColor: isPicked ? C.amber : C.line,
          backgroundColor: isPicked ? '#2a1a08' : C.bg1,
          opacity: isLocked ? 0.4 : 1,
        },
      ]}
    >
      <View style={styles.itemCardTop}>
        <Text style={styles.itemId}>{item.id}</Text>
        <Text style={[styles.itemHave, { color: haveColor }]}>{`×${item.have}`}</Text>
      </View>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemDesc}>{item.desc}</Text>
    </Pressable>
  );
});

export default function ItemScreen() {
  const [picked, setPicked] = useState<string[]>(['IT-01', 'IT-02']);

  const toggleItem = (id: string) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;
    if ('locked' in item && item.locked) return;

    setPicked((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, id];
    });
  };

  const pickedItems = picked.map((id) => ITEMS.find((i) => i.id === id)).filter(Boolean) as Item[];

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 28 - 6) / 2;

  return (
    <SafeAreaView style={styles.safeArea}>
      <PhoneTopBar
        left="OPS › DEPLOY › LOAD"
        mid={`アイテム ／ ${picked.length}`}
        right="STEP 4/4"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Loadout */}
        <View style={styles.section}>
          <TacBracket label="LOADOUT" count={`${picked.length} / ${MAX_ITEMS}`} padding={10}>
            <View style={styles.loadoutRow}>
              {Array.from({ length: MAX_ITEMS }).map((_, i) => {
                const item = pickedItems[i];
                return item ? (
                  <LoadoutCard key={item.id} item={item} />
                ) : (
                  <EmptySlot key={`empty-${i}`} />
                );
              })}
            </View>
          </TacBracket>
        </View>

        {/* Stock header */}
        <View style={styles.sectionPad}>
          <TacHeader k="STOCK" label="所持アイテム" right={`${ITEMS.length} TYPES`} />
        </View>

        {/* Item grid */}
        <View style={styles.itemGrid}>
          {ITEMS.map((item, index) => (
            <View key={item.id} style={{ width: cardWidth }}>
              <ItemCard
                item={item}
                isPicked={picked.includes(item.id)}
                onPress={() => toggleItem(item.id)}
              />
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TacBtn ghost style={styles.backBtn} onPress={() => router.back()}>
          ＜
        </TacBtn>
        <TacBtn
          primary
          kbd="A"
          style={styles.nextBtn}
          onPress={() => router.push('/game/battle')}
        >
          出撃 / DEPLOY
        </TacBtn>
      </View>
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
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    padding: 14,
    paddingBottom: 4,
  },
  sectionPad: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  loadoutRow: {
    flexDirection: 'row',
    gap: 8,
  },
  loadoutCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: C.bg0,
    padding: 8,
    gap: 2,
  },
  loadoutId: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  loadoutName: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  loadoutCode: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  loadoutDesc: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.ink2,
    marginTop: 2,
  },
  emptySlot: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.bg1,
    padding: 8,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink4,
  },
  itemGrid: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemCard: {
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  itemCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemId: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
  },
  itemHave: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  itemName: {
    fontFamily: 'sans-serif-condensed',
    fontSize: 12,
    fontWeight: '600',
    color: C.ink,
  },
  itemDesc: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: C.ink3,
    lineHeight: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: C.bg0,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  backBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },
});
