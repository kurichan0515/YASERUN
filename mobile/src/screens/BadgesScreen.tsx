import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { getUserProgress } from '../api/logs';
import { colors } from '../theme/colors';

type Category = 'streak' | 'log' | 'achieve';

interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  symbol: string;
  category: Category;
  threshold: number;
}

const CATEGORY_META: Record<Category, { label: string; sub: string; color: string }> = {
  streak:  { label: '継続',   sub: 'STREAK',  color: colors.neon.blue   },
  log:     { label: '記録',   sub: 'LOG',     color: colors.neon.orange },
  achieve: { label: '達成',   sub: 'ACHIEVE', color: colors.neon.green  },
};

const ALL_TROPHIES: TrophyDef[] = [
  { id: 'streak_3',       name: '3日連続',       desc: '3日連続でログを記録',          symbol: '3',   category: 'streak',  threshold: 3   },
  { id: 'streak_7',       name: '1週間継続',     desc: '7日連続でログを記録',          symbol: '7',   category: 'streak',  threshold: 7   },
  { id: 'streak_14',      name: '2週間継続',     desc: '14日連続でログを記録',         symbol: '14',  category: 'streak',  threshold: 14  },
  { id: 'streak_30',      name: '1ヶ月継続',     desc: '30日連続でログを記録',         symbol: '30',  category: 'streak',  threshold: 30  },
  { id: 'streak_60',      name: '2ヶ月継続',     desc: '60日連続でログを記録',         symbol: '60',  category: 'streak',  threshold: 60  },
  { id: 'streak_100',     name: '100日継続',     desc: '100日連続でログを記録',        symbol: '∞',   category: 'streak',  threshold: 100 },
  { id: 'weight_first',   name: '初計測',        desc: '初めて体重を記録',             symbol: '◉',   category: 'log',     threshold: 1   },
  { id: 'meal_first',     name: '初食事記録',    desc: '初めて食事を記録',             symbol: '🍽',  category: 'log',     threshold: 1   },
  { id: 'exercise_first', name: '初トレーニング', desc: '初めてトレーニングを記録',    symbol: '⚡',  category: 'log',     threshold: 1   },
  { id: 'meal_10',        name: '食事 × 10',     desc: '食事を10回記録',               symbol: '◆',   category: 'log',     threshold: 10  },
  { id: 'meal_50',        name: '食事 × 50',     desc: '食事を50回記録',               symbol: '◈',   category: 'log',     threshold: 50  },
  { id: 'exercise_10',    name: '運動 × 10',     desc: '運動を10回記録',               symbol: '▲',   category: 'log',     threshold: 10  },
  { id: 'exercise_50',    name: '運動 × 50',     desc: '運動を50回記録',               symbol: '▲▲',  category: 'log',     threshold: 50  },
  { id: 'goal_achieve',   name: '目標達成',      desc: '目標体重をクリア',             symbol: '★',   category: 'achieve', threshold: 1   },
  { id: 'recovery',       name: '体型回復',      desc: 'アバターを回復させた',          symbol: '↑',   category: 'achieve', threshold: 1   },
  { id: 'comeback',       name: 'カムバック',    desc: '中断後に記録を再開',            symbol: '↺',   category: 'achieve', threshold: 1   },
];

const TROPHY_MAP = new Map(ALL_TROPHIES.map(t => [t.id, t]));
const CATEGORIES: Category[] = ['streak', 'log', 'achieve'];

interface StatsItem { badgeId: string; count: number; rate: number }

function TrophyModal({
  trophy, isEarned, earnedAt, statsItem, onClose,
}: {
  trophy: TrophyDef;
  isEarned: boolean;
  earnedAt?: string;
  statsItem?: StatsItem;
  onClose: () => void;
}) {
  const meta = CATEGORY_META[trophy.category];
  const rate = statsItem?.rate ?? 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.sheet} onPress={() => {}}>
          <View style={[ms.symbolCircle, { borderColor: isEarned ? meta.color : colors.border.subtle }]}>
            <Text style={[ms.symbol, { color: isEarned ? meta.color : colors.text.muted }]}>{trophy.symbol}</Text>
          </View>
          <Text style={ms.title}>{trophy.name}</Text>
          <View style={[ms.catChip, { backgroundColor: `${meta.color}22` }]}>
            <Text style={[ms.catChipText, { color: meta.color }]}>{meta.sub}</Text>
          </View>
          <Text style={ms.cond}>{trophy.desc}</Text>
          {isEarned && earnedAt && (
            <Text style={ms.earnedAt}>
              取得日: {new Date(earnedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          )}
          <View style={ms.divider} />
          <Text style={ms.statsLabel}>みんなの取得率</Text>
          {statsItem ? (
            <>
              <Text style={[ms.statsRate, { color: meta.color }]}>{rate}%</Text>
              <View style={ms.rateTrack}>
                <View style={[ms.rateFill, { width: `${Math.min(rate, 100)}%` as any, backgroundColor: meta.color }]} />
              </View>
              <Text style={ms.statsCount}>{statsItem.count} 人が取得済み</Text>
            </>
          ) : (
            <Text style={ms.statsCount}>—</Text>
          )}
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Text style={ms.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function BadgesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: earned, isLoading, isError } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.get('/users/me/badges').then(r => r.data as any[]),
  });
  const { data: progress } = useQuery({
    queryKey: ['userProgress'],
    queryFn: getUserProgress,
    staleTime: 1000 * 60 * 5,
  });
  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/users/me/streak').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const { data: statsData } = useQuery({
    queryKey: ['badgeStats'],
    queryFn: () => api.get('/badges/stats').then(r => r.data as { totalUsers: number; stats: StatsItem[] }),
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color={colors.neon.blue} />;
  if (isError) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.text.muted, fontSize: 14 }}>トロフィーの取得に失敗しました</Text>
    </View>
  );

  const earnedSet = new Set((earned || []).map((b: any) => b.badgeId as string));
  const earnedDateMap = new Map<string, string>(
    (earned || []).map((b: any) => [b.badgeId as string, b.earnedAt as string])
  );
  const statsMap = new Map<string, StatsItem>(
    (statsData?.stats ?? []).map((s: StatsItem) => [s.badgeId, s])
  );

  const getProgress = (trophy: TrophyDef): { current: number; total: number } | null => {
    if (earnedSet.has(trophy.id)) return null;
    const streakDays    = streak?.currentDays ?? 0;
    const mealCount     = progress?.mealCount    ?? 0;
    const exerciseCount = progress?.exerciseCount ?? 0;

    if (trophy.category === 'streak') {
      return { current: Math.min(streakDays, trophy.threshold), total: trophy.threshold };
    }
    if (['meal_first', 'meal_10', 'meal_50'].includes(trophy.id)) {
      return { current: Math.min(mealCount, trophy.threshold), total: trophy.threshold };
    }
    if (['exercise_first', 'exercise_10', 'exercise_50'].includes(trophy.id)) {
      return { current: Math.min(exerciseCount, trophy.threshold), total: trophy.threshold };
    }
    return null;
  };

  const total = ALL_TROPHIES.length;
  const got   = earnedSet.size;
  const pct   = total > 0 ? Math.round((got / total) * 100) : 0;

  const sections = CATEGORIES.map(cat => ({
    cat,
    trophies: ALL_TROPHIES.filter(t => t.category === cat),
  }));

  const selectedTrophy = selectedId ? TROPHY_MAP.get(selectedId) : null;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerSub}>TROPHIES</Text>
        <Text style={s.headerTitle}>{got} <Text style={s.headerOf}>/ {total}</Text></Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={s.headerPct}>{pct}% 達成</Text>
        {got === 0 && (
          <Text style={s.emptyHint}>体重・食事・運動を記録してトロフィーを獲得しよう</Text>
        )}
      </View>

      <FlatList
        data={sections}
        keyExtractor={({ cat }) => cat}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: { cat, trophies } }) => {
          const meta = CATEGORY_META[cat];
          const catEarned = trophies.filter(t => earnedSet.has(t.id)).length;
          return (
            <View style={s.section}>
              <View style={s.catHeader}>
                <View style={[s.catBar, { backgroundColor: meta.color }]} />
                <Text style={[s.catSub, { color: meta.color }]}>{meta.sub}</Text>
                <Text style={s.catLabel}>{meta.label}</Text>
                <Text style={s.catCount}>{catEarned}/{trophies.length}</Text>
              </View>
              <View style={s.grid}>
                {trophies.map(t => {
                  const isEarned = earnedSet.has(t.id);
                  const prog = getProgress(t);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setSelectedId(t.id)}
                      activeOpacity={0.7}
                      style={[
                        s.card,
                        isEarned
                          ? { borderColor: meta.color, backgroundColor: `${meta.color}12` }
                          : s.cardLocked,
                      ]}
                    >
                      <Text style={[s.symbol, { color: isEarned ? meta.color : colors.text.muted }]}>
                        {t.symbol}
                      </Text>
                      <Text style={[s.cardName, !isEarned && s.lockedText]}>{t.name}</Text>
                      <Text style={[s.cardDesc, !isEarned && s.lockedDesc]}>{t.desc}</Text>
                      {isEarned && (() => {
                        const at = earnedDateMap.get(t.id);
                        return at ? (
                          <Text style={s.earnedDate}>
                            {new Date(at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </Text>
                        ) : null;
                      })()}
                      {!isEarned && prog && (
                        <View style={s.progressWrap}>
                          <View style={s.badgeProgressTrack}>
                            <View style={[s.badgeProgressFill, { width: `${Math.round(prog.current / prog.total * 100)}%` as any, backgroundColor: meta.color }]} />
                          </View>
                          <Text style={[s.progressText, { color: meta.color }]}>{prog.current}/{prog.total}</Text>
                        </View>
                      )}
                      <View style={[s.statusBadge, isEarned ? { backgroundColor: meta.color } : s.lockedBadge]}>
                        <Text style={[s.statusBadgeText, !isEarned && s.lockedBadgeText]}>
                          {isEarned ? 'GET' : 'LOCK'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />

      {selectedTrophy && (
        <TrophyModal
          trophy={selectedTrophy}
          isEarned={earnedSet.has(selectedTrophy.id)}
          earnedAt={earnedDateMap.get(selectedTrophy.id)}
          statsItem={statsMap.get(selectedTrophy.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg.primary },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 20, paddingHorizontal: 24 },
  headerSub:   { fontSize: 11, letterSpacing: 2, color: colors.text.muted, fontWeight: '700', marginBottom: 4 },
  headerTitle: { fontSize: 48, fontWeight: '800', color: colors.neon.blue, lineHeight: 56 },
  headerOf:    { fontSize: 24, color: colors.text.muted, fontWeight: '400' },
  progressTrack: { width: '100%', height: 4, backgroundColor: colors.bg.cardAlt, borderRadius: 2, marginTop: 12, marginBottom: 6, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: colors.neon.blue, borderRadius: 2 },
  headerPct:     { fontSize: 12, color: colors.text.secondary },
  emptyHint:     { fontSize: 13, color: colors.text.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  list:      { paddingHorizontal: 16, paddingBottom: 32 },
  section:   { marginBottom: 24 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catBar:    { width: 3, height: 16, borderRadius: 2 },
  catSub:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  catLabel:  { fontSize: 14, fontWeight: '700', color: colors.text.primary, flex: 1 },
  catCount:  { fontSize: 12, color: colors.text.muted },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:        { width: '47%', backgroundColor: colors.bg.card, borderRadius: 14, padding: 14, borderWidth: 1, minHeight: 108 },
  cardLocked:  { backgroundColor: colors.bg.cardAlt, borderColor: colors.border.subtle },
  symbol:      { fontSize: 26, fontWeight: '800', marginBottom: 8, lineHeight: 32 },
  cardName:    { fontSize: 12, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
  cardDesc:    { fontSize: 10, color: colors.text.muted, lineHeight: 15 },
  lockedText:  { color: colors.text.muted },
  lockedDesc:  { color: colors.bg.card },

  statusBadge:     { position: 'absolute', top: 10, right: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', color: colors.bg.primary, letterSpacing: 0.5 },
  lockedBadge:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border.subtle },
  lockedBadgeText: { color: colors.text.muted },
  earnedDate:      { fontSize: 9, color: colors.text.muted, marginTop: 3 },
  progressWrap:        { marginTop: 6, gap: 2 },
  badgeProgressTrack:  { height: 3, backgroundColor: colors.bg.cardAlt, borderRadius: 2, overflow: 'hidden' },
  badgeProgressFill:   { height: 3, borderRadius: 2 },
  progressText:        { fontSize: 9, fontWeight: '700', marginTop: 1 },
});

const ms = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:       { backgroundColor: colors.bg.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center' },
  symbolCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  symbol:       { fontSize: 30, fontWeight: '800' },
  title:        { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: 8 },
  catChip:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginBottom: 12 },
  catChipText:  { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cond:         { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  earnedAt:     { fontSize: 12, color: colors.text.muted, marginBottom: 4 },
  divider:      { width: '100%', height: 1, backgroundColor: colors.border.subtle, marginVertical: 16 },
  statsLabel:   { fontSize: 12, color: colors.text.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  statsRate:    { fontSize: 40, fontWeight: '800', lineHeight: 44 },
  rateTrack:    { width: '100%', height: 6, backgroundColor: colors.bg.cardAlt, borderRadius: 3, overflow: 'hidden', marginTop: 8, marginBottom: 6 },
  rateFill:     { height: 6, borderRadius: 3 },
  statsCount:   { fontSize: 12, color: colors.text.muted, marginBottom: 16 },
  closeBtn:     { paddingHorizontal: 32, paddingVertical: 12, backgroundColor: colors.bg.cardAlt, borderRadius: 12 },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: colors.text.secondary },
});
