import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { apiGet, apiPost } from '../../lib/api'
import { Screen, Avatar, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'
import { useToast } from '../../components/Toast'

type Group = {
  id: string; nome: string; sport: string | null
  member_count: number; is_admin: boolean
  last_message: string | null; last_message_at: string | null
}
type SportProfile = { sport: string; category: string | null; skill_level: string | null }
type ApiConnection = {
  id: string; nome: string; avatar_url: string | null
  sport_profiles?: SportProfile[]
}
type Invite = {
  id: string; group_id: string; group_name: string; group_sport: string | null
  inviter_name: string; member_count: number; created_at: string
}

const AVATAR_COLORS = ['#2E6F9E','#D4880A','#B03A2E','#5B7A4C','#8A5A9E','#C2607F','#3A7A6E','#A0622A']
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ComunidadeScreen() {
  const router = useRouter()
  const { showToast } = useToast()

  const [tab, setTab] = useState<'grupos' | 'conexoes' | 'convites'>('grupos')
  const [groups, setGroups] = useState<Group[]>([])
  const [connections, setConnections] = useState<{ recent: ApiConnection[]; favorites: ApiConnection[] }>({ recent: [], favorites: [] })
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSport, setNewSport] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try { setGroups(await apiGet<Group[]>('/community/groups')) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  const loadConnections = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await apiGet<{ recent_players: ApiConnection[]; favorites: ApiConnection[] }>('/community/favorites')
      setConnections({ recent: raw.recent_players ?? [], favorites: raw.favorites ?? [] })
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  const loadInvites = useCallback(async () => {
    setLoading(true)
    try { setInvites(await apiGet<Invite[]>('/community/invites')) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'grupos') loadGroups()
    else if (tab === 'conexoes') loadConnections()
    else loadInvites()
  }, [tab])

  async function createGroup() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const g = await apiPost<Group>('/community/groups', { nome: newName.trim(), sport: newSport })
      setGroups(prev => [g, ...prev])
      setShowCreate(false); setNewName(''); setNewSport(null)
      showToast({ type: 'success', title: 'Grupo criado!' })
    } catch (e: unknown) {
      showToast({ type: 'error', title: (e as { message?: string }).message ?? 'Erro ao criar grupo' })
    } finally { setCreating(false) }
  }

  async function acceptInvite(id: string) {
    try {
      await apiPost(`/community/invites/${id}/accept`)
      setInvites(prev => prev.filter(i => i.id !== id))
      loadGroups()
      showToast({ type: 'success', title: 'Você entrou no grupo!' })
    } catch (e: unknown) {
      showToast({ type: 'error', title: (e as { message?: string }).message ?? 'Erro' })
    }
  }

  async function declineInvite(id: string) {
    try {
      await apiPost(`/community/invites/${id}/decline`)
      setInvites(prev => prev.filter(i => i.id !== id))
    } catch { /* ignore */ }
  }

  const totalConnections = connections.favorites.length + connections.recent.length

  return (
    <Screen>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Comunidade</Text>
        {tab === 'grupos' ? (
          <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={C.ink} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {([
          ['grupos', 'Grupos', groups.length],
          ['conexoes', 'Conexões', totalConnections],
          ['convites', 'Convites', invites.length],
        ] as const).map(([key, label, count]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} style={s.tabItem} activeOpacity={0.7}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>
              {label}{count > 0 ? ` ${count}` : ''}
            </Text>
            {tab === key ? <View style={s.tabUnderline} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : tab === 'grupos' ? (
        <ScrollView contentContainerStyle={s.scroll}>
          {groups.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={C.line} />
              <Text style={s.emptyTitle}>Nenhum grupo ainda</Text>
              <Text style={s.emptySub}>Crie um grupo para jogar com seus parceiros</Text>
              <TouchableOpacity onPress={() => setShowCreate(true)} style={s.emptyBtn} activeOpacity={0.85}>
                <Ionicons name="add" size={15} color={C.ink} />
                <Text style={s.emptyBtnText}>Criar grupo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            groups.map(g => {
              const color = g.sport ? (sportColors[g.sport as keyof typeof sportColors] ?? C.inkSoft) : C.inkSoft
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } } as never)}
                  activeOpacity={0.85}
                  style={s.groupCard}
                >
                  <View style={[s.groupAvatar, { backgroundColor: `${color}20` }]}>
                    <Ionicons name="people" size={22} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={s.groupName}>{g.nome}</Text>
                      {g.is_admin ? <View style={s.adminBadge}><Text style={s.adminText}>Admin</Text></View> : null}
                    </View>
                    <Text style={s.groupMeta}>
                      {g.member_count} {g.member_count === 1 ? 'membro' : 'membros'}
                      {g.sport ? ` · ${sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport}` : ''}
                    </Text>
                    {g.last_message ? (
                      <Text style={s.groupPreview} numberOfLines={1}>
                        {g.last_message}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {g.last_message_at ? <Text style={s.groupTime}>{timeAgo(g.last_message_at)}</Text> : null}
                    <Ionicons name="chevron-forward" size={14} color={C.line} />
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
      ) : tab === 'conexoes' ? (
        <ScrollView contentContainerStyle={s.scroll}>
          {totalConnections === 0 ? (
            <View style={s.empty}>
              <Ionicons name="person-outline" size={40} color={C.line} />
              <Text style={s.emptyTitle}>Sem conexões ainda</Text>
              <Text style={s.emptySub}>Jogue com alguém para criar conexões</Text>
            </View>
          ) : (
            <>
              {connections.favorites.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>Favoritos</Text>
                  {connections.favorites.map(c => (
                    <View key={c.id} style={s.connRow}>
                      <Avatar name={c.nome} size={44} uri={c.avatar_url} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.connName}>{c.nome}</Text>
                        {c.sport_profiles && c.sport_profiles.length > 0 ? (
                          <View style={s.sportTagsRow}>
                            {c.sport_profiles.map((sp, i) => {
                              const color = sportColors[sp.sport as keyof typeof sportColors] ?? C.inkSoft
                              return (
                                <View key={i} style={[s.sportTag, { backgroundColor: `${color}18` }]}>
                                  <Text style={[s.sportTagText, { color }]}>
                                    {sportLabels[sp.sport as keyof typeof sportLabels] ?? sp.sport}
                                    {sp.category ? ` · Cat. ${sp.category}` : ''}
                                  </Text>
                                </View>
                              )
                            })}
                          </View>
                        ) : null}
                      </View>
                      <Ionicons name="star" size={16} color={C.lime} />
                    </View>
                  ))}
                </>
              ) : null}
              {connections.recent.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>Jogaram com você</Text>
                  {connections.recent.map(c => (
                    <View key={c.id} style={s.connRow}>
                      <Avatar name={c.nome} size={44} uri={c.avatar_url} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.connName}>{c.nome}</Text>
                        {c.sport_profiles && c.sport_profiles.length > 0 ? (
                          <View style={s.sportTagsRow}>
                            {c.sport_profiles.map((sp, i) => {
                              const color = sportColors[sp.sport as keyof typeof sportColors] ?? C.inkSoft
                              return (
                                <View key={i} style={[s.sportTag, { backgroundColor: `${color}18` }]}>
                                  <Text style={[s.sportTagText, { color }]}>
                                    {sportLabels[sp.sport as keyof typeof sportLabels] ?? sp.sport}
                                  </Text>
                                </View>
                              )
                            })}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {invites.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="mail-outline" size={40} color={C.line} />
              <Text style={s.emptyTitle}>Sem convites</Text>
              <Text style={s.emptySub}>Convites de grupos aparecerão aqui</Text>
            </View>
          ) : (
            invites.map(inv => {
              const color = inv.group_sport ? (sportColors[inv.group_sport as keyof typeof sportColors] ?? C.inkSoft) : C.inkSoft
              return (
                <View key={inv.id} style={s.inviteCard}>
                  <View style={[s.groupAvatar, { backgroundColor: `${color}20` }]}>
                    <Ionicons name="people" size={22} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.groupName}>{inv.group_name}</Text>
                    <Text style={s.groupMeta}>
                      {inv.member_count} membros · Convite de {inv.inviter_name}
                    </Text>
                    <View style={s.inviteActions}>
                      <TouchableOpacity onPress={() => acceptInvite(inv.id)} style={s.acceptBtn} activeOpacity={0.85}>
                        <Text style={s.acceptBtnText}>Aceitar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => declineInvite(inv.id)} style={s.declineBtn} activeOpacity={0.8}>
                        <Text style={s.declineBtnText}>Recusar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Create group modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Novo grupo</Text>
            <TouchableOpacity onPress={() => { setShowCreate(false); setNewName(''); setNewSport(null) }} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <TextInput
              style={s.modalInput}
              placeholder="Nome do grupo"
              placeholderTextColor={C.inkSoft}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View>
              <Text style={s.modalSubLabel}>Esporte (opcional)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {(['padel', 'beach_tennis', 'tennis'] as const).map(sp => (
                  <TouchableOpacity
                    key={sp}
                    onPress={() => setNewSport(newSport === sp ? null : sp)}
                    activeOpacity={0.85}
                    style={[s.sportChip, newSport === sp && { backgroundColor: sportColors[sp], borderColor: sportColors[sp] }]}
                  >
                    <Text style={[s.sportChipText, newSport === sp && { color: '#fff' }]}>
                      {sportLabels[sp]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={createGroup}
              disabled={!newName.trim() || creating}
              style={[s.createGroupBtn, (!newName.trim() || creating) && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <Text style={s.createGroupBtnText}>{creating ? 'Criando…' : 'Criar grupo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  tabItem: { marginRight: 24, paddingBottom: 10, position: 'relative' },
  tabText: { fontSize: 15, fontFamily: F.bodyBold, color: C.inkSoft },
  tabTextActive: { color: C.ink },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: C.ink, borderRadius: 999 },

  scroll: { padding: 16, gap: 8, paddingBottom: 32 },

  // Empty
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: F.bodyBold, color: C.ink },
  emptySub: { fontSize: 13, fontFamily: F.bodySemi, color: C.inkSoft, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: C.lime, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
  },
  emptyBtnText: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },

  // Groups
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line,
  },
  groupAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink },
  groupMeta: { fontSize: 12, color: C.inkSoft, fontFamily: F.bodySemi },
  groupPreview: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },
  groupTime: { fontSize: 11, color: C.inkSoft, fontFamily: F.body },
  adminBadge: { backgroundColor: `${C.lime}60`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  adminText: { fontSize: 10, fontFamily: F.bodyBold, color: C.ink },

  // Connections
  sectionLabel: { fontSize: 12, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4, marginBottom: 2 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  connName: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink },
  sportTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  sportTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  sportTagText: { fontSize: 11, fontFamily: F.bodyBold },

  // Invites
  inviteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line,
  },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: { backgroundColor: C.lime, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  acceptBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: C.ink },
  declineBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: C.line },
  declineBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  modalTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  modalInput: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontFamily: F.bodySemi, color: C.ink, backgroundColor: C.card,
  },
  modalSubLabel: { fontSize: 12, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
  sportChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center' },
  sportChipText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },
  createGroupBtn: { backgroundColor: C.ink, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  createGroupBtnText: { fontSize: 15, fontFamily: F.bodyBold, color: C.cream },
})
