import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Modal, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { sportColors } from '@racket-app/ui'
import { colors as C, fonts as F } from '../../../components/ui'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../lib/auth-context'
import { useToast } from '../../../components/Toast'

type Message = {
  id: string; content: string; created_at: string; user_id: string
  user?: { id: string; nome: string }
}
type Member = { id: string; nome: string; avatar_url: string | null; role: string }
type GroupDetail = {
  id: string; nome: string; sport: string | null; is_admin: boolean
  members: Member[]
}
type ApiConnection = {
  id: string; nome: string; avatar_url: string | null; is_favorite?: boolean
}

const SPORT_LABEL: Record<string, string> = {
  padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis',
}

const AVATAR_COLORS = ['#2E6F9E','#D4880A','#B03A2E','#5B7A4C','#8A5A9E','#C2607F','#3A7A6E','#A0622A']

function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatTime(dt: string) {
  const d = new Date(dt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showToast } = useToast()

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const flatRef = useRef<FlatList>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  const [alreadyInGroup, setAlreadyInGroup] = useState<Set<string>>(new Set())

  const loadGroup = useCallback(async () => {
    try {
      const data = await apiGet<GroupDetail>(`/community/groups/${id}`)
      setGroup(data)
      setAlreadyInGroup(new Set(data.members.map(m => m.id)))
    } catch { /* ignore */ }
  }, [id])

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiGet<Message[]>(`/community/groups/${id}/messages`)
      setMessages(data)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => { loadGroup(); loadMessages() }, [])

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)
    try {
      await apiPost(`/community/groups/${id}/messages`, { content: text.trim() })
      setText('')
      await loadMessages()
    } catch (e: unknown) {
      showToast({ type: 'error', title: (e as { message?: string }).message ?? 'Erro ao enviar' })
    }
    setSending(false)
  }

  async function openInvite() {
    setShowInvite(true)
    setLoadingInvite(true)
    try {
      const raw = await apiGet<{ recent_players: ApiConnection[]; favorites: ApiConnection[] }>('/community/favorites')
      const favIds = new Set(raw.favorites.map(f => f.id))
      setConnections([...raw.favorites, ...(raw.recent_players ?? []).filter(r => !favIds.has(r.id))])
    } catch { /* ignore */ }
    setLoadingInvite(false)
  }

  async function inviteUser(targetId: string) {
    setInvitingUserId(targetId)
    try {
      await apiPost(`/community/groups/${id}/invite-user`, { targetUserId: targetId })
      setAlreadyInGroup(prev => new Set([...prev, targetId]))
      showToast({ type: 'success', title: 'Convidado com sucesso!' })
    } catch (e: unknown) {
      showToast({ type: 'error', title: (e as { message?: string }).message ?? 'Erro ao convidar' })
    }
    setInvitingUserId(null)
  }

  const myId = user?.id ?? ''
  const sport = group?.sport ?? null
  const accentColor = sport ? (sportColors[sport as keyof typeof sportColors] ?? C.ink) : C.ink

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {sport ? (
            <View style={[s.sportTag, { backgroundColor: `${accentColor}18` }]}>
              <Text style={[s.sportTagText, { color: accentColor }]}>{SPORT_LABEL[sport] ?? sport}</Text>
            </View>
          ) : null}
          <Text style={s.headerTitle} numberOfLines={1}>{group?.nome ?? '…'}</Text>
        </View>
        <TouchableOpacity onPress={openInvite} style={s.inviteBtn}>
          <Ionicons name="person-add-outline" size={16} color={C.ink} />
          <Text style={s.inviteBtnText}>Convidar</Text>
        </TouchableOpacity>
      </View>

      {/* Members section */}
      <View style={s.membersSection}>
        <View style={s.membersSectionHeader}>
          <Text style={s.membersSectionTitle}>
            {group?.members.length ?? 0} {(group?.members.length ?? 1) === 1 ? 'membro' : 'membros'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.membersScroll}>
          {(group?.members ?? []).map(m => (
            <View key={m.id} style={s.memberItem}>
              <View style={[s.memberAvatar, { backgroundColor: avatarColor(m.id) }]}>
                <Text style={s.memberAvatarText}>{initials(m.nome)}</Text>
                {m.role === 'admin' ? <View style={s.adminDot} /> : null}
              </View>
              <Text style={s.memberName} numberOfLines={1}>{m.nome.split(' ')[0]}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.addMemberBtn} onPress={openInvite}>
            <Ionicons name="add" size={22} color={accentColor} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={s.msgList}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <View style={[s.emptyChatIcon, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name="chatbubbles-outline" size={32} color={accentColor} />
              </View>
              <Text style={s.emptyChatTitle}>Nenhuma mensagem ainda</Text>
              <Text style={s.emptyChatSub}>Comece a conversa com o grupo!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user_id === myId
            const senderName = item.user?.nome ?? ''
            return (
              <View style={[s.msgRow, isMe && s.msgRowMe]}>
                {!isMe ? (
                  <View style={[s.msgAvatar, { backgroundColor: avatarColor(item.user_id) }]}>
                    <Text style={s.msgAvatarText}>{initials(senderName)}</Text>
                  </View>
                ) : null}
                <View style={[s.msgBubble, isMe && s.msgBubbleMe]}>
                  {!isMe ? (
                    <Text style={[s.msgSender, { color: avatarColor(item.user_id) }]}>{senderName.split(' ')[0]}</Text>
                  ) : null}
                  <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.content}</Text>
                  <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            )
          }}
        />

        {/* Input */}
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={s.textInput}
            placeholder="Mensagem…"
            placeholderTextColor={C.inkSoft}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: text.trim() ? accentColor : C.line }]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up" size={18} color={text.trim() ? '#fff' : C.inkSoft} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInvite(false)}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Convidar para o grupo</Text>
            <TouchableOpacity onPress={() => setShowInvite(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          {loadingInvite ? (
            <ActivityIndicator color={C.ink} style={{ marginTop: 48 }} />
          ) : connections.length === 0 ? (
            <View style={s.emptyConn}>
              <Ionicons name="people-outline" size={36} color={C.line} />
              <Text style={s.emptyConnText}>Jogue com alguém para poder convidá-los!</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
              <Text style={s.inviteSection}>Suas conexões</Text>
              {connections.map(c => {
                const inGroup = alreadyInGroup.has(c.id)
                return (
                  <View key={c.id} style={s.connRow}>
                    <View style={[s.connAvatar, { backgroundColor: avatarColor(c.id) }]}>
                      <Text style={s.connAvatarText}>{initials(c.nome)}</Text>
                    </View>
                    <Text style={s.connName}>{c.nome}</Text>
                    {inGroup ? (
                      <View style={s.inGroupBadge}>
                        <Ionicons name="checkmark" size={12} color={C.inkSoft} />
                        <Text style={s.inGroupText}>No grupo</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[s.addBtn, { backgroundColor: accentColor }]}
                        onPress={() => inviteUser(c.id)}
                        disabled={invitingUserId === c.id}
                        activeOpacity={0.85}
                      >
                        {invitingUserId === c.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.addBtnText}>Convidar</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.line,
    backgroundColor: C.card,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  sportTag: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
  sportTagText: { fontSize: 10, fontFamily: F.bodyBold, letterSpacing: 0.8, textTransform: 'uppercase' },
  headerTitle: { fontSize: 17, fontFamily: F.headingBold, color: C.ink, letterSpacing: -0.3 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.card,
  },
  inviteBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: C.ink },

  // Members
  membersSection: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  membersSectionHeader: { paddingHorizontal: 16, paddingTop: 10 },
  membersSectionTitle: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2 },
  membersScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  memberItem: { alignItems: 'center', gap: 5, width: 56 },
  memberAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 17, fontFamily: F.bodyBold, color: '#fff' },
  memberName: { fontSize: 11, fontFamily: F.bodySemi, color: C.inkSoft, textAlign: 'center', width: 56 },
  adminDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBF135', borderWidth: 1.5, borderColor: C.card, position: 'absolute', bottom: 2, right: 2 },
  addMemberBtn: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: C.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },

  // Messages
  msgList: { padding: 16, gap: 10, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyChatIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyChatTitle: { fontSize: 17, fontFamily: F.headingBold, color: C.ink },
  emptyChatSub: { fontSize: 13, fontFamily: F.bodySemi, color: C.inkSoft },

  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  msgAvatarText: { fontSize: 11, fontFamily: F.bodyBold, color: '#fff' },
  msgBubble: {
    maxWidth: '72%', backgroundColor: C.card,
    borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.line,
  },
  msgBubbleMe: {
    backgroundColor: C.ink, borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
    borderColor: 'transparent',
  },
  msgSender: { fontSize: 11, fontFamily: F.bodyBold, marginBottom: 3 },
  msgText: { fontSize: 14, fontFamily: F.bodySemi, color: C.ink, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, fontFamily: F.body, color: C.inkSoft, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.line,
    backgroundColor: C.card,
  },
  textInput: {
    flex: 1, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontFamily: F.bodySemi, color: C.ink,
    backgroundColor: C.cream, maxHeight: 100,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  // Invite modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  modalTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  inviteSection: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  connRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  connAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  connAvatarText: { fontSize: 15, fontFamily: F.bodyBold, color: '#fff' },
  connName: { flex: 1, fontSize: 15, fontFamily: F.bodyBold, color: C.ink },
  inGroupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.cream, borderWidth: 1, borderColor: C.line },
  inGroupText: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  addBtnText: { fontSize: 13, fontFamily: F.bodyBold, color: '#fff' },
  emptyConn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyConnText: { fontSize: 14, fontFamily: F.bodySemi, color: C.inkSoft, textAlign: 'center' },
})
