import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Image, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPatch, apiPost, BASE_URL } from '../../lib/api'
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

  // Carrega avatar atual
  useEffect(() => {
    apiGet<{ avatar_url?: string }>('/me')
      .then(me => { if (me.avatar_url) setAvatarUrl(me.avatar_url) })
      .catch(() => {})
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
            <Text style={s.userName}>{user.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color={C.inkSoft} />
              <Text style={{ fontSize: 13, color: C.inkSoft, fontFamily: F.bodySemi }}>Joinville, SC</Text>
            </View>
          </View>
        </View>

        {/* stats */}
        <View style={s.statsRow}>
          {[['0', 'Jogos'], ['0', 'Parceiros'], ['—', 'Comparec.']].map(([n, l]) => (
            <View key={l} style={s.statCard}>
              <Text style={s.statNum}>{n}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

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
                    <Text style={[s.dayCardLabel, on && { color: C.ink }]}>{full}</Text>
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
