import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPost } from '../../lib/api'
import { Btn, Pill, Avatar, Screen, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

interface Game {
  id: string
  sport: string
  scheduled_at: string
  duration_minutes: number
  vacancies_total: number
  status: string
  court_reserved: boolean
  target_category: string | null
  target_skill_level: string | null
  notes: string | null
  venue_nome: string | null
  venue_endereco: string | null
  creator_nome: string | null
  creator_id: string
  participant_count: number
  open_spots: number
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

function GameCard({ g, onJoin }: { g: Game; onJoin: () => void }) {
  const color = sportColors[g.sport as keyof typeof sportColors] ?? '#888'
  const label = sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport
  const isFull = g.open_spots <= 0

  return (
    <View style={[s.card, { borderLeftColor: color, borderLeftWidth: 5 }]}>
      <View style={s.cardTop}>
        <View style={[s.sportChip, { backgroundColor: `${color}18` }]}>
          <Text style={[s.sportChipText, { color }]}>{label}</Text>
        </View>
        <Text style={[s.cardStatus, { color: isFull ? C.success : C.inkSoft }]}>
          {isFull ? 'Completo' : `${g.open_spots} vaga${g.open_spots > 1 ? 's' : ''}`}
        </Text>
      </View>

      <View style={s.cardTimeRow}>
        <Text style={s.cardTime}>{formatTime(g.scheduled_at)}</Text>
        <Text style={s.cardDate}>· {formatDay(g.scheduled_at)}</Text>
      </View>

      <View style={s.cardVenue}>
        <Ionicons name="location-outline" size={12} color={C.inkSoft} />
        <Text style={s.cardVenueText}>{g.venue_nome ?? 'Quadra a definir'}</Text>
        {g.court_reserved ? (
          <View style={s.resBadge}>
            <Text style={s.resBadgeText}>✓ Reservada</Text>
          </View>
        ) : null}
      </View>

      <View style={s.cardPlayersRow}>
        <View style={s.avatarStack}>
          {Array.from({ length: g.participant_count }).map((_, i) => (
            <View key={i} style={[s.miniAvatar, {
              backgroundColor: `hsl(${i * 67},50%,42%)`,
              marginLeft: i > 0 ? -6 : 0,
            }]} />
          ))}
          {Array.from({ length: g.open_spots }).map((_, i) => (
            <View key={`o${i}`} style={[s.miniAvatar, {
              backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line,
              marginLeft: (g.participant_count + i) > 0 ? -6 : 0,
            }]} />
          ))}
        </View>
        <Text style={s.cardCreator}>{g.creator_nome ? `por ${g.creator_nome}` : ''}</Text>
      </View>

      {!isFull ? (
        <View style={{ marginTop: 12 }}>
          <Btn fullWidth onPress={onJoin}>Entrar no jogo</Btn>
        </View>
      ) : null}
    </View>
  )
}

export default function DescobrirScreen() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const sport = sportFilter !== 'all' ? `?sport=${sportFilter}` : ''
      setGames(await apiGet<Game[]>(`/jogos${sport}`))
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sportFilter])

  useEffect(() => { setLoading(true); load() }, [load])

  async function joinGame(id: string) {
    setJoiningId(id)
    try {
      await apiPost(`/jogos/${id}/join`)
      Alert.alert('🎉', 'Você entrou no jogo!')
      load()
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Erro ao entrar')
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <Screen>
      <View style={s.headerWrap}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{user?.name?.split(' ')[0]?.toUpperCase() ?? ''}</Text>
          <Text style={s.title}>Descobrir</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={13} color={C.inkSoft} />
            <Text style={s.locationText}>Joinville, SC</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.7} style={s.bell}>
          <Ionicons name="notifications-outline" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <Pill label="Todos" active={sportFilter === 'all'} onPress={() => setSportFilter('all')} small />
          <Pill label="Padel" active={sportFilter === 'padel'} onPress={() => setSportFilter('padel')} small />
          <Pill label="Beach Tennis" active={sportFilter === 'beach_tennis'} onPress={() => setSportFilter('beach_tennis')} small />
          <Pill label="Tênis" active={sportFilter === 'tennis'} onPress={() => setSportFilter('tennis')} small />
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.ink} />}
        >
          {games.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🎾</Text>
              <Text style={s.emptyTitle}>Nenhum jogo por aqui</Text>
              <Text style={s.emptySub}>Que tal criar um?</Text>
            </View>
          ) : (
            games.map(g => (
              <GameCard
                key={g.id}
                g={g}
                onJoin={() => joiningId === null ? joinGame(g.id) : undefined}
              />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  headerWrap: {
    padding: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start',
  },
  eyebrow: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, letterSpacing: 3 },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  locationText: { fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi },
  bell: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.line,
  },

  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },

  scroll: { padding: 16, gap: 12 },

  card: {
    padding: 16, borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sportChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  sportChipText: { fontSize: 11, fontFamily: F.bodyBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardStatus: { fontSize: 11, fontFamily: F.bodyBold },

  cardTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardTime: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },
  cardDate: { fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi },

  cardVenue: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  cardVenueText: { fontSize: 12, color: C.inkSoft, fontFamily: F.bodySemi, flex: 1 },
  resBadge: { backgroundColor: '#E8F4EE', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  resBadgeText: { fontSize: 10, fontFamily: F.bodyBold, color: C.success },

  cardPlayersRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  avatarStack: { flexDirection: 'row' },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.card },
  cardCreator: { fontSize: 12, color: C.inkSoft, fontFamily: F.body },

  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 17, color: C.ink },
  emptySub: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, marginTop: 6 },
})
