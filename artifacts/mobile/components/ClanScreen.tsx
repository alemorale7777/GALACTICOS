import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ClanData } from '@/hooks/useClanSystem';

const BANNER_COLORS = ['#CC2222', '#00BFFF', '#CC7722', '#22AAAA', '#44BB66', '#FFD700', '#9944CC', '#FF6B35'];

interface Props {
  clan: ClanData | null;
  onCreateClan: (name: string, color: string) => void;
  onJoinClan: (code: string) => void;
  onLeaveClan: () => void;
  onGetShareCode: () => string;
  onBack: () => void;
}

export default function ClanScreen({ clan, onCreateClan, onJoinClan, onLeaveClan, onGetShareCode, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const [mode, setMode] = useState<'view' | 'create' | 'join'>('view');
  const [name, setName] = useState('');
  const [color, setColor] = useState(BANNER_COLORS[0]);
  const [joinCode, setJoinCode] = useState('');
  const [shareCode, setShareCode] = useState('');

  const handleCreate = () => {
    if (name.trim()) {
      onCreateClan(name.trim(), color);
      setMode('view');
      setName('');
    }
  };

  const handleJoin = () => {
    if (joinCode.trim()) {
      onJoinClan(joinCode.trim());
      setMode('view');
      setJoinCode('');
    }
  };

  const handleShare = () => {
    const code = onGetShareCode();
    setShareCode(code);
  };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CLAN</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Current clan view */}
      {clan && mode === 'view' && (
        <View style={styles.content}>
          <View style={[styles.banner, { backgroundColor: clan.bannerColor + '22', borderColor: clan.bannerColor + '44' }]}>
            <View style={[styles.bannerIcon, { backgroundColor: clan.bannerColor }]}>
              <Text style={styles.bannerInitials}>{clan.initials}</Text>
            </View>
            <Text style={[styles.clanName, { color: clan.bannerColor }]}>{clan.name}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{clan.weeklyXP}</Text>
              <Text style={styles.statLbl}>WEEKLY XP</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{clan.memberCount}</Text>
              <Text style={styles.statLbl}>MEMBERS</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Feather name="share-2" size={16} color="rgba(255,210,100,0.6)" />
            <Text style={styles.actionText}>INVITE CODE</Text>
          </TouchableOpacity>
          {shareCode !== '' && (
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{shareCode}</Text>
              <Text style={styles.codeHint}>Share this code with friends</Text>
            </View>
          )}

          <Text style={styles.chatPlaceholder}>Clan chat coming soon</Text>

          <TouchableOpacity style={styles.leaveBtn} onPress={onLeaveClan} activeOpacity={0.7}>
            <Text style={styles.leaveBtnText}>LEAVE CLAN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* No clan */}
      {!clan && mode === 'view' && (
        <View style={styles.content}>
          <Text style={styles.noClanText}>You are not in a clan</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('create')} activeOpacity={0.8}>
            <Feather name="plus" size={18} color="#000" />
            <Text style={styles.primaryBtnText}>CREATE CLAN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setMode('join')} activeOpacity={0.7}>
            <Feather name="log-in" size={16} color="rgba(255,210,100,0.6)" />
            <Text style={styles.actionText}>JOIN WITH CODE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create clan */}
      {mode === 'create' && (
        <View style={styles.content}>
          <Text style={styles.formTitle}>CREATE CLAN</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Clan name (max 16)" placeholderTextColor="rgba(255,210,100,0.2)"
            maxLength={16} />
          <Text style={styles.colorLabel}>Banner Color</Text>
          <View style={styles.colorRow}>
            {BANNER_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c },
                c === color && styles.colorActive]}
                onPress={() => setColor(c)} />
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>CREATE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('view')}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Join clan */}
      {mode === 'join' && (
        <View style={styles.content}>
          <Text style={styles.formTitle}>JOIN CLAN</Text>
          <TextInput style={styles.input} value={joinCode} onChangeText={setJoinCode}
            placeholder="Enter invite code" placeholderTextColor="rgba(255,210,100,0.2)"
            autoCapitalize="characters" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>JOIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('view')}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 4 },
  content: { padding: 24, gap: 16, alignItems: 'center' },
  banner: {
    width: '100%', alignItems: 'center', gap: 10, paddingVertical: 24,
    borderRadius: 20, borderWidth: 1,
  },
  bannerIcon: {
    width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  bannerInitials: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF' },
  clanName: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statBox: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF8E8' },
  statLbl: { fontSize: 9, color: 'rgba(255,210,100,0.3)', fontFamily: 'Inter_500Medium', letterSpacing: 1 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    height: 46, borderRadius: 23, justifyContent: 'center',
    backgroundColor: 'rgba(255,200,60,0.06)', borderWidth: 1, borderColor: 'rgba(255,200,60,0.12)',
  },
  actionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,210,100,0.6)', letterSpacing: 1 },
  codeBox: {
    width: '100%', alignItems: 'center', padding: 16,
    backgroundColor: 'rgba(255,220,80,0.04)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.08)',
  },
  codeText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFD700', letterSpacing: 3 },
  codeHint: { fontSize: 10, color: 'rgba(255,210,100,0.25)', fontFamily: 'Inter_400Regular', marginTop: 4 },
  chatPlaceholder: { fontSize: 12, color: 'rgba(255,210,100,0.15)', fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  leaveBtn: { marginTop: 20 },
  leaveBtnText: { fontSize: 12, color: 'rgba(238,51,68,0.5)', fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  noClanText: { fontSize: 14, color: 'rgba(255,210,100,0.3)', fontFamily: 'Inter_400Regular' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    height: 50, borderRadius: 25, justifyContent: 'center', backgroundColor: '#FFAA22',
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 2 },
  formTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 2 },
  input: {
    width: '100%', height: 48, borderRadius: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,220,80,0.04)', borderWidth: 1, borderColor: 'rgba(255,200,60,0.1)',
    color: '#FFF8E8', fontSize: 16, fontFamily: 'Inter_500Medium',
  },
  colorLabel: { fontSize: 11, color: 'rgba(255,210,100,0.35)', fontFamily: 'Inter_500Medium', letterSpacing: 1, alignSelf: 'flex-start' },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorActive: { borderWidth: 3, borderColor: '#FFF' },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 13, color: 'rgba(255,210,100,0.3)', fontFamily: 'Inter_400Regular' },
});
