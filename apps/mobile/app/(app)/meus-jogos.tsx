import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, FlatList, RefreshControl } from 'react-native'
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPost } from '../../lib/api'
import { useToast } from '../../components/Toast'
import { Avatar, Btn, Pill, Screen, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

interface MyGame {
  id: string
  sport: string
  scheduled_at: string
  duration_minutes: number
  vacancies_total: number
  participant_count: number
  status: string
  court_reserved: boolean
  venue_nome: string | null
  venue_endereco: string | null
  creator_id: string
  is_creator: boolean
  has_rated: boolean
}

interface Participant {
  id: string
  nome: string
  avatar_url: string | null
}

const BADGES = [
  { key: 'pontual',      label: 'Pontual',                     icon: '⏰' },
  { key: 'respeitoso',   label: 'Respeitoso',                  icon: '🤝' },
  { key: 'simpatico',    label: 'Simpático',                   icon: '😄' },
  { key: 'competitivo',  label: 'Competitivo na medida certa', icon: '🔥' },
  { key: 'comprometido', label: 'Comprometido',                icon: '🎯' },
  { key: 'comunicativo', label: 'Comunicativo',                icon: '💬' },
  { key: 'esportivo',    label: 'Esportivo',                   icon: '🏅' },
  { key: 'parceiro',     label: 'Ótimo parceiro de dupla',     icon: '👥' },
  { key: 'energia',      label: 'Energia positiva',            icon: '⚡' },
  { key: 'jogaria',      label: 'Jogaria novamente',           icon: '⭐' },
] as const

type BadgeKey = typeof BADGES[number]['key']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dt: string) {
  const d = new Date(dt)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tom = new Date(today); tom.setDate(tom.getDate() + 1)
  const game = new Date(d); game.setHours(0, 0, 0, 0)
  if (game.getTime() === today.getTime()) return 'Hoje'
  if (game.getTime() === tom.getTime()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── RatingModal ───────────────────────────────────────────────────────────────

interface PlayerRating {
  score: number
  badges: BadgeKey[]
}

function StarRow({ score, onChange }: { score: number; onChange: (s: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6} activeOpacity={0.7}>
          <Ionicons
            name={n <= score ? 'star' : 'star-outline'}
            size={26}
            color={n <= score ? '#F5A623' : C.line}
          />
        </TouchableOpacity>
      ))}
    </View>
  )
}

function RatingModal({ visible, jogoId, userId, onClose, onDone }: {
  visible: boolean
  jogoId: string
  userId: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loadingParts, setLoadingParts] = useState(false)
  const [ratings, setRatings] = useState<Record<string, PlayerRating>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoadingParts(true)
    setRatings({})
    apiGet<{ participacoes: Array<{ user_id: string; user: { id: string; nome: string; avatar_url: string | null } }> }>(`/jogos/${jogoId}`)
      .then(data => {
        const others = data.participacoes
          .filter(p => p.user_id !== userId)
          .map(p => ({ id: p.user.id, nome: p.user.nome, avatar_url: p.user.avatar_url }))
        setParticipants(others)
        const init: Record<string, PlayerRating> = {}
        others.forEach(p => { init[p.id] = { score: 0, badges: [] } })
        setRatings(init)
      })
      .catch(() => {})
      .finally(() => setLoadingParts(false))
  }, [visible, jogoId, userId])

  function setScore(playerId: string, score: number) {
    setRatings(prev => ({ ...prev, [playerId]: { ...prev[playerId], score } }))
  }

  function toggleBadge(playerId: string, badge: BadgeKey) {
    setRatings(prev => {
      const cur = prev[playerId]?.badges ?? []
      const has = cur.includes(badge)
      const next = has ? cur.filter(b => b !== badge) : cur.length < 3 ? [...cur, badge] : cur
      return { ...prev, [playerId]: { ...prev[playerId], badges: next } }
    })
  }

  async function submit() {
    const entries = participants
      .map(p => ({ rated_user_id: p.id, score: ratings[p.id]?.score ?? 0, badges: ratings[p.id]?.badges ?? [] }))
      .filter(e => e.score > 0)

    if (entries.length === 0) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      await apiPost(`/jogos/${jogoId}/ratings`, { ratings: entries })
      showToast({ type: 'success', title: 'Avaliações enviadas!' })
      onDone()
    } catch (e: unknown) {
      showToast({ type: 'error', title: 'Erro ao enviar', message: (e as { message?: string })?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.cream }}>
        <View style={rm.header}>
          <Text style={rm.title}>Avaliar jogadores</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={C.inkSoft} />
          </TouchableOpacity>
        </View>

        {loadingParts ? (
          <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
        ) : participants.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Text style={{ fontFamily: F.body, color: C.inkSoft, fontSize: 14, textAlign: 'center' }}>
              Nenhum outro jogador para avaliar neste jogo.
            </Text>
            <View style={{ marginTop: 20 }}>
              <Btn onPress={onClose}>Fechar</Btn>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={participants}
              keyExtractor={p => p.id}
              contentContainerStyle={{ padding: 16, gap: 16 }}
              renderItem={({ item: p }) => {
                const r = ratings[p.id] ?? { score: 0, badges: [] }
                return (
                  <View style={rm.playerCard}>
                    <View style={rm.playerHeader}>
                      <Avatar name={p.nome} size={44} imageUrl={p.avatar_url ?? undefined} />
                      <Text style={rm.playerName}>{p.nome}</Text>
                    </View>

                    <Text style={rm.sectionLabel}>Nota</Text>
                    <StarRow score={r.score} onChange={v => setScore(p.id, v)} />

                    <Text style={[rm.sectionLabel, { marginTop: 14 }]}>
                      Categorias <Text style={{ color: C.inkSoft, fontFamily: F.body }}>(até 3)</Text>
                    </Text>
                    <View style={rm.badgesWrap}>
                      {BADGES.map(b => {
                        const selected = r.badges.includes(b.key)
                        const disabled = !selected && r.badges.length >= 3
                        return (
                          <TouchableOpacity
                            key={b.key}
                            onPress={() => !disabled && toggleBadge(p.id, b.key)}
                            activeOpacity={disabled ? 1 : 0.75}
                            style={[
                              rm.badge,
                              selected && rm.badgeSelected,
                              disabled && { opacity: 0.35 },
                            ]}
                          >
                            <Text style={rm.badgeIcon}>{b.icon}</Text>
                            <Text style={[rm.badgeLabel, selected && { color: C.ink }]}>{b.label}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                )
              }}
            />
            <View style={rm.footer}>
              <Btn fullWidth onPress={submit} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar avaliações'}
              </Btn>
              <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft }}>Pular</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

// ── GameCard ──────────────────────────────────────────────────────────────────

function GameCard({ g, onPress, onConfirm, onRate, confirming }: {
  g: MyGame
  onPress: () => void
  onConfirm?: () => void
  onRate?: () => void
  confirming?: boolean
}) {
  const color = sportColors[g.sport as keyof typeof sportColors] ?? '#888'
  const label = sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport
  const isCancelled = g.status === 'cancelled'
  const isCompleted = g.status === 'completed'
  const isPast = isCancelled || isCompleted || new Date(g.scheduled_at) < new Date()
  const canConfirm = g.is_creator && !isCancelled && !isCompleted && new Date(g.scheduled_at) < new Date()
  const canRate = isCompleted && !g.has_rated

  const statusText = isCancelled
    ? 'Cancelado'
    : isCompleted
    ? 'Confirmado'
    : isPast && canConfirm
    ? 'Confirmar?'
    : isPast
    ? 'Encerrado'
    : 'Em aberto'
  const statusColor = isCompleted ? C.success : isPast && canConfirm ? C.coral : C.inkSoft

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, { opacity: isPast && !isCompleted ? 0.72 : 1 }]}>
      <View style={[s.cardBar, { backgroundColor: isCompleted ? C.success : isPast ? '#C0BDB4' : color }]} />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={s.cardTop}>
          <View style={s.cardChips}>
            <View style={[s.sportChip, { backgroundColor: isPast ? C.line : `${color}18` }]}>
              <Text style={[s.sportChipText, { color: isPast ? C.inkSoft : color }]}>{label}</Text>
            </View>
            {g.is_creator ? (
              <View style={[s.orgChip, { backgroundColor: isPast ? C.line : 'rgba(203,241,53,0.33)' }]}>
                <Ionicons name="flash" size={10} color={isPast ? C.inkSoft : C.ink} />
                <Text style={[s.orgChipText, { color: isPast ? C.inkSoft : C.ink }]}>Org.</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        <View style={s.cardTimeRow}>
          <Text style={[s.cardTime, { color: isPast ? C.inkSoft : C.ink }]}>{formatTime(g.scheduled_at)}</Text>
          <Text style={s.cardDate}>· {formatDate(g.scheduled_at)}</Text>
        </View>

        <View style={s.cardVenueRow}>
          {g.venue_nome ? (
            <Text style={s.cardVenue} numberOfLines={1}>{g.venue_nome}</Text>
          ) : !g.court_reserved ? (
            <Text style={s.cardVenue}>Quadra a definir</Text>
          ) : null}
          {g.court_reserved ? (
            <View style={s.resBadge}>
              <Ionicons name="checkmark-circle" size={11} color="#2E7D6E" />
              <Text style={s.resBadgeText}>Reservada</Text>
              {g.venue_nome ? null : null}
            </View>
          ) : null}
        </View>

        <View style={s.cardBottomRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color={C.inkSoft} />
            <Text style={s.cardMeta}>
              {g.participant_count ?? 1}/{g.vacancies_total} jogadores
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={C.inkSoft} />
            <Text style={s.cardMeta}>{g.duration_minutes} min</Text>
          </View>
        </View>

        {canConfirm ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onConfirm?.() }}
            activeOpacity={0.85}
            disabled={confirming}
            style={s.confirmBtn}
          >
            {confirming
              ? <ActivityIndicator size={12} color={C.ink} />
              : <Ionicons name="checkmark-circle-outline" size={14} color={C.ink} />
            }
            <Text style={s.confirmBtnText}>{confirming ? 'Confirmando…' : 'Confirmar realização'}</Text>
          </TouchableOpacity>
        ) : null}

        {canRate ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onRate?.() }}
            activeOpacity={0.85}
            style={s.rateBtn}
          >
            <Ionicons name="star-outline" size={14} color={C.ink} />
            <Text style={s.rateBtnText}>Avaliar jogadores</Text>
          </TouchableOpacity>
        ) : isCompleted && g.has_rated ? (
          <View style={s.ratedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={C.success} />
            <Text style={s.ratedBadgeText}>Avaliado</Text>
          </View>
        ) : null}
      </View>

      {!canConfirm && !canRate ? (
        <View style={s.chevron}>
          <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MeusJogosScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { showConfirm, showToast } = useToast()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [myGames, setMyGames] = useState<MyGame[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'proximos' | 'passados'>(
    params.tab === 'passados' ? 'passados' : 'proximos'
  )
  const [confirming, setConfirming] = useState<string | null>(null)
  const [ratingGameId, setRatingGameId] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const games = await apiGet<MyGame[]>('/me/jogos')
      setMyGames(games)
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  function handleConfirm(jogoId: string) {
    showConfirm({
      title: 'Confirmar realização',
      message: 'O jogo realmente ocorreu? As estatísticas de todos os participantes serão atualizadas.',
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        setConfirming(jogoId)
        try {
          await apiPost(`/jogos/${jogoId}/confirm`, {})
          setMyGames(prev => prev.map(g => g.id === jogoId ? { ...g, status: 'completed' } : g))
          showToast({ type: 'success', title: 'Jogo confirmado!', message: 'Estatísticas atualizadas.' })
          setTimeout(() => setRatingGameId(jogoId), 400)
        } catch (e: unknown) {
          showToast({ type: 'error', title: 'Erro ao confirmar', message: (e as { message?: string })?.message })
        } finally {
          setConfirming(null)
        }
      },
    })
  }

  const now = new Date()
  const proximos = myGames.filter(g => g.status !== 'cancelled' && g.status !== 'completed' && new Date(g.scheduled_at) >= now)
  const passados = myGames.filter(g => g.status === 'cancelled' || g.status === 'completed' || new Date(g.scheduled_at) < now).reverse()
  const list = tab === 'proximos' ? proximos : passados

  return (
    <Screen>
      <View style={s.headerWrap}>
        <Text style={s.title}>Meus jogos</Text>

        <View style={s.tabRow}>
          <Pill label="Próximos" active={tab === 'proximos'} onPress={() => setTab('proximos')} count={proximos.length} />
          <Pill label="Histórico" active={tab === 'passados'} onPress={() => setTab('passados')} count={passados.length} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true) }}
              tintColor={C.ink}
            />
          }
        >
          {list.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{tab === 'proximos' ? '🎾' : '📋'}</Text>
              <Text style={s.emptyTitle}>
                {tab === 'proximos' ? 'Nenhum jogo próximo' : 'Sem histórico ainda'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'proximos'
                  ? 'Crie um jogo ou entre em um disponível'
                  : 'Seus jogos finalizados aparecerão aqui'}
              </Text>
              {tab === 'proximos' ? (
                <View style={{ marginTop: 16, gap: 10 }}>
                  <Btn onPress={() => router.push('/criar' as never)}>Criar jogo</Btn>
                  <Btn variant="ghost" onPress={() => router.push('/(app)/' as never)}>Descobrir jogos</Btn>
                </View>
              ) : null}
            </View>
          ) : (
            list.map(g => (
              <GameCard
                key={g.id}
                g={g}
                onPress={() => router.push(`/(app)/jogo/${g.id}?fromTab=${tab}` as never)}
                onConfirm={() => handleConfirm(g.id)}
                onRate={() => setRatingGameId(g.id)}
                confirming={confirming === g.id}
              />
            ))
          )}
        </ScrollView>
      )}

      {ratingGameId ? (
        <RatingModal
          visible={!!ratingGameId}
          jogoId={ratingGameId}
          userId={user?.id ?? ''}
          onClose={() => setRatingGameId(null)}
          onDone={() => {
            setMyGames(prev => prev.map(g => g.id === ratingGameId ? { ...g, has_rated: true } : g))
            setRatingGameId(null)
          }}
        />
      ) : null}
    </Screen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  headerWrap: { padding: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, letterSpacing: 3 },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },

  scroll: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', borderRadius: 20, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    marginBottom: 10,
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  cardBar: { width: 7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardChips: { flexDirection: 'row', gap: 6 },
  sportChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sportChipText: { fontSize: 11, fontFamily: F.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  orgChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  orgChipText: { fontSize: 10, fontFamily: F.bodyBold },
  statusText: { fontSize: 11, fontFamily: F.bodyBold },

  cardTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
  cardTime: { fontFamily: F.headingBold, fontSize: 24, letterSpacing: -0.5 },
  cardDate: { fontSize: 14, color: C.inkSoft, fontFamily: F.bodySemi },

  cardVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  cardVenue: { fontSize: 15, fontFamily: F.bodySemi, color: C.inkSoft },
  resBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resBadgeText: { fontSize: 14, fontFamily: F.bodyBold, color: '#2E7D6E' },

  cardBottomRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cardMeta: { fontSize: 11, color: C.inkSoft, fontFamily: F.body },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.lime, borderRadius: 12, alignSelf: 'flex-start',
  },
  confirmBtnText: { fontSize: 12, fontFamily: F.bodyBold, color: C.ink },

  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: C.cream, borderRadius: 12, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: C.line,
  },
  rateBtnText: { fontSize: 12, fontFamily: F.bodyBold, color: C.ink },

  ratedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
  },
  ratedBadgeText: { fontSize: 12, fontFamily: F.bodySemi, color: C.success },

  chevron: { alignItems: 'center', justifyContent: 'center', paddingRight: 12 },

  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 17, color: C.ink },
  emptySub: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, marginTop: 6, lineHeight: 20, textAlign: 'center' },
})

// ── RatingModal styles ────────────────────────────────────────────────────────

const rm = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  title: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  playerCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 16,
    borderWidth: 1.5, borderColor: C.line,
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  playerName: { fontFamily: F.bodyBold, fontSize: 16, color: C.ink, flex: 1 },
  sectionLabel: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.cream,
  },
  badgeSelected: { borderColor: C.ink, backgroundColor: 'rgba(203,241,53,0.25)' },
  badgeIcon: { fontSize: 13 },
  badgeLabel: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },
  footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
})
