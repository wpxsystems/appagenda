import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { apiGet, apiPatch } from '../../lib/api'
import { Screen, colors as C, fonts as F } from '../../components/ui'
import { notifBadge } from '../../lib/notif-badge'

interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  jogo_id: string | null
  read: boolean
  created_at: string
}

// Agrupa por "Hoje", "Ontem" e "Anteriores"
function groupByDate(items: AppNotification[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

  const groups: { title: string; data: AppNotification[] }[] = []
  const map: Record<string, AppNotification[]> = {}

  for (const n of items) {
    const d = new Date(n.created_at); d.setHours(0, 0, 0, 0)
    const key = d.getTime() === today.getTime()
      ? 'Hoje'
      : d.getTime() === yesterday.getTime()
      ? 'Ontem'
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    ;(map[key] = map[key] ?? []).push(n)
  }

  const order = ['Hoje', 'Ontem']
  const rest = Object.keys(map).filter(k => !order.includes(k))
  for (const k of [...order, ...rest]) {
    if (map[k]) groups.push({ title: k, data: map[k] })
  }
  return groups
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  new_game_match: { icon: 'compass',              color: '#2E6F9E' },
  player_joined:  { icon: 'person-add',           color: '#10B981' },
  player_left:    { icon: 'exit-outline',          color: '#F59E0B' },
  game_cancelled: { icon: 'close-circle',          color: '#F0552E' },
  game_completed: { icon: 'checkmark-circle',      color: '#10B981' },
  rate_reminder:  { icon: 'star',                  color: '#F5A623' },
}

function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function NotificacoesScreen() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<AppNotification[]>('/notifications')
      setNotifications(data)
      const unread = data.filter(n => !n.read).length
      notifBadge.set(unread)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await apiPatch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      notifBadge.set(0)
    } catch { /* ignore */ } finally { setMarkingAll(false) }
  }

  async function markOneRead(id: string) {
    try {
      await apiPatch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      notifBadge.set(Math.max(0, notifBadge.get() - 1))
    } catch { /* ignore */ }
  }

  function handlePress(n: AppNotification) {
    if (!n.read) markOneRead(n.id)
    if (n.jogo_id) router.push(`/(app)/jogo/${n.jogo_id}` as never)
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const groups = groupByDate(notifications)

  return (
    <Screen>
      <View style={s.header}>
        <Text style={s.title}>Notificações</Text>
        {unreadCount > 0 && !markingAll ? (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7} style={s.markAllBtn}>
            <Text style={s.markAllText}>Marcar tudo como lido</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <ScrollView contentContainerStyle={s.emptyWrap} showsVerticalScrollIndicator={false}><View>
          <Ionicons name="notifications-outline" size={44} color={C.line} style={{ marginBottom: 8 }} />
          <Text style={s.emptyTitle}>Tudo em dia!</Text>
          <Text style={s.emptySub}>Você receberá avisos aqui assim que algo acontecer nos seus jogos.</Text>

          <Text style={s.previewLabel}>O que você vai receber</Text>
          {[
            { icon: 'compass' as const,         color: '#2E6F9E', title: 'Novo jogo no seu horário',   sub: 'Quando um jogo compatível com seu perfil for criado na sua cidade' },
            { icon: 'person-add' as const,      color: '#10B981', title: 'Alguém entrou no seu jogo', sub: 'Quando um jogador confirmar presença no jogo que você organizou' },
            { icon: 'exit-outline' as const,    color: '#F59E0B', title: 'Jogador saiu',               sub: 'Quando alguém desistir do seu jogo antes do horário' },
            { icon: 'star' as const,            color: '#F5A623', title: 'Hora de avaliar',            sub: 'Lembrete para dar nota aos participantes após o jogo' },
          ].map(item => (
            <View key={item.title} style={s.previewCard}>
              <View style={[s.previewIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>{item.title}</Text>
                <Text style={s.previewSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View></ScrollView>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.title}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: group }) => (
            <View>
              <Text style={s.groupLabel}>{group.title}</Text>
              {group.data.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: 'information-circle-outline', color: C.inkSoft }
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => handlePress(n)}
                    activeOpacity={0.8}
                    style={[s.card, !n.read && s.cardUnread]}
                  >
                    <View style={[s.iconWrap, { backgroundColor: `${cfg.color}18` }]}>
                      <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardTop}>
                        <Text style={[s.cardTitle, !n.read && { color: C.ink }]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        <Text style={s.cardTime}>{timeAgo(n.created_at)}</Text>
                      </View>
                      <Text style={s.cardBody} numberOfLines={2}>{n.body}</Text>
                    </View>
                    {!n.read ? <View style={s.unreadDot} /> : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        />
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.line },
  markAllText: { fontSize: 12, fontFamily: F.bodyBold, color: C.inkSoft },

  groupLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1.5,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.line,
    backgroundColor: C.cream,
  },
  cardUnread: { backgroundColor: `${C.lime}10` },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: F.bodySemi, color: C.inkSoft },
  cardTime: { fontSize: 11, fontFamily: F.body, color: C.inkSoft, flexShrink: 0 },
  cardBody: { fontSize: 13, fontFamily: F.body, color: C.inkSoft, marginTop: 3, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.lime, alignSelf: 'center', flexShrink: 0,
  },

  emptyWrap: { alignItems: 'center', padding: 24, gap: 6 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  emptySub: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  previewLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1.5,
    alignSelf: 'flex-start', marginTop: 8, marginBottom: 4,
  },
  previewCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: C.line, width: '100%',
  },
  previewIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  previewTitle: { fontSize: 13, fontFamily: F.bodyBold, color: C.ink, marginBottom: 2 },
  previewSub: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, lineHeight: 17 },
})
