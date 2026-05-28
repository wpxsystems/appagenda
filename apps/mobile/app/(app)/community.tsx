import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius, shadow } from '@racket-app/ui'
import { apiGet, apiPost } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'

type Group = {
  id: string; name: string; sport: string | null
  memberCount: number; isAdmin: boolean
  lastMessage: string | null; lastMessageAt: string | null
}
type Connection = {
  id: string; name: string; avatarUrl: string | null; isFavorite: boolean
  sportProfiles: { sport: string; category: string | null; skillLevel: string | null }[]
  lastGameAt: string | null
}

const SPORT_LABEL: Record<string, string> = {
  padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis',
}
const SPORT_COLOR: Record<string, string> = {
  padel: colors.sportPadel,
  beach_tennis: colors.sportBeachTennis,
  tennis: colors.sportTennis,
}

export default function CommunityScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'groups' | 'connections'>('groups')

  const [groups, setGroups] = useState<Group[]>([])
  const [connections, setConnections] = useState<{ recentPlayers: Connection[]; favorites: Connection[] }>({ recentPlayers: [], favorites: [] })
  const [loading, setLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSport, setNewSport] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try { setGroups(await apiGet<Group[]>('/community/groups')) }
    catch { /* ignore */ }
    setLoading(false)
  }, [])

  const loadConnections = useCallback(async () => {
    setLoading(true)
    try { setConnections(await apiGet<typeof connections>('/community/favorites')) }
    catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (tab === 'groups') loadGroups(); else loadConnections() }, [tab])

  async function createGroup() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const g = await apiPost<Group>('/community/groups', { name: newName.trim(), sport: newSport })
      setGroups(prev => [g, ...prev])
      setShowCreate(false); setNewName(''); setNewSport(null)
    } catch (e: any) { Alert.alert('Erro', e.message) }
    setCreating(false)
  }

  const allFavIds = new Set(connections.favorites.map(f => f.id))
  const recentOnly = connections.recentPlayers.filter(c => !allFavIds.has(c.id))

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>{user?.name?.toUpperCase()}</Text>
        <Text style={styles.headerTitle}>Comunidade</Text>
        <Text style={styles.headerDesc}>Conectar pessoas é o nosso propósito</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'groups' && styles.tabBtnActive]}
          onPress={() => setTab('groups')}
        >
          <Text style={[styles.tabText, tab === 'groups' && styles.tabTextActive]}>
            Grupos{groups.length > 0 ? `  ${groups.length}` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'connections' && styles.tabBtnActive]}
          onPress={() => setTab('connections')}
        >
          <Text style={[styles.tabText, tab === 'connections' && styles.tabTextActive]}>
            Conexões{(connections.favorites.length + recentOnly.length) > 0 ? `  ${connections.favorites.length + recentOnly.length}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.textPrimary} />
      ) : tab === 'groups' ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* Criar grupo */}
          <TouchableOpacity style={styles.createRow} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
            <View style={styles.createIcon}>
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </View>
            <Text style={styles.createText}>Criar novo grupo</Text>
          </TouchableOpacity>

          {groups.map(g => (
            <TouchableOpacity
              key={g.id}
              style={styles.groupCard}
              onPress={() => router.push({ pathname: '/(app)/group/[id]', params: { id: g.id } })}
              activeOpacity={0.75}
            >
              <View style={styles.groupAvatar}>
                <Ionicons name="people" size={20} color={colors.accent} />
              </View>
              <View style={styles.groupBody}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  {g.isAdmin && <View style={styles.adminBadge}><Text style={styles.adminText}>Admin</Text></View>}
                </View>
                <Text style={styles.groupMeta}>
                  {g.memberCount} {g.memberCount === 1 ? 'membro' : 'membros'}
                  {g.sport ? ` · ${SPORT_LABEL[g.sport] ?? g.sport}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          {groups.length === 0 && (
            <Text style={styles.empty}>Você não participa de nenhum grupo ainda.</Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {connections.favorites.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>⭐  FAVORITOS</Text>
              {connections.favorites.map(c => <ConnCard key={c.id} conn={{ ...c, isFavorite: true }} onRefresh={loadConnections} />)}
            </>
          )}
          {recentOnly.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>🔗  COM QUEM VOCÊ JOGOU</Text>
              {recentOnly.map(c => <ConnCard key={c.id} conn={c} onRefresh={loadConnections} />)}
            </>
          )}
          {connections.favorites.length === 0 && recentOnly.length === 0 && (
            <Text style={styles.empty}>Suas conexões aparecerão aqui depois de jogar com alguém.</Text>
          )}
        </ScrollView>
      )}

      {/* Modal criar grupo */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo grupo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do grupo"
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={styles.inputLabel}>Esporte (opcional)</Text>
            <View style={styles.sportRow}>
              {(['padel', 'beach_tennis', 'tennis'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, newSport === s && { backgroundColor: SPORT_COLOR[s], borderColor: SPORT_COLOR[s] }]}
                  onPress={() => setNewSport(newSport === s ? null : s)}
                >
                  <Text style={[styles.sportChipText, newSport === s && { color: '#fff' }]}>{SPORT_LABEL[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); setNewName(''); setNewSport(null) }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!newName.trim() || creating) && { opacity: 0.4 }]}
                onPress={createGroup}
                disabled={!newName.trim() || creating}
              >
                {creating
                  ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  : <Text style={styles.confirmText}>Criar grupo</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function ConnCard({ conn, onRefresh }: { conn: Connection; onRefresh: () => void }) {
  const initials = conn.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <View style={styles.connCard}>
      <View style={styles.connAvatar}>
        <Text style={styles.connAvatarText}>{initials}</Text>
      </View>
      <View style={styles.connBody}>
        <Text style={styles.connName}>{conn.name}</Text>
        <View style={styles.sportTagsRow}>
          {conn.sportProfiles.map((p, i) => (
            <View key={i} style={[styles.sportTag, { backgroundColor: `${SPORT_COLOR[p.sport] ?? colors.textMuted}22` }]}>
              <Text style={[styles.sportTagText, { color: SPORT_COLOR[p.sport] ?? colors.textMuted }]}>
                {SPORT_LABEL[p.sport] ?? p.sport}{p.category ? ` · Cat. ${p.category}` : p.skillLevel ? ` · ${p.skillLevel}` : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={onRefresh}>
        <Ionicons
          name={conn.isFavorite ? 'star' : 'star-outline'}
          size={20}
          color={conn.isFavorite ? colors.accent : colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerSub: { fontSize: fontSize.xs, color: colors.textMuted, letterSpacing: 1.5, fontWeight: '700' },
  headerTitle: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, marginTop: 2 },
  headerDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  tabBtn: { paddingHorizontal: spacing.md + 4, paddingVertical: spacing.sm - 1, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  tabText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },

  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  createIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  createText: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: '700' },

  groupCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  groupAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: `${colors.accent}33`, alignItems: 'center', justifyContent: 'center' },
  groupBody: { flex: 1 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupName: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  adminBadge: { backgroundColor: colors.accent, borderRadius: borderRadius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  adminText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.textPrimary },
  groupMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 3 },

  sectionLabel: { fontSize: fontSize.xs, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.2, marginTop: spacing.sm },

  connCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  connAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  connAvatarText: { color: '#fff', fontWeight: '800', fontSize: fontSize.base },
  connBody: { flex: 1 },
  connName: { fontSize: fontSize.base, fontWeight: '700', color: colors.textPrimary },
  sportTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  sportTag: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  sportTagText: { fontSize: fontSize.xs, fontWeight: '700' },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl, fontSize: fontSize.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,26,46,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'], padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: fontSize['2xl'], fontWeight: '900', color: colors.textPrimary },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: fontSize.base, color: colors.textPrimary, backgroundColor: colors.background },
  inputLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '700' },
  sportRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sportChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  sportChipText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  confirmBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  confirmText: { color: colors.textOnPrimary, fontWeight: '800' },
})
