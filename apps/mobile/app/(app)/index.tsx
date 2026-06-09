import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, FlatList, Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiGet } from '../../lib/api'
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
  target_play_format: string | null
  gender_type: string | null
  notes: string | null
  venue_nome: string | null
  venue_endereco: string | null
  creator_id: string
  participant_count: number
  open_spots: number
  participants: GameParticipant[]
}

interface AdvFilters {
  day: 'any' | 'today' | 'tomorrow' | 'week'
  categories: string[]
  skillLevel: string
  format: string
  gender: string
  courtReserved: boolean | null
}

const DEFAULT_FILTERS: AdvFilters = {
  day: 'any', categories: [], skillLevel: '', format: '', gender: '', courtReserved: null,
}

const PADEL_CATS  = ['8a','7a','6a','5a','4a','3a','2a','Open']
const BEACH_CATS  = ['C','B','A','Open']
const SKILL_OPTS  = [['beginner','Iniciante'],['intermediate','Intermediário'],['advanced','Avançado'],['competitive','Competitivo']] as const
const FORMAT_OPTS = [['singles','Simples'],['doubles','Duplas']] as const
const GENDER_OPTS = [['mixed','Misto'],['male','Masculino'],['female','Feminino']] as const
const DAY_OPTS    = [['any','Qualquer dia'],['today','Hoje'],['tomorrow','Amanhã'],['week','Esta semana']] as const

function applyAdvFilters(games: Game[], f: AdvFilters): Game[] {
  return games.filter(g => {
    // Dia
    if (f.day !== 'any') {
      const gd = new Date(g.scheduled_at)
      const today = new Date(); today.setHours(0,0,0,0)
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate()+7)
      if (f.day === 'today'    && !(gd >= today && gd < tomorrow)) return false
      if (f.day === 'tomorrow' && !(gd >= tomorrow && gd < new Date(tomorrow.getTime()+86400000))) return false
      if (f.day === 'week'     && !(gd >= today && gd < weekEnd)) return false
    }
    // Categoria
    if (f.categories.length > 0) {
      const gameCats = g.target_categories?.length ? g.target_categories : (g.target_category ? [g.target_category] : [])
      if (!f.categories.some(c => gameCats.includes(c))) return false
    }
    // Nível (tênis)
    if (f.skillLevel && g.target_skill_level && g.target_skill_level !== f.skillLevel) return false
    // Formato
    if (f.format && g.target_play_format && g.target_play_format !== f.format && g.target_play_format !== 'both') return false
    // Gênero
    if (f.gender && g.gender_type !== f.gender) return false
    // Quadra reservada
    if (f.courtReserved !== null && g.court_reserved !== f.courtReserved) return false
    return true
  })
}

function countActiveFilters(f: AdvFilters): number {
  let n = 0
  if (f.day !== 'any') n++
  if (f.categories.length > 0) n++
  if (f.skillLevel) n++
  if (f.format) n++
  if (f.gender) n++
  if (f.courtReserved !== null) n++
  return n
}

const FILTERS = [
  { key: 'all',          label: 'Todos', color: null },
  { key: 'padel',        label: 'Padel', color: 'padel' },
  { key: 'beach_tennis', label: 'Beach', color: 'beach_tennis' },
  { key: 'tennis',       label: 'Tênis', color: 'tennis' },
] as const

const AVATAR_COLORS = ['#2E6F9E','#D4880A','#B03A2E','#5B7A4C','#8A5A9E','#C2607F','#3A7A6E','#A0622A']
const PT_WEEKDAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const PT_MONTH_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const PT_MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']


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

function GameCard({ g, onView }: {
  g: Game
  onView: () => void
}) {
  const color = sportColors[g.sport as keyof typeof sportColors] ?? '#888'
  const label = sportLabels[g.sport as keyof typeof sportLabels] ?? g.sport
  const isFull = g.open_spots <= 0
  const isUrgent = g.open_spots === 1
  const filledSpots = g.vacancies_total - g.open_spots

  const spotsLabel = isFull
    ? `${g.vacancies_total}/${g.vacancies_total} jogadores`
    : `${filledSpots}/${g.vacancies_total} jogadores`

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
          {g.gender_type === 'male' ? (
            <Ionicons name="male" size={13} color="#2E6F9E" />
          ) : g.gender_type === 'female' ? (
            <Ionicons name="female" size={13} color="#C2607F" />
          ) : null}
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

      {/* quadra + reservada + avatares na mesma linha */}
      <View style={s.cardVenueRow}>
        <View style={{ flex: 1 }}>
          {g.venue_nome ? (
            <Text style={s.cardVenueText} numberOfLines={1}>{g.venue_nome}</Text>
          ) : !g.court_reserved ? (
            <Text style={s.cardVenueText}>Quadra a definir</Text>
          ) : null}
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

        {(g.participants ?? []).length > 0 ? (
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
        ) : null}
      </View>
      </View>
    </TouchableOpacity>
  )
}

export default function DescobrirScreen() {
  useAuth()
  const router = useRouter()
  const [allGames, setAllGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })
  const [cidadeId, setCidadeId] = useState<string | null>(null)
  const [cidadeNome, setCidadeNome] = useState<string>('')
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [cidadeModal, setCidadeModal] = useState(false)
  const [advFilters, setAdvFilters] = useState<AdvFilters>(DEFAULT_FILTERS)
  const [filterModal, setFilterModal] = useState(false)

  useEffect(() => {
    apiGet<Cidade[]>('/cidades').then(setCidades).catch(() => {})
    apiGet<{ cidade_id?: string }>('/me/location')
      .then(r => { if (r.cidade_id) setCidadeId(r.cidade_id) })
      .catch(() =>
        apiGet<{ cidade_id?: string }>('/me')
          .then(me => { if (me.cidade_id) setCidadeId(me.cidade_id) })
          .catch(() => {})
      )
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

  const games = applyAdvFilters(
    allGames
      .filter(g => sportFilter === 'all' || g.sport === sportFilter)
      .filter(g => !selectedDate || new Date(g.scheduled_at).toDateString() === selectedDate.toDateString()),
    advFilters,
  )
  const activeFilterCount = countActiveFilters(advFilters)

  const counts: Record<string, number> = {
    all: allGames.length,
    padel: allGames.filter(g => g.sport === 'padel').length,
    beach_tennis: allGames.filter(g => g.sport === 'beach_tennis').length,
    tennis: allGames.filter(g => g.sport === 'tennis').length,
  }


  useToast()
  const activeSportLabel = FILTERS.find(f => f.key === sportFilter)?.label ?? ''

  return (
    <Screen>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setCidadeModal(true)} activeOpacity={0.7} style={s.locationRow}>
          <Ionicons name="location-outline" size={13} color={C.inkSoft} />
          <Text style={s.locationText} numberOfLines={1}>{cidadeNome || 'Selecionar cidade'}</Text>
          <Ionicons name="chevron-down" size={11} color={C.inkSoft} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(app)/criar' as never)} style={s.createBtn}>
          <Ionicons name="add" size={16} color={C.ink} />
          <Text style={s.createBtnText}>Criar Jogo</Text>
        </TouchableOpacity>
      </View>


      {/* Filter bar — 4 campos iguais */}
      <View style={s.filterBar}>
        {FILTERS.map((f, idx) => {
          const active = sportFilter === f.key
          const count = counts[f.key] ?? 0
          const isFirst = idx === 0
          const isLast = idx === FILTERS.length - 1
          const activeBg = f.color ? sportColors[f.color as keyof typeof sportColors] : C.ink
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => {
                setSportFilter(f.key)
                setAdvFilters(p => ({ ...p, categories: [], skillLevel: '' }))
              }}
              activeOpacity={0.8}
              style={[
                s.filterSegment,
                isFirst && s.filterSegmentFirst,
                isLast && s.filterSegmentLast,
                active && { backgroundColor: activeBg },
              ]}
            >
              <Text style={[s.filterSegmentText, active && s.filterSegmentTextActive]}>
                {f.label}
              </Text>
              <Text style={[s.filterSegmentCount, active && s.filterSegmentCountActive, count === 0 && s.filterSegmentCountZero]}>
                {count}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Botão de filtros avançados + data */}
      <View style={s.filterAdvRow}>
        <TouchableOpacity
          onPress={() => setFilterModal(true)}
          activeOpacity={0.8}
          style={[s.filterAdvBtn, activeFilterCount > 0 && s.filterAdvBtnActive]}
        >
          <Ionicons name="options-outline" size={15} color={activeFilterCount > 0 ? '#fff' : C.inkSoft} />
          <Text style={[s.filterAdvText, activeFilterCount > 0 && { color: '#fff' }]}>
            {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
          </Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={() => setAdvFilters(DEFAULT_FILTERS)}
              hitSlop={8}
              style={s.filterAdvClear}
            >
              <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (selectedDate) setCalMonth(() => { const d = new Date(selectedDate); d.setDate(1); d.setHours(0,0,0,0); return d })
            setDatePickerOpen(true)
          }}
          activeOpacity={0.8}
          style={[s.datePillBtn, selectedDate && s.datePillBtnActive]}
        >
          <Ionicons name="calendar-outline" size={14} color={selectedDate ? '#fff' : C.inkSoft} />
          <Text style={[s.datePillText, selectedDate && { color: '#fff' }]}>
            {selectedDate
              ? `${PT_WEEKDAY_SHORT[selectedDate.getDay()]}, ${selectedDate.getDate()} ${PT_MONTH_SHORT[selectedDate.getMonth()]}`
              : 'Qualquer data'}
          </Text>
          {selectedDate ? (
            <TouchableOpacity onPress={() => setSelectedDate(null)} hitSlop={8} style={{ marginLeft: 2 }}>
              <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      </View>

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
                <View style={s.emptyIconsRow}>
                  <View style={[s.emptyIconCircle, { backgroundColor: `${sportColors.padel}18` }]}>
                    <Ionicons name="tennisball" size={28} color={sportColors.padel} />
                  </View>
                  <View style={[s.emptyIconCircle, s.emptyIconCircleLarge, { backgroundColor: `${sportColors.beach_tennis}18` }]}>
                    <Ionicons name="tennisball" size={36} color={sportColors.beach_tennis} />
                  </View>
                  <View style={[s.emptyIconCircle, { backgroundColor: `${sportColors.tennis}18` }]}>
                    <Ionicons name="tennisball" size={28} color={sportColors.tennis} />
                  </View>
                </View>
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
                  onView={() => router.push(`/(app)/jogo/${g.id}` as never)}
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

      {/* Modal calendário de data */}
      <Modal visible={datePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDatePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Text style={{ fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 }}>Escolher data</Text>
            <TouchableOpacity onPress={() => setDatePickerOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            {selectedDate ? (
              <TouchableOpacity onPress={() => { setSelectedDate(null); setDatePickerOpen(false) }} activeOpacity={0.8}
                style={{ alignSelf: 'center', marginBottom: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: `${C.coral}15`, borderWidth: 1, borderColor: `${C.coral}40` }}>
                <Text style={{ fontFamily: F.bodySemi, fontSize: 13, color: C.coral }}>Limpar filtro de data</Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={C.ink} />
              </TouchableOpacity>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 17, color: C.ink }}>{PT_MONTH_LONG[calMonth.getMonth()]} {calMonth.getFullYear()}</Text>
              <TouchableOpacity onPress={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {PT_WEEKDAY_SHORT.map(d => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft, paddingBottom: 8 }}>{d}</Text>)}
            </View>
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0)
              const firstDay = calMonth.getDay()
              const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
              const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
              while (cells.length % 7 !== 0) cells.push(null)
              const weeks: (number | null)[][] = []
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
              return weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={{ flex: 1, aspectRatio: 1 }} />
                    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
                    date.setHours(0,0,0,0)
                    const isPast = date < today
                    const isToday = date.getTime() === today.getTime()
                    const isSelected = selectedDate?.toDateString() === date.toDateString()
                    return (
                      <TouchableOpacity key={di} disabled={isPast} activeOpacity={0.7}
                        onPress={() => { setSelectedDate(date); setDatePickerOpen(false) }}
                        style={[{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, margin: 2 },
                          isSelected && { backgroundColor: C.ink },
                          isToday && !isSelected && { backgroundColor: `${C.lime}50` }]}>
                        <Text style={[{ fontSize: 15, fontFamily: F.bodySemi, color: C.inkSoft },
                          isPast && { color: C.line },
                          isToday && !isSelected && { color: C.ink, fontFamily: F.bodyBold },
                          isSelected && { color: C.cream }]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))
            })()}
          </View>
        </View>
      </Modal>

      {/* Modal filtros avançados */}
      <Modal visible={filterModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFilterModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={fm.header}>
            <Text style={fm.title}>Filtros</Text>
            <TouchableOpacity onPress={() => setFilterModal(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}>

            {/* Dia */}
            <View>
              <Text style={fm.sectionLabel}>Dia</Text>
              <View style={fm.chipRow}>
                {DAY_OPTS.map(([val, lbl]) => {
                  const on = advFilters.day === val
                  return (
                    <TouchableOpacity key={val} onPress={() => setAdvFilters(p => ({ ...p, day: val }))}
                      activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                      <Text style={[fm.chipText, on && fm.chipTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Categoria — padel */}
            {(sportFilter === 'all' || sportFilter === 'padel') ? (
              <View>
                <Text style={fm.sectionLabel}>{sportFilter === 'padel' ? 'Categoria' : 'Categoria Padel'}</Text>
                <View style={fm.chipRow}>
                  {PADEL_CATS.map(cat => {
                    const on = advFilters.categories.includes(cat)
                    return (
                      <TouchableOpacity key={cat} onPress={() => setAdvFilters(p => ({
                        ...p,
                        categories: on ? p.categories.filter(c => c !== cat) : [...p.categories, cat],
                      }))} activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                        <Text style={[fm.chipText, on && fm.chipTextActive]}>
                          {cat === 'Open' ? 'Open' : `Cat. ${cat}`}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* Categoria — beach tennis */}
            {(sportFilter === 'all' || sportFilter === 'beach_tennis') ? (
              <View>
                <Text style={fm.sectionLabel}>{sportFilter === 'beach_tennis' ? 'Categoria' : 'Categoria Beach Tennis'}</Text>
                <View style={fm.chipRow}>
                  {BEACH_CATS.map(cat => {
                    const on = advFilters.categories.includes(cat)
                    return (
                      <TouchableOpacity key={`b-${cat}`} onPress={() => setAdvFilters(p => ({
                        ...p,
                        categories: on ? p.categories.filter(c => c !== cat) : [...p.categories, cat],
                      }))} activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                        <Text style={[fm.chipText, on && fm.chipTextActive]}>
                          {cat === 'Open' ? 'Open' : `Cat. ${cat}`}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* Nível — tênis */}
            {(sportFilter === 'all' || sportFilter === 'tennis') ? (
              <View>
                <Text style={fm.sectionLabel}>{sportFilter === 'tennis' ? 'Nível' : 'Nível (Tênis)'}</Text>
                <View style={fm.chipRow}>
                  {SKILL_OPTS.map(([val, lbl]) => {
                    const on = advFilters.skillLevel === val
                    return (
                      <TouchableOpacity key={val} onPress={() => setAdvFilters(p => ({ ...p, skillLevel: on ? '' : val }))}
                        activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                        <Text style={[fm.chipText, on && fm.chipTextActive]}>{lbl}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* Formato */}
            <View>
              <Text style={fm.sectionLabel}>Formato</Text>
              <View style={fm.chipRow}>
                {FORMAT_OPTS.map(([val, lbl]) => {
                  const on = advFilters.format === val
                  return (
                    <TouchableOpacity key={val} onPress={() => setAdvFilters(p => ({ ...p, format: on ? '' : val }))}
                      activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                      <Text style={[fm.chipText, on && fm.chipTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Gênero */}
            <View>
              <Text style={fm.sectionLabel}>Gênero</Text>
              <View style={fm.chipRow}>
                {GENDER_OPTS.map(([val, lbl]) => {
                  const on = advFilters.gender === val
                  return (
                    <TouchableOpacity key={val} onPress={() => setAdvFilters(p => ({ ...p, gender: on ? '' : val }))}
                      activeOpacity={0.8} style={[fm.chip, on && fm.chipActive]}>
                      <Text style={[fm.chipText, on && fm.chipTextActive]}>{lbl}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Quadra reservada */}
            <View style={fm.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={fm.switchLabel}>Apenas quadra reservada</Text>
                <Text style={fm.switchSub}>Mostrar só jogos com quadra confirmada</Text>
              </View>
              <Switch
                value={advFilters.courtReserved === true}
                onValueChange={v => setAdvFilters(p => ({ ...p, courtReserved: v ? true : null }))}
                trackColor={{ false: C.line, true: C.lime }}
                thumbColor="#fff"
              />
            </View>

            {/* Ações */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setAdvFilters(DEFAULT_FILTERS)} activeOpacity={0.8}
                style={[fm.actionBtn, fm.actionBtnGhost]}>
                <Text style={fm.actionBtnGhostText}>Limpar tudo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterModal(false)} activeOpacity={0.85}
                style={[fm.actionBtn, fm.actionBtnPrimary]}>
                <Text style={fm.actionBtnPrimaryText}>
                  Ver {games.length} jogo{games.length !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

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
  greeting: {
    fontFamily: F.headingBold, fontSize: 20, color: C.ink,
    letterSpacing: -0.3, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  header: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 17, color: C.ink, fontFamily: F.headingBold, letterSpacing: -0.3 },

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
  statItemActive: { backgroundColor: `${C.coral}12`, borderRadius: 10, paddingHorizontal: 8 },
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

  // Filter segmented control
  filterBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.line,
    overflow: 'hidden',
  },
  filterSegment: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, gap: 2,
    borderRightWidth: 1, borderRightColor: C.line,
  },
  filterSegmentFirst: { borderLeftWidth: 0 },
  filterSegmentLast:  { borderRightWidth: 0 },
  filterSegmentActive: { backgroundColor: C.ink },
  filterSegmentText: { fontSize: 15, fontFamily: F.bodyBold, color: C.inkSoft },
  filterSegmentTextActive: { color: C.cream },
  filterSegmentCount: {
    fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft,
  },
  filterSegmentCountZero: { opacity: 0.45 },
  filterSegmentCountActive: { color: '#fff' },
  // kept for any remaining refs
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  filterPillText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },
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
  cardAccent: { width: 7 },
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

  cardVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardVenueText: { fontSize: 15, color: C.inkSoft, fontFamily: F.bodySemi },
  reservedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reservedText: { fontSize: 14, fontFamily: F.bodyBold, color: '#2E7D6E' },
  priceText: { fontSize: 11, fontFamily: F.bodySemi, color: '#2E7D6E' },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 },
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
  emptyIconsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 8 },
  emptyIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconCircleLarge: { width: 76, height: 76, borderRadius: 38 },
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

  // Filter adv button row
  filterAdvRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 8,
  },
  filterAdvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card,
  },
  filterAdvBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterAdvText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },
  filterAdvClear: { marginLeft: 2 },
  datePillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card,
  },
  datePillBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  datePillText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },

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

// ── Filter modal styles ────────────────────────────────────────────────────────
const fm = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  title: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  sectionLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 13, fontFamily: F.bodyBold, color: C.inkSoft },
  chipTextActive: { color: C.cream },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  switchLabel: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  switchSub: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 2 },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
  },
  actionBtnGhost: {
    borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card,
  },
  actionBtnGhostText: { fontFamily: F.bodyBold, fontSize: 14, color: C.inkSoft },
  actionBtnPrimary: { backgroundColor: C.ink },
  actionBtnPrimaryText: { fontFamily: F.headingBold, fontSize: 14, color: C.lime },
})
