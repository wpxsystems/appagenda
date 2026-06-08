import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPost } from '../../lib/api'
import { Screen, colors as C, fonts as F } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { sportColors, sportLabels } from '@racket-app/ui'

interface Cidade { id: string; nome: string; estado: string }

interface GameParticipant {
  id: string
  nome: string
  avatar_url: string | null
}

interface Game {
  id: string
  sport: string
  scheduled_at: string
  duration_minutes: number
  vacancies_total: number
  status: string
  court_reserved: boolean
  court_price_per_person: number | null
  target_categories: string[] | null
  target_category: string | null
  target_skill_level: string | null
  notes: string | null
  venue_nome: string | null
  venue_endereco: string | null
  creator_id: string
  participant_count: number
  open_spots: number
  participants: GameParticipant[]
}

const FILTERS = [
  { key: 'all',         label: 'Todos' },
  { key: 'padel',       label: 'Padel' },
  { key: 'beach_tennis',label: 'Beach' },
  { key: 'tennis',      label: 'Tênis' },
] as const

const AVATAR_COLORS = ['#2E6F9E','#D4880A','#B03A2E','#5B7A4C','#8A5A9E','#C2607F','#3A7A6E','#A0622A']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const SPORT_EMOJIS: Record<string, string> = {
  padel: '🎾', beach_tennis: '🏖️', tennis: '🎾',
}
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}
function initials(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDay(dt: string) {
  const d = new Date(dt), today = new Date()
  const tom = new Date(today); tom.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === tom.toDateString()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function GameCard({ g, onJoin, onView, isOwn }: {
  g: Game
  onJoin: () => void
  onView: () => void
  isOwn: boolean
}) {
  const color = sportColors[g.sport as keyof typeof sportColors] ?? '#888'
  const label = sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport
  const isFull = g.open_spots <= 0
  const isUrgent = g.open_spots === 1

  const spotsLabel = isFull
    ? 'Completo'
    : isUrgent
    ? 'falta 1 vaga'
    : `faltam ${g.open_spots} vagas`

  const spotsColor = isFull ? C.success : isUrgent ? C.coral : C.inkSoft

  return (
    <TouchableOpacity onPress={onView} activeOpacity={0.88} style={s.card}>
      <View style={[s.cardAccent, { backgroundColor: color }]} />
      <View style={s.cardInner}>
      {/* topo: esporte + vagas */}
      <View style={s.cardTopRow}>
        <View style={s.cardTopLeft}>
          <View style={[s.sportChip, { backgroundColor: `${color}20` }]}>
            <Text style={[s.sportChipText, { color }]}>{label.toUpperCase()}</Text>
          </View>
          <View style={s.categoryChip}>
            <Text style={s.categoryChipText}>
              {(g.target_categories?.length ?? 0) > 0
                ? g.target_categories!.map((c: string) => c === 'Open' ? 'Open' : `Cat. ${c}`).join(' · ')
                : g.target_category ? `Cat. ${g.target_category}` : 'Livre'}
            </Text>
          </View>
        </View>
        <View style={[s.spotsBadge, {
          backgroundColor: isFull ? `${C.success}18` : isUrgent ? `${C.coral}15` : `${C.inkSoft}18`,
          borderColor: isFull ? `${C.success}40` : isUrgent ? `${C.coral}40` : C.line,
        }]}>
          <Text style={[s.spotsText, { color: spotsColor }]}>{spotsLabel}</Text>
        </View>
      </View>

      {/* horário */}
      <View style={s.cardTimeRow}>
        <Text style={s.cardTime}>{formatTime(g.scheduled_at)}</Text>
        <Text style={s.cardDateText}> · {formatDay(g.scheduled_at)}</Text>
      </View>

      {/* quadra + reservada */}
      <View style={s.cardVenueRow}>
        <Text style={s.cardVenueText} numberOfLines={1}>
          {g.venue_nome ?? 'Quadra a definir'}
        </Text>
        {g.court_reserved ? (
          <View style={s.reservedBadge}>
            <Ionicons name="checkmark-circle" size={11} color="#2E7D6E" />
            <Text style={s.reservedText}>Reservada</Text>
            {g.court_price_per_person ? (
              <Text style={s.priceText}>
                · R$ {g.court_price_per_person.toFixed(2).replace('.', ',')}/pessoa
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* linha inferior: só renderiza se há participantes reais ou botão entrar */}
      {((g.participants ?? []).length > 0 || (!isOwn && !isFull)) ? (
        <View style={s.cardBottom}>
          {!isOwn && !isFull ? (
            <TouchableOpacity
              onPress={e => { e.stopPropagation?.(); onJoin() }}
              activeOpacity={0.85}
              style={s.joinBtn}
            >
              <Text style={s.joinBtnText}>Entrar</Text>
            </TouchableOpacity>
          ) : null}

          <View style={s.avatarStack}>
            {(g.participants ?? []).slice(0, 5).map((p, i) => (
              p.avatar_url ? (
                <Image
                  key={p.id}
                  source={{ uri: p.avatar_url }}
                  style={[s.miniAvatar, { marginLeft: i > 0 ? -8 : 0 }]}
                />
              ) : (
                <View key={p.id} style={[s.miniAvatar, { backgroundColor: avatarColor(p.id), marginLeft: i > 0 ? -8 : 0 }]}>
                  <Text style={s.miniAvatarInitials}>{initials(p.nome)}</Text>
                </View>
              )
            ))}
          </View>
        </View>
      ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function DescobrirScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [allGames, setAllGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [cidadeId, setCidadeId] = useState<string | null>(null)
  const [cidadeNome, setCidadeNome] = useState<string>('')
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [cidadeModal, setCidadeModal] = useState(false)
  const [mySports, setMySports] = useState<string[]>([])

  useEffect(() => {
    apiGet<Cidade[]>('/cidades').then(setCidades).catch(() => {})
    apiGet<{ cidade_id?: string }>('/me/location')
      .then(r => { if (r.cidade_id) setCidadeId(r.cidade_id) })
      .catch(() =>
        apiGet<{ cidade_id?: string }>('/me')
          .then(me => { if (me.cidade_id) setCidadeId(me.cidade_id) })
          .catch(() => {})
      )
    apiGet<{ sport: string }[]>('/me/sport-profiles')
      .then(profiles => setMySports(profiles.map(p => p.sport)))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      const qs = cidadeId ? `?cidade_id=${cidadeId}` : ''
      setAllGames(await apiGet<Game[]>(`/jogos${qs}`))
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [cidadeId])

  useEffect(() => { setLoading(true); load() }, [load])

  // Sincroniza nome da cidade ao mudar cidadeId ou lista de cidades
  useEffect(() => {
    if (!cidadeId || cidades.length === 0) return
    const found = cidades.find(c => c.id === cidadeId)
    if (found) setCidadeNome(`${found.nome}, ${found.estado}`)
  }, [cidadeId, cidades])

  const games = sportFilter === 'all'
    ? allGames
    : allGames.filter(g => g.sport === sportFilter)

  const counts: Record<string, number> = {
    all: allGames.length,
    padel: allGames.filter(g => g.sport === 'padel').length,
    beach_tennis: allGames.filter(g => g.sport === 'beach_tennis').length,
    tennis: allGames.filter(g => g.sport === 'tennis').length,
  }

  async function joinGame(id: string) {
    const game = allGames.find((g: Game) => g.id === id)
    if (game && !mySports.includes(game.sport)) {
      const sportLabel = sportLabels[game.sport as keyof typeof sportLabels] ?? game.sport
      showConfirm({
        title: 'Esporte não está no seu perfil',
        message: `Você não tem ${sportLabel} cadastrado no seu perfil. Quer cadastrar agora?`,
        confirmLabel: 'Cadastrar Esporte',
        onConfirm: () => router.push(`/(app)/perfil?sport=${game.sport}` as never),
      })
      return
    }
    setJoiningId(id)
    try {
      await apiPost(`/jogos/${id}/join`)
      showToast({ type: 'success', title: 'Você entrou no jogo!' })
      load()
    } catch (e: unknown) {
      showToast({ type: 'error', title: (e as { message?: string }).message ?? 'Erro ao entrar' })
    } finally {
      setJoiningId(null)
    }
  }

  const { showToast, showConfirm } = useToast()
  const totalOpenSpots = allGames.reduce((acc, g) => acc + g.open_spots, 0)
  const todayGames = allGames.filter(g => {
    const d = new Date(g.scheduled_at); const t = new Date()
    return d.toDateString() === t.toDateString()
  })
  const firstName = user?.name?.split(' ')[0] ?? ''
  const activeSportLabel = FILTERS.find(f => f.key === sportFilter)?.label ?? ''

  return (
    <Screen>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{greeting()}{firstName ? `, ${firstName}` : ''} 👋</Text>
          <TouchableOpacity onPress={() => setCidadeModal(true)} activeOpacity={0.7} style={s.locationRow}>
            <Ionicons name="location-outline" size={13} color={C.inkSoft} />
            <Text style={s.locationText} numberOfLines={1}>{cidadeNome || 'Selecionar cidade'}</Text>
            <Ionicons name="chevron-down" size={11} color={C.inkSoft} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(app)/criar' as never)} style={s.createBtn}>
          <Ionicons name="add" size={15} color={C.ink} />
          <Text style={s.createBtnText}>Criar Jogo</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar — só aparece quando há jogos */}
      {!loading && allGames.length > 0 ? (
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{allGames.length}</Text>
            <Text style={s.statLabel}>jogo{allGames.length > 1 ? 's' : ''} aberto{allGames.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{totalOpenSpots}</Text>
            <Text style={s.statLabel}>vaga{totalOpenSpots !== 1 ? 's' : ''} disponível{totalOpenSpots !== 1 ? 'is' : ''}</Text>
          </View>
          {todayGames.length > 0 ? (
            <>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statNum, { color: C.coral }]}>{todayGames.length}</Text>
                <Text style={s.statLabel}>hoje</Text>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Filter bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterScroll}>
        {FILTERS.map(f => {
          const active = sportFilter === f.key
          const count = counts[f.key] ?? 0
          return (
            <TouchableOpacity key={f.key} onPress={() => setSportFilter(f.key)} activeOpacity={0.8}
              style={[s.filterPill, active && s.filterPillActive]}>
              <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                {f.label}
                {count > 0 ? <Text style={[s.filterCount, active && s.filterCountActive]}> ({count})</Text> : null}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Games list */}
      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.ink} />}
        >
          {games.length === 0 ? (
            allGames.length === 0 ? (
              /* Nenhum jogo na cidade */
              <View style={s.emptyWrap}>
                <Text style={s.emptyEmojis}>🎾 🏖️ 🏸</Text>
                <Text style={s.emptyTitle}>Nenhum jogo em {cidadeNome || 'sua cidade'}</Text>
                <Text style={s.emptySub}>
                  Seja o pioneiro! Crie o primeiro jogo e convide seus parceiros.
                </Text>
                <TouchableOpacity onPress={() => router.push('/(app)/criar' as never)} activeOpacity={0.85} style={s.emptyPrimaryBtn}>
                  <Ionicons name="add-circle-outline" size={18} color={C.ink} />
                  <Text style={s.emptyPrimaryBtnText}>Criar o primeiro jogo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCidadeModal(true)} activeOpacity={0.7} style={s.emptySecondaryBtn}>
                  <Text style={s.emptySecondaryBtnText}>Mudar cidade</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Há jogos mas o filtro de esporte está vazio */
              <View style={s.emptyWrap}>
                <Text style={s.emptyEmojis}>{SPORT_EMOJIS[sportFilter] ?? '🎾'}</Text>
                <Text style={s.emptyTitle}>Nenhum jogo de {activeSportLabel}</Text>
                <Text style={s.emptySub}>Não encontrou o que queria? Crie um jogo para este esporte.</Text>
                <TouchableOpacity onPress={() => router.push('/(app)/criar' as never)} activeOpacity={0.85} style={s.emptyPrimaryBtn}>
                  <Text style={s.emptyPrimaryBtnText}>Criar jogo de {activeSportLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSportFilter('all')} activeOpacity={0.7} style={s.emptySecondaryBtn}>
                  <Text style={s.emptySecondaryBtnText}>Ver todos os esportes</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <>
              {games.map(g => (
                <GameCard
                  key={g.id}
                  g={g}
                  isOwn={g.creator_id === user?.id}
                  onView={() => router.push(`/(app)/jogo/${g.id}` as never)}
                  onJoin={() => joiningId === null ? joinGame(g.id) : undefined}
                />
              ))}

              {/* Prompt de criação ao final da lista */}
              <TouchableOpacity onPress={() => router.push('/(app)/criar' as never)} activeOpacity={0.85} style={s.createPrompt}>
                <View style={s.createPromptIcon}>
                  <Ionicons name="add" size={20} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.createPromptTitle}>Não encontrou o jogo ideal?</Text>
                  <Text style={s.createPromptSub}>Crie o seu e convide parceiros</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* Modal seleção de cidade */}
      <Modal
        visible={cidadeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCidadeModal(false)}
      >
        <View style={s.modalWrap}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Escolher cidade</Text>
            <TouchableOpacity onPress={() => setCidadeModal(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={cidades}
            keyExtractor={c => c.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.line }} />}
            renderItem={({ item }) => {
              const selected = item.id === cidadeId
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={s.cidadeItem}
                  onPress={() => {
                    setCidadeId(item.id)
                    setCidadeModal(false)
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cidadeNome, selected && { color: C.ink }]}>{item.nome}</Text>
                    <Text style={s.cidadeEstado}>{item.estado}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={C.lime} />}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>
    </Screen>
  )
}

const s = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  greeting: { fontFamily: F.headingBold, fontSize: 18, color: C.ink, letterSpacing: -0.3, marginBottom: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
  locationText: { fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi },

  // Stats bar
  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.line,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: F.headingBold, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  statLabel: { fontSize: 10, fontFamily: F.bodySemi, color: C.inkSoft, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: C.line },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.lime, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: '#6B8800', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  createBtnText: {
    fontSize: 13, fontFamily: F.bodyBold, color: C.ink,
  },

  // Filters
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  filterPillActive: {
    backgroundColor: C.ink, borderColor: C.ink,
  },
  filterPillText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },
  filterPillTextActive: { color: C.cream },
  filterCount: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },
  filterCountActive: { color: `${C.cream}CC` },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },

  // Card
  card: {
    flexDirection: 'row', borderRadius: 20, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line, overflow: 'hidden',
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardAccent: { width: 4 },
  cardInner: { flex: 1, padding: 12 },

  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sportChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sportChipText: { fontSize: 10, fontFamily: F.bodyBold, letterSpacing: 0.8 },
  categoryChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: C.cream, borderWidth: 1, borderColor: C.line,
  },
  categoryChipText: { fontSize: 10, fontFamily: F.bodySemi, color: C.inkSoft },

  cardTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
  cardTime: { fontFamily: F.headingBold, fontSize: 24, color: C.ink, letterSpacing: -0.5 },
  cardDateText: { fontSize: 14, color: C.inkSoft, fontFamily: F.bodySemi },

  cardVenueRow: { gap: 3, marginBottom: 8 },
  cardVenueText: { fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi },
  reservedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reservedText: { fontSize: 11, fontFamily: F.bodyBold, color: '#2E7D6E' },
  priceText: { fontSize: 11, fontFamily: F.bodySemi, color: '#2E7D6E' },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  miniAvatarInitials: { fontSize: 10, fontFamily: F.bodyBold, color: '#fff' },
  miniAvatarEmpty: {
    backgroundColor: 'transparent', borderStyle: 'dashed',
    borderColor: C.line, borderWidth: 1.5,
  },
  spotsBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  spotsText: { fontSize: 11, fontFamily: F.headingBold, letterSpacing: 0.2 },

  joinBtn: {
    backgroundColor: C.lime, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: C.lime, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  joinBtnText: { fontFamily: F.bodyBold, fontSize: 13, color: C.ink },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 10 },
  emptyEmojis: { fontSize: 40, letterSpacing: 8, marginBottom: 4 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptySub: { fontSize: 14, color: C.inkSoft, fontFamily: F.body, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  emptyPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.lime, borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 13,
    shadowColor: '#6B8800', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  emptyPrimaryBtnText: { fontFamily: F.bodyBold, fontSize: 15, color: C.ink },
  emptySecondaryBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  emptySecondaryBtnText: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },

  // Prompt de criação ao final da lista
  createPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line,
    marginTop: 4,
  },
  createPromptIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
  },
  createPromptTitle: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  createPromptSub: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 2 },

  // Modal cidade
  modalWrap: { flex: 1, backgroundColor: C.cream },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  modalTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  cidadeItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, gap: 12,
  },
  cidadeNome: { fontSize: 15, fontFamily: F.bodyBold, color: C.inkSoft },
  cidadeEstado: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 1 },
})
