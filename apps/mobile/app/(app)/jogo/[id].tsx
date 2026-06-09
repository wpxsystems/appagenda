import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, Share, Modal, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToast } from '../../../components/Toast'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth-context'
import { apiGet, apiPost, apiDelete } from '../../../lib/api'
import { colors as C, fontFamily as F } from '@racket-app/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

// ── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string
  nome: string
  avatar_url: string | null
}

interface Participacao {
  id: string
  user_id: string
  user: Player
}

interface GameDetail {
  id: string
  sport: string
  scheduled_at: string
  duration_minutes: number
  vacancies_total: number
  status: string
  court_reserved: boolean
  court_price_per_person: number | null
  notes: string | null
  target_category: string | null
  target_skill_level: string | null
  target_side: string | null
  venue_nome: string | null
  venue_endereco: string | null
  creator_nome: string | null
  creator_id: string
  participacoes: Participacao[]
  is_creator: boolean
  already_joined: boolean
}

interface Message {
  id: string
  user_id: string
  content: string
  created_at: string
  user?: { id: string; nome: string }
}

interface PublicProfile {
  id: string
  nome: string
  nickname: string | null
  bio: string | null
  avatar_url: string | null
  games_played: number
  sport_profiles: { sport: string; category: string | null; skill_level: string | null }[]
  avg_score: number | null
  top_badges: { key: string; count: number }[]
  is_favorite: boolean
}

const BADGE_LABELS: Record<string, string> = {
  pontual: 'Pontual', respeitoso: 'Respeitoso', simpatico: 'Simpático',
  competitivo: 'Competitivo', comprometido: 'Comprometido', comunicativo: 'Comunicativo',
  esportivo: 'Esportivo', parceiro: 'Ótimo parceiro', energia: 'Energia positiva', jogaria: 'Jogaria novamente',
}

// ── UserProfileModal ─────────────────────────────────────────────────────────

function UserProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (!userId) { setProfile(null); return }
    setLoading(true)
    apiGet<PublicProfile>(`/users/${userId}`)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  async function toggleFavorite() {
    if (!profile) return
    setToggling(true)
    try {
      if (profile.is_favorite) {
        await apiDelete(`/community/favorites/${profile.id}`)
      } else {
        await apiPost(`/community/favorites/${profile.id}`, {})
      }
      setProfile(p => p ? { ...p, is_favorite: !p.is_favorite } : p)
      showToast({ type: 'success', title: profile.is_favorite ? 'Conexão removida' : 'Conectado!' })
    } catch {
      showToast({ type: 'error', title: 'Erro ao conectar' })
    } finally {
      setToggling(false)
    }
  }

  return (
    <Modal visible={!!userId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.cream }}>
        <View style={pm.header}>
          <Text style={pm.title}>Perfil</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={C.inkSoft} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={C.ink} style={{ marginTop: 48 }} />
        ) : profile ? (
          <ScrollView contentContainerStyle={pm.scroll}>
            {/* Avatar + nome */}
            <View style={pm.heroSection}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={pm.avatar} />
              ) : (
                <View style={[pm.avatar, { backgroundColor: avatarColor(profile.id), alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={pm.avatarInitials}>{profile.nome.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}</Text>
                </View>
              )}
              <Text style={pm.nome}>{profile.nome}</Text>
              {profile.nickname ? <Text style={pm.nickname}>@{profile.nickname}</Text> : null}
              {profile.bio ? <Text style={pm.bio}>{profile.bio}</Text> : null}
              <Text style={pm.gamesPlayed}>{profile.games_played ?? 0} jogos disputados</Text>
            </View>

            {/* Nota média */}
            {profile.avg_score ? (
              <View style={pm.card}>
                <Text style={pm.cardTitle}>Avaliação</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  {[1,2,3,4,5].map(n => (
                    <Ionicons key={n} name={n <= Math.round(profile.avg_score!) ? 'star' : 'star-outline'} size={20} color="#F5A623" />
                  ))}
                  <Text style={pm.scoreText}>{profile.avg_score.toFixed(1)}</Text>
                </View>
              </View>
            ) : null}

            {/* Badges */}
            {profile.top_badges.length > 0 ? (
              <View style={pm.card}>
                <Text style={pm.cardTitle}>Destaques</Text>
                <View style={pm.badgesWrap}>
                  {profile.top_badges.map(b => (
                    <View key={b.key} style={pm.badge}>
                      <Text style={pm.badgeText}>{BADGE_LABELS[b.key] ?? b.key}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Esportes */}
            {profile.sport_profiles.length > 0 ? (
              <View style={pm.card}>
                <Text style={pm.cardTitle}>Esportes</Text>
                <View style={{ gap: 8, marginTop: 6 }}>
                  {profile.sport_profiles.map((sp, i) => {
                    const color = sportColors[sp.sport as keyof typeof sportColors] ?? C.inkSoft
                    const label = sportLabels[sp.sport as keyof typeof sportLabels] ?? sp.sport
                    return (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: `${color}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 11, fontFamily: F.bodyBold, color }}>{label.toUpperCase()}</Text>
                        </View>
                        {sp.category ? <Text style={pm.spDetail}>Cat. {sp.category}</Text> : null}
                        {sp.skill_level ? <Text style={pm.spDetail}>{sp.skill_level}</Text> : null}
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {/* Botão conectar */}
            <TouchableOpacity
              onPress={toggleFavorite}
              disabled={toggling}
              activeOpacity={0.85}
              style={[pm.connectBtn, profile.is_favorite && pm.connectBtnActive]}
            >
              <Ionicons
                name={profile.is_favorite ? 'person-remove-outline' : 'person-add-outline'}
                size={16}
                color={profile.is_favorite ? C.inkSoft : C.ink}
              />
              <Text style={[pm.connectBtnText, profile.is_favorite && { color: C.inkSoft }]}>
                {toggling ? '…' : profile.is_favorite ? 'Conectado' : 'Conectar'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  )
}

const pm = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#E7E1D2',
  },
  title: { fontFamily: F.headingBold, fontSize: 20, color: '#1A1813', letterSpacing: -0.3 },
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  heroSection: { alignItems: 'center', gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 4 },
  avatarInitials: { fontSize: 28, fontFamily: F.headingBold, color: '#fff' },
  nome: { fontFamily: F.headingBold, fontSize: 22, color: '#1A1813', letterSpacing: -0.4 },
  nickname: { fontSize: 13, fontFamily: F.bodySemi, color: '#8A8472' },
  bio: { fontSize: 13, fontFamily: F.body, color: '#8A8472', textAlign: 'center', marginTop: 2 },
  gamesPlayed: { fontSize: 12, fontFamily: F.bodySemi, color: '#8A8472', marginTop: 2 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E7E1D2',
  },
  cardTitle: { fontFamily: F.bodyBold, fontSize: 12, color: '#8A8472', textTransform: 'uppercase', letterSpacing: 1 },
  scoreText: { fontFamily: F.headingBold, fontSize: 18, color: '#1A1813', marginLeft: 4 },
  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: {
    backgroundColor: '#F3EFE6', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontFamily: F.bodySemi, color: '#1A1813' },
  spDetail: { fontSize: 12, fontFamily: F.bodySemi, color: '#8A8472' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#CBF135', borderRadius: 999,
    paddingVertical: 14, marginTop: 4,
    shadowColor: '#6B8800', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  connectBtnActive: { backgroundColor: '#F3EFE6', shadowOpacity: 0 },
  connectBtnText: { fontFamily: F.bodyBold, fontSize: 15, color: '#1A1813' },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDay(dt: string) {
  const d = new Date(dt)
  const today = new Date()
  const tom = new Date(today); tom.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === tom.toDateString()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatMsgTime(dt: string) {
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function initials(nome: string) {
  return nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function avatarColor(id: string) {
  const palette = ['#2E6F9E', '#D4880A', '#B03A2E', '#5B7A4C', '#8A5A9E', '#C2607F']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length
  return palette[h]
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function PlayerAvatar({ id, nome, size = 40 }: { id: string; nome: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: avatarColor(id),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: size * 0.36 }}>
        {initials(nome)}
      </Text>
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function JogoDetailScreen() {
  const { id, fromTab } = useLocalSearchParams<{ id: string; fromTab?: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [jogo, setJogo] = useState<GameDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingJogo, setLoadingJogo] = useState(true)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [mySports, setMySports] = useState<string[]>([])
  const scrollRef = useRef<ScrollView>(null)
  const { showToast, showConfirm } = useToast()
  const insets = useSafeAreaInsets()

  const loadJogo = useCallback(async () => {
    setJogo(null)
    setLoadingJogo(true)
    try {
      const data = await apiGet<GameDetail>(`/jogos/${id}`)
      setJogo(data)
    } catch { /* ignore */ } finally {
      setLoadingJogo(false)
    }
  }, [id])

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiGet<Message[]>(`/jogos/${id}/messages`)
      setMessages(data)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    loadJogo()
    loadMessages()
    apiGet<{ sport: string }[]>('/me/sport-profiles')
      .then(p => setMySports(p.map(x => x.sport)))
      .catch(() => {})
  }, [loadJogo, loadMessages])

  async function sendMessage() {
    const text = msgText.trim()
    if (!text) return
    setSending(true)
    setMsgText('')
    try {
      await apiPost(`/jogos/${id}/messages`, { content: text })
      await loadMessages()
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e: unknown) {
      const err = e as { message?: string }
      showToast({ type: 'error', title: err.message ?? 'Erro ao enviar mensagem' })
      setMsgText(text)
    } finally {
      setSending(false)
    }
  }

  function cancelGame() {
    showConfirm({
      title: 'Cancelar partida',
      message: 'Todos os participantes serão notificados do cancelamento.',
      confirmLabel: 'Cancelar partida',
      destructive: true,
      onConfirm: async () => {
        setCancelling(true)
        try {
          await apiPost(`/jogos/${id}/cancel`)
          showToast({ type: 'success', title: 'Partida cancelada' })
          setTimeout(() => router.back(), 1200)
        } catch (e: unknown) {
          const err = e as { message?: string }
          showToast({ type: 'error', title: err.message ?? 'Erro ao cancelar' })
        } finally {
          setCancelling(false)
        }
      },
    })
  }

  async function shareGame() {
    if (!jogo) return
    const sportLabel = sportLabels[jogo.sport as keyof typeof sportLabels] ?? jogo.sport
    const date = new Date(jogo.scheduled_at)
    const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const venue = jogo.venue_nome ?? 'Quadra a definir'
    const spots = jogo.vacancies_total - jogo.participacoes.length

    const message = [
      `🎾 Partida de ${sportLabel}`,
      `📅 ${dateStr} às ${timeStr}`,
      `📍 ${venue}`,
      spots > 0 ? `✅ ${spots} vaga${spots !== 1 ? 's' : ''} disponível` : '⚠️ Jogo completo',
      '',
      'Baixe o PlayNet e entre nesta partida!',
    ].join('\n')

    try {
      await Share.share({ message })
    } catch { /* ignore */ }
  }

  function leaveGame() {
    showConfirm({
      title: 'Sair da partida',
      message: 'O organizador será notificado que você saiu. Tem certeza?',
      confirmLabel: 'Sair',
      destructive: true,
      onConfirm: async () => {
        setLeaving(true)
        try {
          await apiPost(`/jogos/${id}/leave`)
          showToast({ type: 'success', title: 'Você saiu da partida' })
          setTimeout(() => router.back(), 1200)
        } catch (e: unknown) {
          const err = e as { message?: string }
          showToast({ type: 'error', title: err.message ?? 'Erro ao sair' })
        } finally {
          setLeaving(false)
        }
      },
    })
  }

  async function joinGame() {
    if (!jogo) return
    if (!mySports.includes(jogo.sport)) {
      showConfirm({
        title: 'Esporte não está no seu perfil',
        message: `Você não tem ${sportLabels[jogo.sport as keyof typeof sportLabels] ?? jogo.sport} cadastrado no seu perfil. Quer cadastrar agora?`,
        confirmLabel: 'Cadastrar Esporte',
        onConfirm: () => router.push(`/(app)/perfil?sport=${jogo.sport}` as never),
      })
      return
    }
    setJoining(true)
    try {
      await apiPost(`/jogos/${id}/join`)
      showToast({ type: 'success', title: 'Você entrou no jogo!' })
      await loadJogo()
    } catch (e: unknown) {
      const err = e as { message?: string }
      showToast({ type: 'error', title: err.message ?? 'Erro ao entrar no jogo' })
    } finally {
      setJoining(false)
    }
  }

  if (loadingJogo) {
    return (
      <View style={{ flex: 1, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.ink} />
      </View>
    )
  }

  if (!jogo) {
    return (
      <View style={{ flex: 1, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontFamily: F.headingBold, fontSize: 17, color: C.ink, textAlign: 'center' }}>
          Jogo não encontrado
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.inkSoft }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const color = sportColors[jogo.sport as keyof typeof sportColors] ?? C.ink
  const label = sportLabels[jogo.sport as keyof typeof sportLabels] ?? jogo.sport
  const isCancelled = jogo.status === 'cancelled'
  const openSlots = jogo.vacancies_total - jogo.participacoes.length

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={color} />

      {/* ── Header fixo ── */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        {/* Coluna esquerda: botão voltar */}
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace(`/(app)/meus-jogos${fromTab ? '?tab=' + fromTab : ''}` as never)} style={s.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Coluna direita: kicker + horário */}
        <View style={s.headerInfo}>
          <Text style={s.headerKicker}>Partida de {label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <Text style={s.headerTime}>{formatTime(jogo.scheduled_at)}</Text>
            <Text style={s.headerDate}>{formatDay(jogo.scheduled_at)}</Text>
          </View>
          {isCancelled && (
            <View style={[s.cancelledBadge, { marginTop: 8, alignSelf: 'flex-start' }]}>
              <Text style={s.cancelledText}>Cancelado</Text>
            </View>
          )}
        </View>

        {/* Botão compartilhar — canto direito */}
        <TouchableOpacity onPress={shareGame} style={s.shareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cards area (cream, rounded top corners overlapping header) ── */}
        <View style={s.cardsArea}>

        {/* ── Venue ── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={s.iconWrap}>
              <Ionicons name="location-outline" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardLabel}>Quadra</Text>
              <Text style={s.cardValue}>{jogo.venue_nome ?? 'Quadra a definir'}</Text>
              {jogo.venue_endereco ? (
                <Text style={s.cardSub}>{jogo.venue_endereco}</Text>
              ) : null}
            </View>
            {jogo.court_reserved ? (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={s.resBadge}>
                  <Ionicons name="checkmark" size={11} color="#2E6F9E" />
                  <Text style={s.resBadgeText}>Reservada</Text>
                </View>
                {jogo.court_price_per_person ? (
                  <Text style={s.resPriceText}>
                    R$ {jogo.court_price_per_person.toFixed(2).replace('.', ',')}/pessoa
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Game Info ── */}
        <View style={[s.card, { paddingVertical: 18 }]}>
          <View style={{ flexDirection: 'row' }}>
            <InfoChip icon="time-outline" label="Duração" value={`${jogo.duration_minutes} min`} />
            <View style={s.chipDivider} />
            <InfoChip icon="people-outline" label="Jogadores" value={`${jogo.participacoes.length} / ${jogo.vacancies_total}`} />
            <View style={s.chipDivider} />
            <InfoChip
              icon="ribbon-outline"
              label="Categoria"
              value={jogo.target_category ? `Cat. ${jogo.target_category}` : 'Livre'}
            />
          </View>
          {jogo.notes ? (
            <View style={s.notesBox}>
              <Ionicons name="chatbubble-outline" size={14} color={C.inkSoft} />
              <Text style={s.notesText}>{jogo.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Players ── */}
        <View style={s.card}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Jogadores</Text>
            <Text style={s.sectionSub}>
              {jogo.participacoes.length} de {jogo.vacancies_total}
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            {jogo.participacoes.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={s.playerRow}
                activeOpacity={p.user_id === user?.id ? 1 : 0.7}
                onPress={() => { if (p.user_id !== user?.id) setProfileUserId(p.user_id) }}
              >
                <PlayerAvatar id={p.user_id} nome={p.user?.nome ?? '?'} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.playerName}>{p.user?.nome ?? 'Jogador'}</Text>
                  {p.user_id === jogo.creator_id ? (
                    <Text style={s.organizerTag}>Organizador</Text>
                  ) : null}
                </View>
                {p.user_id === user?.id ? (
                  <View style={s.youBadge}>
                    <Text style={s.youBadgeText}>você</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={C.line} />
                )}
              </TouchableOpacity>
            ))}
            {Array.from({ length: Math.max(0, openSlots) }).map((_, i) => (
              <View key={`open-${i}`} style={s.playerRow}>
                <View style={s.emptySlot} />
                <Text style={s.emptySlotText}>Vaga aberta</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Chat ── */}
        {jogo.already_joined ? (
          <View style={s.card}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Chat do jogo</Text>
              {messages.length > 0 ? (
                <Text style={s.sectionSub}>
                  {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
                </Text>
              ) : null}
            </View>
            {messages.length === 0 ? (
              <View style={s.chatEmpty}>
                <Ionicons name="chatbubbles-outline" size={28} color={C.line} />
                <Text style={s.chatEmptyText}>Nenhuma mensagem ainda</Text>
                <Text style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 }}>
                  Combine horários, leve as bolas…
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {messages.map((m) => {
                  const isMe = m.user_id === user?.id
                  return (
                    <View key={m.id} style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleThem]}>
                      {!isMe ? (
                        <Text style={s.msgSender}>{m.user?.nome ?? 'Jogador'}</Text>
                      ) : null}
                      <Text style={[s.msgText, isMe && { color: C.ink }]}>{m.content}</Text>
                      <Text style={[s.msgTime, isMe && { color: 'rgba(26,24,19,0.45)' }]}>
                        {formatMsgTime(m.created_at)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Message input */}
            <View style={s.chatInput}>
              <TextInput
                value={msgText}
                onChangeText={setMsgText}
                placeholder="Mensagem…"
                placeholderTextColor={C.inkSoft}
                style={s.chatTextInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={sending || !msgText.trim()}
                activeOpacity={0.8}
                style={[s.sendBtn, { backgroundColor: msgText.trim() ? C.ink : C.line }]}
              >
                <Ionicons name="send" size={15} color={msgText.trim() ? C.lime : C.inkSoft} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={{ height: !isCancelled && (jogo.already_joined || (!jogo.is_creator && openSlots > 0)) ? 80 : 24 }} />
        </View>{/* end cardsArea */}
      </ScrollView>

      {/* ── Cancel fixed footer (organizer only) ── */}
      {jogo.is_creator && !isCancelled ? (
        <View style={s.cancelFooter}>
          <TouchableOpacity
            onPress={cancelGame}
            disabled={cancelling}
            activeOpacity={0.85}
            style={s.cancelBtn}
          >
            <Ionicons name="close-circle-outline" size={18} color={C.coral} />
            <Text style={s.cancelBtnText}>
              {cancelling ? 'Cancelando…' : 'Cancelar partida'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Join fixed footer (non-participant only) ── */}
      {!jogo.is_creator && !jogo.already_joined && !isCancelled && openSlots > 0 ? (
        <View style={s.cancelFooter}>
          <TouchableOpacity
            onPress={joinGame}
            disabled={joining}
            activeOpacity={0.85}
            style={[s.cancelBtn, { backgroundColor: C.lime, borderColor: C.lime }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={C.ink} />
            <Text style={[s.cancelBtnText, { color: C.ink }]}>
              {joining ? 'Entrando…' : 'Entrar no jogo'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Leave fixed footer (participant only) ── */}
      {!jogo.is_creator && jogo.already_joined && !isCancelled ? (
        <View style={s.cancelFooter}>
          <TouchableOpacity
            onPress={leaveGame}
            disabled={leaving}
            activeOpacity={0.85}
            style={s.cancelBtn}
          >
            <Ionicons name="exit-outline" size={18} color={C.coral} />
            <Text style={s.cancelBtnText}>
              {leaving ? 'Saindo…' : 'Sair da partida'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </KeyboardAvoidingView>
  )
}

// ── InfoChip ─────────────────────────────────────────────────────────────────

function InfoChip({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 4, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={12} color={C.inkSoft} />
        <Text style={{ fontSize: 10, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontFamily: F.headingBold, fontSize: 19, color: C.ink, letterSpacing: -0.3 }}>
        {value}
      </Text>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header fixo
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfo: { flex: 1 },
  headerKicker: {
    fontSize: 11, fontFamily: F.bodyBold, color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  headerTime: {
    fontFamily: F.headingBold, fontSize: 40, color: '#fff', letterSpacing: -1.5, lineHeight: 44,
  },
  headerDate: { fontSize: 16, fontFamily: F.bodyBold, color: 'rgba(255,255,255,0.88)' },
  cancelledBadge: {
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  cancelledText: { color: '#fff', fontSize: 11, fontFamily: F.bodyBold, letterSpacing: 0.5 },

  // Scroll
  scroll: { paddingHorizontal: 0, paddingTop: 0, gap: 0, flexGrow: 1 },

  // Cards wrapper
  cardsArea: {
    flex: 1,
    backgroundColor: C.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, gap: 10,
  },

  // Card
  card: {
    backgroundColor: C.card, borderRadius: 24, padding: 18,
    borderWidth: 1.5, borderColor: C.line,
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },

  // Venue row
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.cream,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardLabel: {
    fontSize: 10, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  cardValue: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink, marginTop: 2 },
  cardSub: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 2 },
  resBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2E6F9E14', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  resBadgeText: { fontSize: 12, fontFamily: F.bodyBold, color: '#2E6F9E' },
  resPriceText: { fontSize: 11, fontFamily: F.bodySemi, color: '#2E6F9E' },

  // Info chips divider
  chipDivider: {
    width: 1, backgroundColor: C.line, marginHorizontal: 4, alignSelf: 'stretch',
  },

  // Notes
  notesBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: C.cream,
  },
  notesText: { flex: 1, fontSize: 13, fontFamily: F.body, color: C.inkSoft, lineHeight: 20 },

  // Section header
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontFamily: F.bodyBold, color: C.ink },
  sectionSub: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },

  // Players
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerName: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  organizerTag: { fontSize: 11, fontFamily: F.bodySemi, color: C.inkSoft, marginTop: 2 },
  youBadge: {
    backgroundColor: C.lime, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  youBadgeText: { fontSize: 11, fontFamily: F.bodyBold, color: C.ink },
  emptySlot: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line,
    backgroundColor: `${C.line}40`,
  },
  emptySlotText: { fontSize: 13, fontFamily: F.bodySemi, color: C.inkSoft },

  // Chat
  chatEmpty: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  chatEmptyText: { fontSize: 14, fontFamily: F.bodyBold, color: C.inkSoft, marginTop: 6 },

  msgBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  msgBubbleMe: {
    alignSelf: 'flex-end', backgroundColor: C.lime, borderBottomRightRadius: 5,
  },
  msgBubbleThem: {
    alignSelf: 'flex-start', backgroundColor: C.cream, borderBottomLeftRadius: 5,
    borderWidth: 1.5, borderColor: C.line,
  },
  msgSender: { fontSize: 10, fontFamily: F.bodyBold, color: C.inkSoft, marginBottom: 2 },
  msgText: { fontSize: 14, fontFamily: F.body, color: C.ink, lineHeight: 20 },
  msgTime: { fontSize: 10, fontFamily: F.body, color: C.inkSoft, alignSelf: 'flex-end', marginTop: 2 },

  chatInput: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  chatTextInput: {
    flex: 1, backgroundColor: C.cream, borderRadius: 999,
    borderWidth: 1.5, borderColor: C.line,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 14, fontFamily: F.body, color: C.ink,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  // Cancel footer
  cancelFooter: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: C.cream, borderTopWidth: 1, borderTopColor: C.line,
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 24, borderWidth: 1.5, borderColor: C.coral,
    backgroundColor: `${C.coral}0A`,
  },
  cancelBtnText: { fontSize: 15, fontFamily: F.bodyBold, color: C.coral },
})
