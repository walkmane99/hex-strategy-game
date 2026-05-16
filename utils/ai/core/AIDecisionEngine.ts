import { Unit } from '@/types/unit';
import { OffsetCoord } from '@/types/map';
import { ItemType } from '@/types/item';
import { SpecialSkillType } from '@/types/unit';
import { ActionCandidate, AIContext, AIDifficulty } from './types';
import { ScoreEvaluator } from '../scoring/types';
import { reachableCells } from '@/utils/pathfinding';
import { offsetDistance, offsetRange } from '@/utils/hexMath';
import { ATTACK_RANGE_BY_TYPE } from '../data/scoreWeights';
import { tieBreakerCompare } from './tieBreaker';

// =====================
// Item candidate generation
// =====================

function generateItemCandidates(
  itemId: ItemType,
  unit: Unit,
  context: AIContext,
): ActionCandidate[] {
  const { allyUnits, visibleEnemyUnits, probability } = context;
  const base = { type: 'useItem' as const, unit, itemId, score: 0 };

  switch (itemId) {
    case 'flare': {
      // targetTile = 最も確率が高いタイル
      if (!probability || probability.size === 0) return [base];
      let bestKey = '';
      let bestProb = -1;
      for (const [k, p] of probability) {
        if (p > bestProb) { bestProb = p; bestKey = k; }
      }
      if (!bestKey) return [base];
      const [q, r] = bestKey.split(',').map(Number) as [number, number];
      // cube→offset 変換: odd-q
      const col = q;
      const row = r + (q - (q & 1)) / 2;
      return [{ ...base, targetTile: { col, row } }];
    }

    case 'carpet_bombing': {
      // targetTile = 可視敵の重心
      if (visibleEnemyUnits.length === 0) return [base];
      const cx = Math.round(
        visibleEnemyUnits.reduce((s, e) => s + e.position.col, 0) / visibleEnemyUnits.length,
      );
      const cy = Math.round(
        visibleEnemyUnits.reduce((s, e) => s + e.position.row, 0) / visibleEnemyUnits.length,
      );
      return [{ ...base, targetTile: { col: cx, row: cy } }];
    }

    case 'emp_grenade': {
      // 各可視敵の位置を中心に候補生成（最大3件、枝刈り）
      if (visibleEnemyUnits.length === 0) return [];
      return visibleEnemyUnits.slice(0, 3).map(e => ({
        ...base,
        targetTile: e.position,
      }));
    }

    case 'supply_pack': {
      // targetUnit = 最もHP%が低い味方
      if (allyUnits.length === 0) return [];
      const target = allyUnits.reduce((worst, a) =>
        a.currentHP / a.stats.maxHP < worst.currentHP / worst.stats.maxHP ? a : worst,
      );
      return [{ ...base, targetUnit: target }];
    }

    case 'drone_recon': {
      // 範囲広域効果のため特定 targetTile 不要
      return [base];
    }

    case 'land_mine': {
      // 可視敵と自ユニット中間の 2 点を候補とする（枝刈り）
      if (visibleEnemyUnits.length === 0) return [];
      return visibleEnemyUnits.slice(0, 2).map(e => {
        const col = Math.round((unit.position.col + e.position.col) / 2);
        const row = Math.round((unit.position.row + e.position.row) / 2);
        return { ...base, targetTile: { col, row } };
      });
    }

    case 'camo_net': {
      // targetUnit = スナイパー射程内で最もHPが低い味方
      if (allyUnits.length === 0) return [];
      const snipers = visibleEnemyUnits.filter(e => e.type === 'sniper');
      const sniperRange = ATTACK_RANGE_BY_TYPE['sniper'] ?? 3;
      const inRange = snipers.length > 0
        ? allyUnits.filter(a => snipers.some(s => offsetDistance(a.position, s.position) <= sniperRange))
        : allyUnits;
      if (inRange.length === 0) return [];
      const target = inRange.reduce((worst, a) =>
        a.currentHP / a.stats.maxHP < worst.currentHP / worst.stats.maxHP ? a : worst,
      );
      return [{ ...base, targetUnit: target }];
    }

    case 'smoke_screen': {
      // targetTile = スナイパー射程内にいる味方の重心
      const snipers = visibleEnemyUnits.filter(e => e.type === 'sniper');
      const sniperRange = ATTACK_RANGE_BY_TYPE['sniper'] ?? 3;
      const exposed = snipers.length > 0
        ? allyUnits.filter(a => snipers.some(s => offsetDistance(a.position, s.position) <= sniperRange))
        : allyUnits;
      if (exposed.length === 0) return [base];
      const cx = Math.round(exposed.reduce((s, a) => s + a.position.col, 0) / exposed.length);
      const cy = Math.round(exposed.reduce((s, a) => s + a.position.row, 0) / exposed.length);
      return [{ ...base, targetTile: { col: cx, row: cy } }];
    }

    case 'barricade': {
      // 進路制限: 自ユニットと最近傍の可視敵の中間点
      if (visibleEnemyUnits.length === 0) return [base];
      let nearest = visibleEnemyUnits[0]!;
      let minDist = offsetDistance(unit.position, nearest.position);
      for (const e of visibleEnemyUnits) {
        const d = offsetDistance(unit.position, e.position);
        if (d < minDist) { minDist = d; nearest = e; }
      }
      const col = Math.round((unit.position.col + nearest.position.col) / 2);
      const row = Math.round((unit.position.row + nearest.position.row) / 2);
      return [{ ...base, targetTile: { col, row } }];
    }

    default:
      return [];
  }
}

// =====================
// Skill candidate generation
// =====================

function generateSkillCandidates(
  skillId: SpecialSkillType,
  unit: Unit,
  context: AIContext,
): ActionCandidate[] {
  const { visibleEnemyUnits, grid } = context;
  const base = { type: 'useSkill' as const, unit, skillId, score: 0 };
  const range = ATTACK_RANGE_BY_TYPE[unit.type] ?? 1;

  switch (skillId) {
    case 'battlefield_inspiration':
    case 'emergency_repair':
    case 'scout_jamming':
      return [base];

    case 'defense_pierce': {
      // targetUnit = 射程内で最も防御力が高い敵
      const inRange = visibleEnemyUnits.filter(
        e => offsetDistance(unit.position, e.position) <= range,
      );
      if (inRange.length === 0) return [];
      const target = inRange.reduce((best, e) =>
        e.stats.defense > best.stats.defense ? e : best,
      );
      return [{ ...base, targetUnit: target }];
    }

    case 'swift_thunder': {
      // とどめ可能な敵 or 自己退避の意思表示
      const killable = visibleEnemyUnits.find(
        e => offsetDistance(unit.position, e.position) <= range &&
             e.currentHP <= unit.stats.attack * 1.5,
      );
      if (killable) return [{ ...base, targetUnit: killable }];
      return [base];
    }

    case 'scout_marker': {
      // targetTile = グリッド内で最も近い highland タイル
      const tiles = offsetRange(unit.position, 5);
      let bestTile: OffsetCoord | undefined;
      let bestDist = Infinity;
      for (const t of tiles) {
        const cell = grid[t.row]?.[t.col];
        if (!cell || cell.terrain !== 'highland') continue;
        const d = offsetDistance(unit.position, t);
        if (d < bestDist) { bestDist = d; bestTile = t; }
      }
      return bestTile ? [{ ...base, targetTile: bestTile }] : [base];
    }

    case 'decoy': {
      // targetTile = 可視敵の索敵範囲内 (近傍3マス以内) のタイル
      if (visibleEnemyUnits.length === 0) return [base];
      const tiles = offsetRange(unit.position, 4);
      let bestTile: OffsetCoord | undefined;
      let maxOverlap = -1;
      for (const t of tiles) {
        const cell = grid[t.row]?.[t.col];
        if (!cell || cell.terrain === 'water') continue;
        const overlap = visibleEnemyUnits.filter(
          e => offsetDistance(t, e.position) <= 3,
        ).length;
        if (overlap > maxOverlap) { maxOverlap = overlap; bestTile = t; }
      }
      return bestTile ? [{ ...base, targetTile: bestTile }] : [base];
    }

    default:
      return [];
  }
}

// =====================
// Main candidate generation
// =====================

export function generateCandidates(
  unit: Unit,
  context: AIContext,
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  const range = ATTACK_RANGE_BY_TYPE[unit.type] ?? 1;
  const { visibleEnemyUnits, grid } = context;

  for (const player of visibleEnemyUnits) {
    if (offsetDistance(unit.position, player.position) <= range) {
      candidates.push({ type: 'attack', unit, targetUnit: player, score: 0 });
    }
  }

  const reachable = reachableCells(unit.position, grid, unit, unit.stats.movement);
  for (const cell of reachable) {
    candidates.push({ type: 'move', unit, targetTile: cell, score: 0 });
  }

  // useItem 候補: チームインベントリから生成（候補数を制御）
  if (context.teamInventory) {
    for (const slot of context.teamInventory) {
      if (slot.remainingUses <= 0) continue;
      const itemCandidates = generateItemCandidates(slot.itemId, unit, context);
      candidates.push(...itemCandidates);
    }
  }

  // useSkill 候補: ユニットのスキルスロットから生成
  if (unit.skills) {
    for (const slot of unit.skills) {
      if (slot.cooldown > 0) continue;
      if (slot.remainingUses !== undefined && slot.remainingUses <= 0) continue;
      const skillCandidates = generateSkillCandidates(slot.skillId, unit, context);
      candidates.push(...skillCandidates);
    }
  }

  candidates.push({ type: 'wait', unit, score: 0 });

  return candidates;
}

export function evaluateCandidates(
  candidates: ActionCandidate[],
  context: AIContext,
  evaluators: ScoreEvaluator[],
): ActionCandidate[] {
  return candidates.map(candidate => {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const evaluator of evaluators) {
      const s = evaluator(candidate, context);
      breakdown[evaluator.name] = s;
      total += s;
    }
    return { ...candidate, score: total, scoreBreakdown: breakdown };
  });
}

export function selectBest(
  candidates: ActionCandidate[],
  difficulty: AIDifficulty,
  context: AIContext,
): ActionCandidate {
  if (candidates.length === 0) {
    // Should never happen — generateCandidates always includes 'wait'
    throw new Error('selectBest called with empty candidates');
  }

  const threshold = difficulty === 'expert' ? 1.0 : difficulty === 'hard' ? 0.9 : 0.7;

  // Sort: first by score descending, then by tie-breaker
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return tieBreakerCompare(a, b, context);
  });

  const first = sorted[0]!;

  if (difficulty === 'expert' || Math.random() < threshold) return first;

  const pool = sorted.slice(0, Math.min(3, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? first;
}
