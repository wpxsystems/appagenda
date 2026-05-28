import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput,
  FlatList, Modal, ActivityIndicator, Alert, Share, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius } from '@racket-app/ui'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../lib/auth-context'

type Message = { id: string; content: string; createdAt: string; userId: string; name: string }
type GroupDetail = {
  id: string; name: string; sport: string | null; isAdmin: boolean
  members: { id: string; name: string; avatarUrl: string | null; role: string }[]
}
type Connection = {
  id: string; name: string
  sportProfiles: { sport: string; category: string | null; skillLevel: string | null }[]
  isFavorite: boolean; lastGameAt: string | null
}

const SPORT_LABEL: Record<string, string> = {
  padel: 'Padel', beach_tennis: 'Beach Tennis', tennis: 'Tênis',
}

const SPORT_COLOR: Record<string, string> = {
  padel: '#2E7D32',
  beach_tennis: '#B45309',
  tennis: '#1565C0',
}

function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() }

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const flatRef = useRef<FlatList>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
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
    } catch (e: any) { Alert.alert('Erro', e.message) }
    setSending(false)
  }

  async function openInvite() {
    setShowInvite(true)
    setLoadingInvite(true)
    try {
      const [inv, conn] = await Promise.all([
        apiPost<{ code: string; link: string }>(`/community/groups/${id}/invite`, {}),
        apiGet<{ recentPlayers: Connection[]; favorites: Connection[] }>('/community/favorites'),
      ])
      setInviteCode(inv.code)
      setInviteLink(inv.link)
      const all = [
        ...conn.favorites,
        ...conn.recentPlayers.filter(r => !conn.favorites.find(f => f.id === r.id)),
      ]
      setConnections(all)
    } catch (e: any) { Alert.alert('Erro', e.message) }
    setLoadingInvite(false)
  }

  async function shareLink() {
    if (!inviteLink) return
    await Share.share({ message: `Entre no grupo "${group?.name}" no Racket App! Use o código: ${inviteCode}\n${inviteLink}` })
  }

  async function inviteUser(targetId: string) {
    setInvitingUserId(targetId)
    try {
      await apiPost(`/community/groups/${id}/invite-user`, { targetUserId: targetId })
      setAlreadyInGroup(prev => new Set([...prev, targetId]))
      Alert.alert('Convidado!', 'A pessoa foi adicionada ao grupo.')
    } catch (e: any) {
      if (e.message?.includes('already')) Alert.alert('', 'Essa pessoa já está no grupo.')
      else Alert.alert('Erro', e.message)
    }
    setInvitingUserId(null)
  }

  const myId = user?.id ?? ''
  const sportColor = group?.sport ? (SPORT_COLOR[group.sport] ?? colors.secondary) : colors.secondary
  const visibleMembers = group?.members.slice(0, 5) ?? []
  const extraMembers = (group?.members.length ?? 0) - visibleMembers.length

  return (
    <SafeAreaView style={styles.safe}>
      {/* Colored header */}
      <View style={[styles.header, { backgroundColor: sportColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {group?.sport && (
            <Text style={styles.headerSport}>{SPORT_LABEL[group.sport] ?? group.sport}</Text>
          )}
          <Text style={styles.headerTitle}>{group?.name ?? '...'}</Text>
        </View>
        <Text style={styles.memberCount}>
          {group?.members.length ?? 0} {(group?.members.length ?? 0) === 1 ? 'membro' : 'membros'}
        </Text>
      </View>

      {/* Action bar: member avatars + buttons */}
      <View style={styles.actionBar}>
        <View style={styles.avatarRow}>
          {visibleMembers.map((m, i) => (
            <View key={m.id} style={[styles.memberAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, backgroundColor: sportColor }]}>
              <Text style={styles.memberAvatarText}>{initials(m.name)}</Text>
            </View>
          ))}
          {extraMembers > 0 && (
            <View style={[styles.memberAvatar, { marginLeft: -10, backgroundColor: colors.border }]}>
              <Text style={[styles.memberAvatarText, { color: colors.textSecondary }]}>+{extraMembers}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionBtns}>
          <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
            <Ionicons name="person-add-outline" size={15} color={colors.textPrimary} />
            <Text style={styles.inviteBtnText}>Convidar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scheduleBtn} onPress={() => Alert.alert('Em breve', 'Marcar jogo pelo grupo chegará em breve!')}>
            <Ionicons name="add" size={15} color={colors.textPrimary} />
            <Text style={styles.scheduleBtnText}>Marcar jogo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.msgList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>👋</Text>
              <Text style={styles.emptyChatTitle}>Ninguém falou ainda</Text>
              <Text style={styles.emptyChatSub}>Seja o primeiro a mandar uma mensagem!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.userId === myId
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <View style={[styles.msgAvatar, { backgroundColor: sportColor }]}>
                    <Text style={styles.msgAvatarText}>{initials(item.name)}</Text>
                  </View>
                )}
                <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                  {!isMe && <Text style={styles.msgSender}>{item.name}</Text>}
                  <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
                </View>
              </View>
            )
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Mensagem..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Convidar para o grupo</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {loadingInvite ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inviteSectionLabel}>Link de convite</Text>
                <View style={styles.codeRow}>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{inviteCode}</Text>
                  </View>
                  <TouchableOpacity style={styles.shareBtn} onPress={shareLink}>
                    <Ionicons name="share-social-outline" size={18} color="#fff" />
                    <Text style={styles.shareBtnText}>Compartilhar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.codeHint}>Qualquer pessoa com este código pode entrar no grupo.</Text>

                {connections.length > 0 && (
                  <>
                    <Text style={[styles.inviteSectionLabel, { marginTop: spacing.lg }]}>Suas conexões</Text>
                    {connections.map(c => {
                      const inGroup = alreadyInGroup.has(c.id)
                      const sportLabel = c.sportProfiles
                        .map(p => `${SPORT_LABEL[p.sport] ?? p.sport}${p.category ? ` · Cat. ${p.category}` : ''}`)
                        .join(' • ')
                      return (
                        <View key={c.id} style={styles.connRow}>
                          <View style={[styles.connAvatar, { backgroundColor: sportColor }]}>
                            <Text style={styles.connAvatarText}>{initials(c.name)}</Text>
                          </View>
                          <View style={styles.connInfo}>
                            <Text style={styles.connName}>{c.name}</Text>
                            {sportLabel ? <Text style={styles.connSport}>{sportLabel}</Text> : null}
                          </View>
                          {inGroup ? (
                            <View style={styles.inGroupBadge}>
                              <Text style={styles.inGroupText}>No grupo</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.addBtn}
                              onPress={() => inviteUser(c.id)}
                              disabled={invitingUserId === c.id}
                            >
                              {invitingUserId === c.id
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.addBtnText}>Adicionar</Text>}
                            </TouchableOpacity>
                          )}
                        </View>
                      )
                    })}
                  </>
                )}
                {connections.length === 0 && (
                  <Text style={styles.emptyConn}>Você ainda não tem conexões. Jogue com alguém para poder convidá-los!</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  backBtn: { width: 34, height: 34, borderRadius: borderRadius.md, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerSport: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '800', color: '#fff' },
  memberCount: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  // Action bar
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  memberAvatarText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: spacing.sm },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  inviteBtnText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textPrimary },
  scheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: '#BFFF3C' },
  scheduleBtnText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textPrimary },

  // Messages
  msgList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyChatEmoji: { fontSize: 40, marginBottom: spacing.md },
  emptyChatTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  emptyChatSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  msgRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '700' },
  msgBubble: { maxWidth: '72%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderBottomLeftRadius: 4, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  msgBubbleMe: { backgroundColor: colors.textPrimary, borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: 4, borderColor: 'transparent' },
  msgSender: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  msgText: { fontSize: fontSize.sm, color: colors.textPrimary },
  msgTextMe: { color: '#fff' },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  textInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: colors.textPrimary, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  // Invite modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },
  inviteSectionLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  codeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  codeBox: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  codeText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary, letterSpacing: 4 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.md },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  codeHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  connAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  connAvatarText: { color: '#fff', fontWeight: '700' },
  connInfo: { flex: 1 },
  connName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  connSport: { fontSize: fontSize.xs, color: colors.textSecondary },
  inGroupBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  inGroupText: { fontSize: fontSize.xs, color: colors.textMuted },
  addBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.xs },
  emptyConn: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.md },
})
