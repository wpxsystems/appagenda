import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiGet } from '../../lib/api'
import { Btn, Pill, Screen, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

interface MyGame {
  id: string
  sport: string
  scheduled_at: string
  duration_minutes: number
  vacancies_total: number
  status: string
  court_reserved: boolean
  venue_nome: string | null
  venue_endereco: string | null
  creator_id: string
  is_creator: boolean
}

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

function GameCard({ g, onPress }: { g: MyGame; onPress: () => void }) {
  const color = sportColors[g.sport as keyof typeof sportColors] ?? '#888'
  const label = sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport
  const isCancelled = g.status === 'cancelled'
  const isPast = isCancelled || new Date(g.scheduled_at) < new Date()

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, { opacity: isPast ? 0.72 : 1 }]}>
      <View style={[s.cardBar, { backgroundColor: isPast ? '#C0BDB4' : color }]} />
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
          <Text style={[s.statusText, { color: isPast ? C.inkSoft : C.inkSoft }]}>
            {isCancelled ? 'Cancelado' : isPast ? 'Encerrado' : 'Em aberto'}
          </Text>
        </View>

        <View style={s.cardTimeRow}>
          <Text style={[s.cardTime, { color: isPast ? C.inkSoft : C.ink }]}>{formatTime(g.scheduled_at)}</Text>
          <Text style={s.cardDate}>· {formatDate(g.scheduled_at)}</Text>
        </View>

        <View style={s.cardVenueRow}>
          <Ionicons name="location-outline" size={12} color={C.inkSoft} />
          <Text style={s.cardVenue}>{g.venue_nome ?? 'Quadra a definir'}</Text>
          {g.court_reserved ? (
            <View style={s.resBadge}>
              <Text style={s.resBadgeText}>✓ Res.</Text>
            </View>
          ) : null}
        </View>

        <View style={s.cardBottomRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color={C.inkSoft} />
            <Text style={s.cardMeta}>{g.vacancies_total} vagas</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={C.inkSoft} />
            <Text style={s.cardMeta}>{g.duration_minutes} min</Text>
          </View>
        </View>
      </View>

      <View style={s.chevron}>
        <Ionicons name="chevron-forward" size={16} color={C.inkSoft} />
      </View>
    </TouchableOpacity>
  )
}

export default function MeusJogosScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [myGames, setMyGames] = useState<MyGame[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'proximos' | 'passados'>('proximos')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const games = await apiGet<MyGame[]>('/me/jogos')
      setMyGames(games)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  const now = new Date()
  const proximos = myGames.filter(g => g.status !== 'cancelled' && new Date(g.scheduled_at) >= now)
  const passados = myGames.filter(g => g.status === 'cancelled' || new Date(g.scheduled_at) < now).reverse()
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
        <ScrollView contentContainerStyle={s.scroll}>
          {list.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{tab === 'proximos' ? '🎾' : '📋'}</Text>
              <Text style={s.emptyTitle}>
                {tab === 'proximos' ? 'Nenhum jogo próximo' : 'Sem histórico ainda'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'proximos'
                  ? 'Crie um jogo ou entre em um na aba Descobrir'
                  : 'Seus jogos finalizados aparecerão aqui'}
              </Text>
              {tab === 'proximos' ? (
                <View style={{ marginTop: 16 }}>
                  <Btn onPress={() => router.push('/criar' as never)}>Criar jogo</Btn>
                </View>
              ) : null}
            </View>
          ) : (
            list.map(g => (
              <GameCard key={g.id} g={g} onPress={() => router.push(`/(app)/jogo/${g.id}` as never)} />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  headerWrap: { padding: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, letterSpacing: 3 },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },

  scroll: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', borderRadius: 24, overflow: 'hidden',
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 10,
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.09,
    shadowRadius: 12, elevation: 3,
  },
  cardBar: { width: 5 },
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

  cardTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardTime: { fontFamily: F.headingBold, fontSize: 22, letterSpacing: -0.5 },
  cardDate: { fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi },

  cardVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  cardVenue: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },
  resBadge: { backgroundColor: '#E8F4EE', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  resBadgeText: { fontSize: 10, fontFamily: F.bodyBold, color: C.success },

  cardBottomRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cardMeta: { fontSize: 11, color: C.inkSoft, fontFamily: F.body },

  chevron: { alignItems: 'center', justifyContent: 'center', paddingRight: 12 },

  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 17, color: C.ink },
  emptySub: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, marginTop: 6, lineHeight: 20, textAlign: 'center' },
})
