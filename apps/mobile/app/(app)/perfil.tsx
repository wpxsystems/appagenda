import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Image, ActivityIndicator, TextInput, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPatch, apiPost, BASE_URL } from '../../lib/api'
import { useToast } from '../../components/Toast'
import { Btn, Avatar, Screen, SegmentedPicker, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

interface SportProfile {
  id: string
  sport: string
  category: string | null
  side_preference: string | null
  skill_level: string | null
  play_format: string | null
}

type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
interface TimeRange { from: string; to: string }
interface DaySlot { active: boolean; slots: TimeRange[] }
type Availability = Partial<Record<DayKey, DaySlot>>

const DAYS: { key: DayKey; label: string; full: string }[] = [
  { key: 'seg', label: 'Seg', full: 'Segunda' },
  { key: 'ter', label: 'Ter', full: 'Terça' },
  { key: 'qua', label: 'Qua', full: 'Quarta' },
  { key: 'qui', label: 'Qui', full: 'Quinta' },
  { key: 'sex', label: 'Sex', full: 'Sexta' },
  { key: 'sab', label: 'Sáb', full: 'Sábado' },
  { key: 'dom', label: 'Dom', full: 'Domingo' },
]

const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30 // 06:00 até 23:30
  const h = String(Math.floor(total / 60)).padStart(2, '0')
  const m = String(total % 60).padStart(2, '0')
  return `${h}:${m}`
})
const SIDE_LABELS: Record<string, string> = { left: 'Lado esquerdo', right: 'Lado direito', both: 'Ambos os lados' }
const LEVEL_LABELS: Record<string, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado', competitive: 'Competitivo' }
const FORMAT_LABELS: Record<string, string> = { singles: 'Simples', doubles: 'Duplas', both: 'Ambos' }

interface Cidade { id: string; nome: string; estado: string }

interface ProfileData {
  nome: string
  nickname: string
  bio: string
  phone: string
  genero: 'male' | 'female' | 'other' | ''
  data_nascimento: string
  cidade_id: string
  cidade_nome: string
  notifications_enabled: boolean
}

// Formata telefone: dígitos → (XX) XXXXX-XXXX
function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`
}

// Formata data: dígitos → DD/MM/AAAA
function fmtBirth(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`
}

// DD/MM/AAAA → AAAA-MM-DD para a API
function birthToApi(display: string): string {
  const p = display.split('/')
  if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  return ''
}

// AAAA-MM-DD → DD/MM/AAAA para exibição
function birthToDisplay(api: string): string {
  if (!api) return ''
  const p = api.split('-')
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`
  return api
}

function EditProfileModal({ visible, initial, onClose, onSaved }: {
  visible: boolean
  initial: ProfileData
  onClose: () => void
  onSaved: (data: ProfileData) => void
}) {
  const [form, setForm] = useState<ProfileData>(initial)
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [birthDisplay, setBirthDisplay] = useState('')
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [cidadeModal, setCidadeModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inlineError, setInlineError] = useState('')

  useEffect(() => {
    if (visible) {
      setForm(initial)
      setPhoneDisplay(fmtPhone(initial.phone))
      setBirthDisplay(birthToDisplay(initial.data_nascimento))
      setInlineError('')
      apiGet<Cidade[]>('/cidades').then(setCidades).catch(() => {})
    }
  }, [visible])

  function set(key: keyof ProfileData, value: string | boolean) {
    setInlineError('')
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      setInlineError('Nome precisa ter pelo menos 2 caracteres.')
      return
    }
    setSaving(true)
    setInlineError('')
    try {
      const apiDate = birthToApi(birthDisplay)
      await Promise.all([
        apiPatch('/me', {
          nome: form.nome.trim(),
          nickname: form.nickname.trim() || null,
          bio: form.bio.trim() || null,
          phone: phoneDisplay || null,
          genero: form.genero || undefined,
          data_nascimento: apiDate || null,
          notifications_enabled: form.notifications_enabled,
        }),
        form.cidade_id ? apiPatch('/me/location', { cidade_id: form.cidade_id }) : Promise.resolve(),
      ])
      onSaved({ ...form, phone: phoneDisplay, data_nascimento: apiDate })
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao salvar. Tente novamente.'
      setInlineError(msg)
      setSaving(false)
    }
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={ep.header}>
            <Text style={ep.title}>Editar perfil</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>

            {/* Nome */}
            <View>
              <Text style={ep.label}>Nome completo</Text>
              <TextInput
                style={ep.input}
                value={form.nome}
                onChangeText={v => set('nome', v)}
                placeholder="Seu nome"
                placeholderTextColor={C.inkSoft}
                autoCapitalize="words"
              />
            </View>

            {/* Apelido */}
            <View>
              <Text style={ep.label}>Apelido <Text style={ep.optional}>(opcional)</Text></Text>
              <View style={ep.prefixWrap}>
                <View style={ep.prefixBox}>
                  <Text style={ep.prefixAt}>@</Text>
                </View>
                <TextInput
                  style={ep.prefixInput}
                  value={form.nickname}
                  onChangeText={v => set('nickname', v.replace(/[^a-z0-9_.]/gi, '').toLowerCase())}
                  placeholder="seu_apelido"
                  placeholderTextColor={C.inkSoft}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Bio */}
            <View>
              <Text style={ep.label}>Bio <Text style={ep.optional}>(opcional)</Text></Text>
              <TextInput
                style={ep.textarea}
                value={form.bio}
                onChangeText={v => set('bio', v)}
                placeholder="Fale um pouco sobre você..."
                placeholderTextColor={C.inkSoft}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
            </View>

            {/* Telefone */}
            <View>
              <Text style={ep.label}>Telefone <Text style={ep.optional}>(opcional)</Text></Text>
              <View style={ep.prefixWrap}>
                <View style={ep.prefixBox}>
                  <Text style={ep.prefixAt}>🇧🇷</Text>
                </View>
                <TextInput
                  style={ep.prefixInput}
                  value={phoneDisplay}
                  onChangeText={v => setPhoneDisplay(fmtPhone(v))}
                  placeholder="(48) 99999-9999"
                  placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            </View>

            {/* Data de nascimento */}
            <View>
              <Text style={ep.label}>Data de nascimento <Text style={ep.optional}>(opcional)</Text></Text>
              <TextInput
                style={ep.input}
                value={birthDisplay}
                onChangeText={v => setBirthDisplay(fmtBirth(v))}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* Gênero */}
            <View>
              <Text style={ep.label}>Gênero</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([['male', 'Masculino'], ['female', 'Feminino'], ['other', 'Prefiro não dizer']] as const).map(([val, lbl]) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => set('genero', val)}
                    activeOpacity={0.8}
                    style={[ep.genderChip, form.genero === val && ep.genderChipActive]}
                  >
                    <Text style={[ep.genderChipText, form.genero === val && ep.genderChipTextActive]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cidade */}
            <View>
              <Text style={ep.label}>Cidade padrão</Text>
              <TouchableOpacity onPress={() => setCidadeModal(true)} activeOpacity={0.8} style={ep.cityPicker}>
                <Ionicons name="location-outline" size={16} color={C.inkSoft} />
                <Text style={[ep.cityPickerText, !form.cidade_nome && { color: C.inkSoft }]}>
                  {form.cidade_nome || 'Selecionar cidade'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={C.inkSoft} />
              </TouchableOpacity>
            </View>

            {/* Notificações */}
            <View style={ep.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={ep.switchLabel}>Notificações</Text>
                <Text style={ep.switchSub}>Receber avisos de jogos e atualizações</Text>
              </View>
              <Switch
                value={form.notifications_enabled}
                onValueChange={v => set('notifications_enabled', v)}
                trackColor={{ false: C.line, true: C.lime }}
                thumbColor="#fff"
              />
            </View>

            {inlineError ? (
              <View style={ep.inlineError}>
                <Ionicons name="alert-circle-outline" size={16} color={C.coral} />
                <Text style={ep.inlineErrorText}>{inlineError}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 4 }}>
              <Btn fullWidth onPress={save} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Btn>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* sub-modal de cidade */}
      <Modal visible={cidadeModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCidadeModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.cream }}>
          <View style={ep.header}>
            <Text style={ep.title}>Escolher cidade</Text>
            <TouchableOpacity onPress={() => setCidadeModal(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={cidades}
            keyExtractor={c => c.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.line }} />}
            renderItem={({ item }) => {
              const selected = item.id === form.cidade_id
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }}
                  onPress={() => {
                    set('cidade_id', item.id)
                    set('cidade_nome', `${item.nome}, ${item.estado}`)
                    setCidadeModal(false)
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: F.bodyBold, color: selected ? C.ink : C.inkSoft }}>{item.nome}</Text>
                    <Text style={{ fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 1 }}>{item.estado}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={C.lime} /> : null}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>
    </>
  )
}

const PADEL_CATEGORIES = [
  ['8a', '8ª'], ['7a', '7ª'], ['6a', '6ª'], ['5a', '5ª'],
  ['4a', '4ª'], ['3a', '3ª'], ['2a', '2ª'], ['Open', 'Open'],
] as const
const BEACH_CATEGORIES = [['C', 'C'], ['B', 'B'], ['A', 'A'], ['Open', 'Open']] as const
const SIDES = [['left', 'Esquerdo'], ['right', 'Direito'], ['both', 'Ambos']] as const
const LEVELS = [['beginner', 'Iniciante'], ['intermediate', 'Intermediário'], ['advanced', 'Avançado'], ['competitive', 'Competitivo']] as const
const FORMATS = [['singles', 'Simples'], ['doubles', 'Duplas'], ['both', 'Ambos']] as const
const ALL_SPORTS = ['padel', 'beach_tennis', 'tennis'] as const

function SportEditModal({ visible, sport: initialSport, existing, onClose, onSaved }: {
  visible: boolean
  sport: string | null
  existing: SportProfile | null
  onClose: () => void
  onSaved: (p: SportProfile) => void
}) {
  const [sport, setSport] = useState(initialSport ?? '')
  const [category, setCategory] = useState(existing?.category ?? 'C')
  const [side, setSide] = useState(existing?.side_preference ?? 'right')
  const [level, setLevel] = useState(existing?.skill_level ?? 'beginner')
  const [format, setFormat] = useState(existing?.play_format ?? 'doubles')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!visible) return
    setSport(initialSport ?? existing?.sport ?? '')
    setCategory(existing?.category ?? 'C')
    setSide(existing?.side_preference ?? 'right')
    setLevel(existing?.skill_level ?? 'beginner')
    setFormat(existing?.play_format ?? 'doubles')
    setErr('')
  }, [visible, initialSport, existing])

  const isAdd = !existing
  const isTennis = sport === 'tennis'

  async function save() {
    if (!sport) { setErr('Selecione um esporte'); return }
    setSaving(true); setErr('')
    try {
      const payload = isTennis
        ? { sport, skill_level: level, play_format: format }
        : { sport, category, side_preference: side }
      const result = isAdd
        ? await apiPost<SportProfile>('/me/sport-profiles', payload)
        : await apiPatch<SportProfile>(`/me/sport-profiles/${sport}`, payload)
      onSaved(result)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message
      setErr(msg ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.cream }}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>
            {existing ? `Editar ${sportLabels[sport as keyof typeof sportLabels] ?? sport}` :
              sport ? `Adicionar ${sportLabels[sport as keyof typeof sportLabels] ?? sport}` : 'Adicionar esporte'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.inkSoft} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {isAdd && !initialSport ? (
            <View>
              <Text style={s.fieldLabel}>Esporte</Text>
              <View style={{ gap: 8 }}>
                {ALL_SPORTS.map(sp => {
                  const on = sport === sp
                  const color = sportColors[sp]
                  return (
                    <TouchableOpacity key={sp} activeOpacity={0.8} onPress={() => setSport(sp)} style={[
                      s.sportPickItem,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                    ]}>
                      <View style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: color }} />
                      <Text style={{ fontSize: 14, fontFamily: F.bodyBold, color: on ? C.cream : C.ink, flex: 1 }}>
                        {sportLabels[sp]}
                      </Text>
                      {on ? <Ionicons name="checkmark" size={16} color={C.lime} /> : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ) : null}

          {sport && !isTennis ? (
            <>
              <View>
                <Text style={s.fieldLabel}>Categoria</Text>
                <SegmentedPicker
                  options={sport === 'padel' ? PADEL_CATEGORIES : BEACH_CATEGORIES}
                  value={category}
                  onChange={setCategory}
                />
              </View>
              <View>
                <Text style={s.fieldLabel}>Lado preferido</Text>
                <SegmentedPicker options={SIDES} value={side} onChange={setSide} />
              </View>
            </>
          ) : null}

          {sport && isTennis ? (
            <>
              <View>
                <Text style={s.fieldLabel}>Nível</Text>
                <SegmentedPicker options={LEVELS} value={level} onChange={setLevel} />
              </View>
              <View>
                <Text style={s.fieldLabel}>Formato</Text>
                <SegmentedPicker options={FORMATS} value={format} onChange={setFormat} />
              </View>
            </>
          ) : null}

          {err ? <Text style={{ fontSize: 13, color: C.coral, fontFamily: F.body }}>{err}</Text> : null}

          {sport ? (
            <Btn fullWidth onPress={save} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Btn>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function PerfilScreen() {
  const router = useRouter()
  const { user, logout, accessToken } = useAuth()
  const { showToast } = useToast()
  const params = useLocalSearchParams<{ sport?: string }>()

  const [sportProfiles, setSportProfiles] = useState<SportProfile[]>([])
  const [availability, setAvailability] = useState<Availability>({})
  const [savingAvail, setSavingAvail] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalSport, setModalSport] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<SportProfile | null>(null)
  const [timePicker, setTimePicker] = useState<{ day: DayKey; idx: number; field: 'from' | 'to' } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData>({
    nome: '', nickname: '', bio: '', phone: '',
    genero: '', data_nascimento: '', cidade_id: '', cidade_nome: '',
    notifications_enabled: true,
  })
  const [stats, setStats] = useState<{
    games_played: number
    games_attended: number
    avg_score: number | null
    top_badges: { key: string; count: number }[]
  } | null>(null)

  const availableSportsToAdd = ALL_SPORTS.filter(sp => !sportProfiles.find(p => p.sport === sp))

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled) return

    const asset = result.assets[0]
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: 'avatar.jpg' } as never)
      const res = await fetch(`${BASE_URL}/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      if (res.ok) {
        const data = await res.json() as { avatar_url: string }
        setAvatarUrl(data.avatar_url)
      }
    } catch { /* ignore */ } finally {
      setUploadingAvatar(false)
    }
  }

  const load = useCallback(async () => {
    try {
      const [profiles, avail] = await Promise.all([
        apiGet<SportProfile[]>('/me/sport-profiles').catch(() => []),
        apiGet<Availability>('/me/availability').catch(() => ({})),
      ])
      setSportProfiles(profiles)
      // Normaliza formato legado { from, to } → { slots: [{ from, to }] }
      const normalized: Availability = {}
      for (const [k, v] of Object.entries(avail ?? {})) {
        if (!v) continue
        const day = v as DaySlot & { from?: string; to?: string }
        normalized[k as DayKey] = {
          active: day.active,
          slots: day.slots?.length ? day.slots : [{ from: day.from ?? '08:00', to: day.to ?? '22:00' }],
        }
      }
      setAvailability(normalized)
      // Abre modal direto se veio com ?sport=xxx e usuário ainda não tem esse esporte
      if (params.sport && !profiles.find(p => p.sport === params.sport)) {
        setEditingProfile(null)
        setModalSport(params.sport)
        setModalOpen(true)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  // Carrega avatar, stats e dados editáveis do perfil
  useEffect(() => {
    Promise.all([
      apiGet<{
        avatar_url?: string; nome?: string; nickname?: string; bio?: string
        phone?: string; genero?: string; data_nascimento?: string
        notifications_enabled?: boolean; cidade_id?: string
        games_played?: number; games_attended?: number
        avg_score?: number | null; top_badges?: { key: string; count: number }[]
      }>('/me'),
      apiGet<{ cidade_id?: string; nome?: string; estado?: string }>('/me/location').catch(() => ({})),
    ]).then(([me, loc]) => {
      if (me.avatar_url) setAvatarUrl(me.avatar_url)
      setStats({
        games_played: me.games_played ?? 0,
        games_attended: me.games_attended ?? 0,
        avg_score: me.avg_score ?? null,
        top_badges: me.top_badges ?? [],
      })
      const cidadeNome = loc.nome ? `${loc.nome}, ${loc.estado ?? ''}`.trim().replace(/,$/, '') : ''
      setProfileData({
        nome: me.nome ?? '',
        nickname: me.nickname ?? '',
        bio: me.bio ?? '',
        phone: me.phone ?? '',
        genero: (me.genero as ProfileData['genero']) ?? '',
        data_nascimento: me.data_nascimento ?? '',
        cidade_id: loc.cidade_id ?? me.cidade_id ?? '',
        cidade_nome: cidadeNome,
        notifications_enabled: me.notifications_enabled ?? true,
      })
    }).catch(() => {})
  }, [])

  function openEdit(profile: SportProfile) {
    setEditingProfile(profile)
    setModalSport(profile.sport)
    setModalOpen(true)
  }
  function openAdd() {
    setEditingProfile(null)
    setModalSport(null)
    setModalOpen(true)
  }
  function closeModal() {
    setModalOpen(false)
    setEditingProfile(null)
    setModalSport(null)
  }

  function toggleDay(key: DayKey) {
    setAvailability(prev => {
      const cur = prev[key]
      return {
        ...prev,
        [key]: {
          active: !cur?.active,
          slots: cur?.slots?.length ? cur.slots : [{ from: '08:00', to: '22:00' }],
        },
      }
    })
  }

  function timeToMin(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function slotsOverlap(slots: TimeRange[], skipIdx: number, candidate: TimeRange) {
    const cFrom = timeToMin(candidate.from)
    const cTo = timeToMin(candidate.to)
    if (cTo <= cFrom) return true // "até" antes ou igual ao "das"
    return slots.some((s, i) => {
      if (i === skipIdx) return false
      return cFrom < timeToMin(s.to) && cTo > timeToMin(s.from)
    })
  }

  function setSlotTime(key: DayKey, idx: number, field: 'from' | 'to', value: string) {
    setAvailability(prev => {
      const day = prev[key] ?? { active: true, slots: [{ from: '08:00', to: '22:00' }] }
      const slots = [...(day.slots ?? [])]

      if (field === 'from') {
        // Ao mudar "das", reseta o "até" para from + 2h automaticamente
        const pad = (n: number) =>
          String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
        const toMin = Math.min(timeToMin(value) + 120, 23 * 60 + 30)
        slots[idx] = { from: value, to: pad(toMin) }
      } else {
        const updated = { ...slots[idx], to: value }
        if (slotsOverlap(slots, idx, updated)) return prev
        slots[idx] = updated
      }

      return { ...prev, [key]: { ...day, slots } }
    })
  }

  function addSlot(key: DayKey) {
    setAvailability(prev => {
      const day = prev[key] ?? { active: true, slots: [] }
      const slots = day.slots ?? []
      const pad = (n: number) =>
        String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')

      // Começa a busca a partir do fim do último slot (ordem cronológica)
      const lastEnd = slots.reduce((max, s) => Math.max(max, timeToMin(s.to)), 6 * 60)

      const tryFrom = (options: string[]) => options.find(from => {
        const fromMin = timeToMin(from)
        const toMin = fromMin + 120
        if (toMin > 23 * 60 + 30) return false
        return !slotsOverlap(slots, -1, { from, to: pad(toMin) })
      })

      // Tenta após o último slot; se não achar, tenta qualquer horário disponível
      const afterLast = TIME_OPTIONS.filter(t => timeToMin(t) >= lastEnd)
      const candidate = tryFrom(afterLast) ?? tryFrom(TIME_OPTIONS)

      if (!candidate) return prev
      const toMin = timeToMin(candidate) + 120
      return { ...prev, [key]: { ...day, slots: [...slots, { from: candidate, to: pad(toMin) }] } }
    })
  }

  function removeSlot(key: DayKey, idx: number) {
    setAvailability(prev => {
      const day = prev[key]
      if (!day) return prev
      const slots = day.slots.filter((_, i) => i !== idx)
      return { ...prev, [key]: { ...day, slots, active: slots.length > 0 } }
    })
  }

  async function saveAvailability() {
    setSavingAvail(true)
    try {
      await apiPatch('/me/availability', availability)
      setSavedMsg('Salvo!')
      setTimeout(() => setSavedMsg(''), 2000)
    } catch { /* ignore */ } finally {
      setSavingAvail(false)
    }
  }

  function handleSportSaved(profile: SportProfile) {
    setSportProfiles(prev => {
      const idx = prev.findIndex(p => p.sport === profile.sport)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = profile
        return next
      }
      return [...prev, profile]
    })
    closeModal()
  }

  if (!user) return null

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* user header */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            ) : (
              <Avatar name={user.name} size={68} />
            )}
            <View style={s.avatarEditBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size={10} color={C.ink} />
                : <Ionicons name="camera" size={12} color={C.ink} />
              }
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{profileData.nome || user.name}</Text>
            {profileData.nickname ? (
              <Text style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.bodySemi, marginTop: 1 }}>@{profileData.nickname}</Text>
            ) : null}
            {profileData.cidade_nome ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="location-outline" size={13} color={C.inkSoft} />
                <Text style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi }}>{profileData.cidade_nome}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setEditOpen(true)} activeOpacity={0.7} style={s.gearBtn} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={C.inkSoft} />
          </TouchableOpacity>
        </View>

        {/* stats */}
        <View style={s.statsRow}>
          {(() => {
            const played = stats?.games_played ?? 0
            const attended = stats?.games_attended ?? 0
            const pct = played > 0 ? Math.round((attended / played) * 100) : null
            const score = stats?.avg_score
            return [
              [String(played), 'Jogos'],
              [pct !== null ? `${pct}%` : '—', 'Comparec.'],
              [score !== null && score !== undefined ? String(score) : '—', 'Avaliação'],
            ].map(([n, l]) => (
              <View key={l} style={s.statCard}>
                <Text style={s.statNum}>{n}</Text>
                <Text style={s.statLabel}>{l}</Text>
              </View>
            ))
          })()}
        </View>

        {/* badges recebidos */}
        {(stats?.top_badges?.length ?? 0) > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={s.sectionLabel}>Reconhecimentos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {(stats?.top_badges ?? []).map(b => {
                const BADGE_META: Record<string, { icon: string; label: string }> = {
                  pontual:      { icon: '⏰', label: 'Pontual' },
                  respeitoso:   { icon: '🤝', label: 'Respeitoso' },
                  simpatico:    { icon: '😄', label: 'Simpático' },
                  competitivo:  { icon: '🔥', label: 'Competitivo' },
                  comprometido: { icon: '🎯', label: 'Comprometido' },
                  comunicativo: { icon: '💬', label: 'Comunicativo' },
                  esportivo:    { icon: '🏅', label: 'Esportivo' },
                  parceiro:     { icon: '👥', label: 'Ótimo parceiro' },
                  energia:      { icon: '⚡', label: 'Energia positiva' },
                  jogaria:      { icon: '⭐', label: 'Jogaria novamente' },
                }
                const meta = BADGE_META[b.key]
                if (!meta) return null
                return (
                  <View key={b.key} style={s.badgeChip}>
                    <Text style={s.badgeChipIcon}>{meta.icon}</Text>
                    <Text style={s.badgeChipLabel}>{meta.label}</Text>
                    <View style={s.badgeChipCount}>
                      <Text style={s.badgeChipCountText}>{b.count}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        ) : null}

        {/* sports */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Seus esportes</Text>
            {availableSportsToAdd.length > 0 ? (
              <TouchableOpacity onPress={openAdd} activeOpacity={0.8} style={s.addBtn}>
                <Ionicons name="add" size={13} color={C.ink} />
                <Text style={s.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            {sportProfiles.length === 0 ? (
              <View style={s.emptySports}>
                <Text style={{ color: C.inkSoft, fontSize: 13, fontFamily: F.body }}>
                  Nenhum esporte cadastrado
                </Text>
              </View>
            ) : null}

            {sportProfiles.map(p => {
              const color = sportColors[p.sport as keyof typeof sportColors] ?? '#888'
              const label = sportLabels[p.sport as keyof typeof sportLabels] ?? p.sport
              const detail = p.category
                ? `Cat. ${p.category}${p.side_preference ? ' · ' + (SIDE_LABELS[p.side_preference] ?? '') : ''}`
                : p.skill_level
                  ? `${LEVEL_LABELS[p.skill_level] ?? p.skill_level}${p.play_format ? ' · ' + (FORMAT_LABELS[p.play_format] ?? '') : ''}`
                  : ''
              return (
                <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => openEdit(p)} style={s.sportRow}>
                  <View style={[s.sportIcon, { backgroundColor: `${color}18` }]}>
                    <View style={{ width: 14, height: 14, borderRadius: 14, backgroundColor: color }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{label}</Text>
                    {detail ? <Text style={{ fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 }}>{detail}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.inkSoft} />
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* availability */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Disponibilidade</Text>
            <TouchableOpacity
              onPress={saveAvailability}
              disabled={savingAvail}
              activeOpacity={0.8}
              style={[s.saveBtn, { backgroundColor: savedMsg ? 'rgba(16,185,129,0.12)' : C.lime }]}
            >
              <Text style={{ fontSize: 12, fontFamily: F.bodyBold, color: savedMsg ? '#10B981' : C.ink }}>
                {savedMsg || (savingAvail ? 'Salvando…' : 'Salvar')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {DAYS.map(({ key, full }) => {
              const on = availability[key]?.active ?? false
              const slot = availability[key]
              return (
                <View key={key} style={[s.dayCard, on && s.dayCardActive]}>
                  {/* linha principal: nome + toggle */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleDay(key)}
                    style={s.dayCardHeader}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dayCardLabel, on && { color: C.ink }]}>{full}</Text>
                      {slot?.slots?.length ? (
                        <Text style={s.dayCardSummary} numberOfLines={1}>
                          {slot.slots.map(r => `${r.from}–${r.to}`).join('  ·  ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.toggle, { backgroundColor: on ? C.lime : C.line }]}>
                      <View style={[s.toggleThumb, { transform: [{ translateX: on ? 18 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>

                  {/* horários — aparece só quando ativo */}
                  {on ? (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                      {(slot?.slots ?? [{ from: '08:00', to: '22:00' }]).map((range, idx) => (
                        <View key={idx} style={s.slotCard}>
                          {idx > 0 ? (
                            <TouchableOpacity
                              onPress={() => removeSlot(key, idx)}
                              hitSlop={8}
                              style={s.slotRemove}
                            >
                              <Ionicons name="close-circle" size={18} color={C.coral} />
                            </TouchableOpacity>
                          ) : null}
                          <View style={s.dayCardTimes}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              style={s.timeChip}
                              onPress={() => setTimePicker({ day: key, idx, field: 'from' })}
                            >
                              <Text style={s.timeChipLabel}>Das</Text>
                              <Text style={s.timeChipValue}>{range.from}</Text>
                            </TouchableOpacity>
                            <Ionicons name="arrow-forward" size={14} color={C.inkSoft} />
                            <TouchableOpacity
                              activeOpacity={0.7}
                              style={s.timeChip}
                              onPress={() => setTimePicker({ day: key, idx, field: 'to' })}
                            >
                              <Text style={s.timeChipLabel}>Até</Text>
                              <Text style={s.timeChipValue}>{range.to}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      {(slot?.slots?.length ?? 1) < 3 ? (
                        <TouchableOpacity
                          onPress={() => addSlot(key)}
                          activeOpacity={0.7}
                          style={s.addSlotBtn}
                        >
                          <Ionicons name="add" size={14} color={C.inkSoft} />
                          <Text style={s.addSlotText}>Adicionar horário</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        </View>

        {/* Time picker modal */}
        <Modal
          visible={!!timePicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setTimePicker(null)}
        >
          <View style={s.timePickerWrap}>
            <View style={s.timePickerHeader}>
              <Text style={s.timePickerTitle}>
                {timePicker?.field === 'from' ? 'Horário de início' : 'Horário de término'}
              </Text>
              <TouchableOpacity onPress={() => setTimePicker(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.inkSoft} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={t => t}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.line }} />}
              renderItem={({ item }) => {
                if (!timePicker) return null
                const slots = availability[timePicker.day]?.slots ?? []
                const current = slots[timePicker.idx]?.[timePicker.field] ?? (timePicker.field === 'from' ? '08:00' : '22:00')
                const selected = item === current

                let invalid = false
                if (timePicker.field === 'from') {
                  // "Das": bloqueia só horários que caem DENTRO de outro slot existente
                  invalid = slots.some((s, i) => {
                    if (i === timePicker.idx) return false
                    const itemMin = timeToMin(item)
                    return itemMin >= timeToMin(s.from) && itemMin < timeToMin(s.to)
                  })
                } else {
                  // "Até": valida o par completo (from fixo, to = item)
                  const from = slots[timePicker.idx]?.from ?? '08:00'
                  invalid = slotsOverlap(slots, timePicker.idx, { from, to: item })
                }

                return (
                  <TouchableOpacity
                    activeOpacity={invalid ? 1 : 0.7}
                    style={[s.timeOption, invalid && { opacity: 0.3 }]}
                    onPress={() => {
                      if (invalid || !timePicker) return
                      setSlotTime(timePicker.day, timePicker.idx, timePicker.field, item)
                      setTimePicker(null)
                    }}
                  >
                    <Text style={[s.timeOptionText, selected && { color: C.ink, fontFamily: F.bodyBold }]}>
                      {item}
                    </Text>
                    {selected
                      ? <Ionicons name="checkmark-circle" size={20} color={C.lime} />
                      : invalid
                      ? <Ionicons name="ban-outline" size={16} color={C.coral} />
                      : null}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </Modal>

        {/* logout */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={async () => { await logout() }}
            activeOpacity={0.8}
            style={s.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={18} color={C.coral} />
            <Text style={{ fontSize: 14, fontFamily: F.bodyBold, color: C.coral }}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SportEditModal
        visible={modalOpen}
        sport={modalSport}
        existing={editingProfile}
        onClose={closeModal}
        onSaved={handleSportSaved}
      />

      <EditProfileModal
        visible={editOpen}
        initial={profileData}
        onClose={() => setEditOpen(false)}
        onSaved={(data) => {
          setProfileData(data)
          setEditOpen(false)
          setTimeout(() => showToast({ type: 'success', title: 'Perfil atualizado!' }), 300)
        }}
      />
    </Screen>
  )
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, paddingBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.line },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.lime,
    borderWidth: 2, borderColor: C.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.card, alignItems: 'center',
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  statNum: { fontFamily: F.headingBold, fontSize: 22, color: C.ink },
  statLabel: { fontSize: 11, fontFamily: F.bodySemi, color: C.inkSoft, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.lime, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  addBtnText: { fontSize: 12, fontFamily: F.bodyBold, color: C.ink },
  saveBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },

  badgeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.card,
  },
  badgeChipIcon: { fontSize: 14 },
  badgeChipLabel: { fontSize: 12, fontFamily: F.bodySemi, color: C.ink },
  badgeChipCount: {
    backgroundColor: C.ink, borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  badgeChipCountText: { fontSize: 10, fontFamily: F.bodyBold, color: C.lime },

  emptySports: {
    padding: 16, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: C.line, alignItems: 'center',
  },
  sportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 24, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    shadowColor: '#1A1813', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  sportIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Availability redesign
  dayCard: {
    borderRadius: 16, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line, overflow: 'hidden',
  },
  dayCardActive: { borderColor: `${C.lime}80` },
  dayCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dayCardLabel: { fontSize: 15, fontFamily: F.bodySemi, color: C.inkSoft },
  dayCardSummary: { fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft, marginTop: 2 },
  toggle: {
    width: 40, height: 24, borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dayCardTimes: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12,
  },
  timeChip: {
    flex: 1, backgroundColor: C.cream, borderRadius: 12,
    borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center',
  },
  timeChipLabel: { fontSize: 10, fontFamily: F.bodySemi, color: C.inkSoft, marginBottom: 2 },
  timeChipValue: { fontSize: 17, fontFamily: F.headingBold, color: C.ink },
  slotCard: {
    position: 'relative',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    paddingTop: 4,
  },
  slotRemove: {
    position: 'absolute',
    top: -8, right: -8,
    zIndex: 1,
    backgroundColor: C.cream,
    borderRadius: 10,
  },
  addSlotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  addSlotText: { fontSize: 13, fontFamily: F.bodySemi, color: C.inkSoft },

  // Time picker modal
  timePickerWrap: { flex: 1, backgroundColor: C.cream },
  timePickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  timePickerTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  timeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  timeOptionText: { fontSize: 17, fontFamily: F.bodySemi, color: C.inkSoft },

  gearBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: 'transparent',
  },

  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  modalTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink },
  fieldLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10,
  },
  sportPickItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 2,
  },
})

// ── EditProfileModal styles ───────────────────────────────────────────────────

const ep = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  title: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  label: { fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  optional: { fontFamily: F.body, textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  input: {
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: F.bodySemi, color: C.ink,
  },
  textarea: {
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: F.bodySemi, color: C.ink, height: 76,
  },
  prefixWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14, overflow: 'hidden',
  },
  prefixBox: {
    paddingHorizontal: 12, paddingVertical: 13,
    borderRightWidth: 1.5, borderRightColor: C.line,
    backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center',
  },
  prefixAt: { fontSize: 15, fontFamily: F.bodyBold, color: C.inkSoft },
  prefixInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: F.bodySemi, color: C.ink,
  },
  genderChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.line, backgroundColor: C.card, alignItems: 'center',
  },
  genderChipActive: { borderColor: C.ink, backgroundColor: C.ink },
  genderChipText: { fontSize: 12, fontFamily: F.bodyBold, color: C.inkSoft },
  genderChipTextActive: { color: C.lime },
  cityPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  cityPickerText: { flex: 1, fontSize: 15, fontFamily: F.bodySemi, color: C.ink },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
    borderRadius: 14, padding: 14,
  },
  switchLabel: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  switchSub: { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginTop: 2 },
  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${C.coral}15`, borderRadius: 12,
    borderWidth: 1, borderColor: `${C.coral}40`,
    padding: 12,
  },
  inlineErrorText: { flex: 1, fontSize: 13, fontFamily: F.bodySemi, color: C.coral, lineHeight: 18 },
})
