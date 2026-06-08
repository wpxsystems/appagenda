import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPost } from '../../lib/api'
import { Btn, Pill, Avatar, Screen, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

type Group = {
  id: string; nome: string; sport: string | null
  member_count: number; is_admin: boolean
  last_message: string | null; last_message_at: string | null
}
type SportProfile = {
  sport: string
  category: string | null
  skill_level: string | null
}
type ApiConnection = {
  id: string
  nome: string
  avatar_url: string | null
  sport_profiles?: SportProfile[]
}
type Invite = {
  id: string; group_id: string; group_name: string; group_sport: string | null
  inviter_name: string; member_count: number; created_at: string
}

function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ConnRow({ c, isFav }: { c: ApiConnection; isFav: boolean }) {
  return (
    <View style={s.connCard}>
      <Avatar name={c.nome} size={42} uri={c.avatar_url} />
      <View style={{ flex: 1 }}>
        <Text style={s.connName}>{c.nome}</Text>
        {c.sport_profiles && c.sport_profiles.length > 0 ? (
          <View style={s.sportTagsRow}>
            {c.sport_profiles.map((sp, i) => {
              const color = sportColors[sp.sport as keyof typeof sportColors] ?? C.inkSoft
              const detail = sp.category ? ` · Cat. ${sp.category}` : sp.skill_level ? ` · ${sp.skill_level}` : ''
              return (
                <View key={i} style={[s.sportTag, { backgroundColor: `${color}1A` }]}>
                  <Text style={[s.sportTagText, { color }]}>
                    {sportLabels[sp.sport as keyof typeof sportLabels] ?? sp.sport}{detail}
                  </Text>
                </View>
              )
            })}
          </View>
        ) : null}
      </View>
      <Ionicons name={isFav ? 'star' : 'star-outline'} size={18} color={isFav ? C.lime : C.inkSoft} />
    </View>
  )
}

export default function ComunidadeScreen() {
  const router = useRouter()
  const { user } = useAuth()

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
  }, [tab, loadGroups, loadConnections, loadInvites])

  async function createGroup() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const g = await apiPost<Group>('/community/groups', { nome: newName.trim(), sport: newSport })
      setGroups(prev => [g, ...prev])
      setShowCreate(false); setNewName(''); setNewSport(null)
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Erro ao criar grupo')
    } finally { setCreating(false) }
  }

  async function acceptInvite(id: string) {
    try {
      await apiPost(`/community/invites/${id}/accept`)
      setInvites(prev => prev.filter(i => i.id !== id))
      loadGroups()
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Erro ao aceitar')
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
      <View style={s.headerWrap}>
        <Text style={s.title}>Comunidade</Text>
        <Text style={s.subtitle}>Conectar pessoas é o nosso propósito</Text>

        <View style={s.tabRow}>
          <Pill label="Grupos" active={tab === 'grupos'} onPress={() => setTab('grupos')} count={groups.length} />
          <Pill label="Conexões" active={tab === 'conexoes'} onPress={() => setTab('conexoes')} count={totalConnections} />
          <Pill label="Convites" active={tab === 'convites'} onPress={() => setTab('convites')} count={invites.length} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 32 }} />
      ) : tab === 'grupos' ? (
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Torneios — em breve */}
          <View style={s.torneioBanner}>
            <View style={s.torneioBannerLeft}>
              <View style={s.torneioIconWrap}>
                <Ionicons name="trophy" size={20} color="#D4880A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.torneioTitle}>Torneios</Text>
                <Text style={s.torneioSub}>Campeonatos e ranqueadas — em breve</Text>
              </View>
            </View>
            <View style={s.torneioBadge}>
              <Text style={s.torneioBadgeText}>Em breve</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.85} style={s.createRow}>
            <View style={s.createIcon}>
              <Ionicons name="add" size={20} color={C.ink} />
            </View>
            <Text style={s.createText}>Criar novo grupo</Text>
          </TouchableOpacity>

          {groups.map(g => {
            const color = g.sport ? sportColors[g.sport as keyof typeof sportColors] : C.inkSoft
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } } as never)}
                activeOpacity={0.85}
                style={s.groupCard}
              >
                <View style={[s.groupAvatar, { backgroundColor: `${color}22` }]}>
                  <Ionicons name="people" size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.groupName}>{g.nome}</Text>
                    {g.is_admin ? (
                      <View style={s.adminBadge}>
                        <Text style={s.adminText}>Admin</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.groupMeta}>
                    {g.member_count} {g.member_count === 1 ? 'membro' : 'membros'}
                    {g.sport ? ` · ${sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
              </TouchableOpacity>
            )
          })}

          {groups.length === 0 ? (
            <Text style={s.empty}>Você não participa de nenhum grupo ainda.</Text>
          ) : null}
        </ScrollView>
      ) : tab === 'conexoes' ? (
        <ScrollView contentContainerStyle={s.scroll}>
          {connections.favorites.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>⭐  FAVORITOS</Text>
              {connections.favorites.map(c => <ConnRow key={c.id} c={c} isFav />)}
            </>
          ) : null}
          {connections.recent.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>🔗  COM QUEM VOCÊ JOGOU</Text>
              {connections.recent.map(c => <ConnRow key={c.id} c={c} isFav={false} />)}
            </>
          ) : null}
          {totalConnections === 0 ? (
            <Text style={s.empty}>Suas conexões aparecerão aqui depois de jogar com alguém.</Text>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {invites.length === 0 ? (
            <Text style={s.empty}>Sem convites pendentes</Text>
          ) : (
            invites.map(inv => {
              const color = inv.group_sport ? sportColors[inv.group_sport as keyof typeof sportColors] : C.inkSoft
              return (
                <View key={inv.id} style={s.inviteCard}>
                  <View style={[s.groupAvatar, { backgroundColor: `${color}22` }]}>
                    <Ionicons name="people" size={20} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.groupName}>{inv.group_name}</Text>
                    <Text style={s.inviteMeta}>
                      Convite de {inv.inviter_name} · {inv.member_count} membros · {timeAgo(inv.created_at)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity onPress={() => acceptInvite(inv.id)} style={s.acceptBtn}>
                        <Text style={s.acceptBtnText}>Aceitar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => declineInvite(inv.id)} style={s.declineBtn}>
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
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Novo grupo</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Nome do grupo"
              placeholderTextColor={C.inkSoft}
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={s.modalSubLabel}>Esporte (opcional)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['padel', 'beach_tennis', 'tennis'] as const).map(sp => (
                <TouchableOpacity
                  key={sp}
                  onPress={() => setNewSport(newSport === sp ? null : sp)}
                  activeOpacity={0.85}
                  style={[
                    s.sportChipModal,
                    newSport === sp ? { backgroundColor: sportColors[sp], borderColor: sportColors[sp] } : null,
                  ]}
                >
                  <Text style={{
                    fontFamily: F.bodyBold, fontSize: 13,
                    color: newSport === sp ? '#fff' : C.inkSoft,
                  }}>{sportLabels[sp]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn variant="ghost" onPress={() => { setShowCreate(false); setNewName(''); setNewSport(null) }} fullWidth>
                Cancelar
              </Btn>
              <Btn onPress={createGroup} disabled={!newName.trim() || creating} fullWidth>
                {creating ? 'Criando…' : 'Criar grupo'}
              </Btn>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  headerWrap: { padding: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, letterSpacing: 3 },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },

  scroll: { padding: 16, gap: 8 },

  torneioBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 18, marginBottom: 8,
    backgroundColor: '#FFF9EC', borderWidth: 1.5, borderColor: '#F5E0A0',
  },
  torneioBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  torneioIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(212,136,10,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  torneioTitle: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  torneioSub: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },
  torneioBadge: {
    backgroundColor: 'rgba(212,136,10,0.15)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  torneioBadgeText: { fontSize: 11, fontFamily: F.bodyBold, color: '#D4880A' },

  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: C.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line,
    borderRadius: 18, marginBottom: 8,
  },
  createIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
  },
  createText: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink },

  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 8,
  },
  groupAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink },
  groupMeta: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 3 },
  adminBadge: { backgroundColor: C.lime, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  adminText: { fontSize: 10, fontFamily: F.bodyBold, color: C.ink },

  sectionLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, letterSpacing: 2,
    marginTop: 12, marginBottom: 4,
  },
  connCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 8,
  },
  connName: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  sportTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  sportTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  sportTagText: { fontSize: 11, fontFamily: F.bodyBold },

  inviteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 8,
  },
  inviteMeta: { fontSize: 12, color: C.inkSoft, fontFamily: F.body },
  acceptBtn: { backgroundColor: C.lime, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  acceptBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: C.ink },
  declineBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: C.line },
  declineBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },

  empty: { textAlign: 'center', color: C.inkSoft, marginTop: 24, fontSize: 13, fontFamily: F.body },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,24,19,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14,
  },
  modalTitle: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },
  modalInput: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: F.body, color: C.ink, backgroundColor: C.card,
  },
  modalSubLabel: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },
  sportChipModal: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card,
  },
})
