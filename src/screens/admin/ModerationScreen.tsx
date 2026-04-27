import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

type ReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  reporter?: ProfileLite | null;
  targetUser?: ProfileLite | null;
};

type ProfileLite = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M`;
  if (h < 24) return `${h}H`;
  return `${d}D`;
}

function displayName(profile?: ProfileLite | null) {
  if (!profile) return 'UNKNOWN';
  return (profile.full_name ?? profile.username ?? 'UNKNOWN').toUpperCase();
}

export default function ModerationScreen() {
  const navigation = useNavigation<any>();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data: raw, error } = await supabase
      .from('reports')
      .select('id, reporter_id, target_type, target_id, target_user_id, reason, status, created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      setLoading(false);
      Alert.alert('MODERATION FAILED', error.message.toUpperCase());
      return;
    }

    const rows = (raw ?? []) as ReportRow[];
    const profileIds = [...new Set(rows.flatMap((row) => [row.reporter_id, row.target_user_id]).filter(Boolean))] as string[];
    const profileMap: Record<string, ProfileLite> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_photo_url')
        .in('id', profileIds);
      (profiles ?? []).forEach((profile: any) => {
        profileMap[profile.id] = profile as ProfileLite;
      });
    }

    setReports(rows.map((row) => ({
      ...row,
      reporter: row.reporter_id ? profileMap[row.reporter_id] : null,
      targetUser: row.target_user_id ? profileMap[row.target_user_id] : null,
    })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadReports();
  }, [loadReports]));

  const openTarget = (report: ReportRow) => {
    if (report.target_type === 'profile' && report.target_user_id) {
      navigation.navigate('ArtistProfile', { userId: report.target_user_id });
      return;
    }
    if (report.target_type === 'post') {
      navigation.navigate('PostDetail', { postId: report.target_id });
      return;
    }
    if (report.target_type === 'gig') {
      navigation.navigate('GigDetail', { gigId: report.target_id });
      return;
    }
    if (report.target_type === 'project') {
      navigation.navigate('ProjectDetail', { projectId: report.target_id });
      return;
    }
    Alert.alert('OPEN MANUALLY', `TARGET: ${report.target_type.toUpperCase()}\nID: ${report.target_id}`);
  };

  const markReviewed = async (report: ReportRow) => {
    const nextStatus = report.status === 'reviewed' ? 'open' : 'reviewed';
    const { error } = await supabase
      .from('reports')
      .update({ status: nextStatus, reviewed_at: nextStatus === 'reviewed' ? new Date().toISOString() : null })
      .eq('id', report.id);

    if (error) {
      Alert.alert('UPDATE FAILED', error.message.toUpperCase());
      return;
    }

    setReports((prev) => prev.map((row) => row.id === report.id ? { ...row, status: nextStatus } : row));
  };

  const deleteTarget = async (report: ReportRow) => {
    const tableByType: Record<string, string> = {
      post: 'posts',
      gig: 'gigs',
      project: 'projects',
      feature: 'features',
    };
    const table = tableByType[report.target_type];

    if (!table) {
      Alert.alert('NOT AVAILABLE', 'THIS REPORT TYPE CAN BE REVIEWED, BUT NOT DELETED FROM HERE.');
      return;
    }

    Alert.alert(
      `DELETE ${report.target_type.toUpperCase()}?`,
      'This removes the reported content from WOA. This cannot be undone.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            const { error: deleteError } = await supabase.from(table).delete().eq('id', report.target_id);
            if (deleteError) {
              Alert.alert('DELETE FAILED', deleteError.message.toUpperCase());
              return;
            }

            await supabase
              .from('reports')
              .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
              .eq('id', report.id);

            setReports((prev) => prev.map((row) => row.id === report.id ? { ...row, status: 'reviewed' } : row));
            Alert.alert('DELETED', `${report.target_type.toUpperCase()} REMOVED.`);
          },
        },
      ]
    );
  };

  const renderReport = ({ item }: { item: ReportRow }) => (
    <View style={[s.card, item.status === 'reviewed' && s.cardReviewed]}>
      <View style={s.cardHeader}>
        <OctagonalImage size={34} imageUri={item.targetUser?.profile_photo_url ?? null} />
        <View style={s.cardTitleWrap}>
          <Text style={s.targetType}>{item.target_type.toUpperCase()} REPORT</Text>
          <Text style={s.targetName}>{displayName(item.targetUser)}</Text>
        </View>
        <Text style={s.time}>{timeAgo(item.created_at)}</Text>
      </View>

      <Text style={s.reason}>{(item.reason ?? 'NO REASON PROVIDED').toUpperCase()}</Text>
      <Text style={s.meta}>REPORTED BY {displayName(item.reporter)}</Text>

      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => openTarget(item)} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={15} color={colors.white} />
          <Text style={s.actionText}>OPEN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, item.status !== 'reviewed' && s.actionBtnGold]}
          onPress={() => markReviewed(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-outline" size={15} color={item.status === 'reviewed' ? '#9a9a9a' : '#f6c55a'} />
          <Text style={[s.actionText, item.status !== 'reviewed' && s.actionTextGold]}>
            {item.status === 'reviewed' ? 'REOPEN' : 'REVIEWED'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => deleteTarget(item)} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color={colors.red} />
          <Text style={[s.actionText, s.actionTextDanger]}>DELETE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>MODERATION</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={reports.length === 0 ? s.emptyWrap : s.listContent}
          ListEmptyComponent={(
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#222222" />
              <Text style={s.emptyText}>NO REPORTS TO REVIEW</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 8, padding: 4 },
  backArrow: { color: colors.white, fontSize: 28, lineHeight: 32, fontFamily: MONO },
  title: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2 },
  listContent: { paddingVertical: 8 },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardReviewed: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleWrap: { flex: 1 },
  targetType: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.18, marginBottom: 3 },
  targetName: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15 },
  time: { color: '#777777', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  reason: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08, lineHeight: 18, marginTop: 12 },
  meta: { color: '#666666', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionBtnGold: { borderColor: '#f6c55a' },
  actionBtnDanger: { borderColor: colors.red },
  actionText: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },
  actionTextGold: { color: '#f6c55a' },
  actionTextDanger: { color: colors.red },
  emptyWrap: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#777777', fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
});
