import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
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
interface DaySlot { active: boolean; from: string; to: string }
type Availability = Partial<Record<DayKey, DaySlot>>

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]
const SIDE_LABELS: Record<string, string> = { left: 'Lado esquerdo', right: 'Lado direito', both: 'Ambos os lados' }
const LEVEL_LABELS: Record<string, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado', competitive: 'Competitivo' }
const FORMAT_LABELS: Record<string, string> = { singles: 'Simples', doubles: 'Duplas', both: 'Ambos' }

const RACKET_CATEGORIES = [['C', 'C'], ['B', 'B'], ['A', 'A'], ['Open', 'Open']] as const
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
                <SegmentedPicker options={RACKET_CATEGORIES} value={category} onChange={setCategory} />
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
  const { user, logout } = useAuth()

  const [sportProfiles, setSportProfiles] = useState<SportProfile[]>([])
  const [availability, setAvailability] = useState<Availability>({})
  const [savingAvail, setSavingAvail] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalSport, setModalSport] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<SportProfile | null>(null)

  const availableSportsToAdd = ALL_SPORTS.filter(sp => !sportProfiles.find(p => p.sport === sp))

  const load = useCallback(async () => {
    try {
      const [profiles, avail] = await Promise.all([
        apiGet<SportProfile[]>('/me/sport-profiles').catch(() => []),
        apiGet<Availability>('/me/availability').catch(() => ({})),
      ])
      setSportProfiles(profiles)
      setAvailability(avail ?? {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

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
      return { ...prev, [key]: { active: !cur?.active, from: cur?.from ?? '08:00', to: cur?.to ?? '22:00' } }
    })
  }

  function setTime(key: DayKey, field: 'from' | 'to', value: string) {
    setAvailability(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { active: true, from: '08:00', to: '22:00' }), [field]: value },
    }))
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
          <Avatar name={user.name} size={68} />
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

          <View style={s.dayRow}>
            {DAYS.map(({ key, label }) => {
              const on = availability[key]?.active ?? false
              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.8}
                  onPress={() => toggleDay(key)}
                  style={[s.dayBtn, { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line }]}
                >
                  <Text style={{ fontSize: 10, fontFamily: F.bodyBold, color: on ? 'rgba(243,239,230,0.7)' : C.inkSoft }}>
                    {label}
                  </Text>
                  <Text style={{ fontFamily: F.headingBold, fontSize: 14, color: on ? C.lime : C.ink, marginTop: 1 }}>
                    {on ? '✓' : '—'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={{ gap: 8 }}>
            {DAYS.filter(d => availability[d.key]?.active).map(({ key, label }) => {
              const slot = availability[key]!
              return (
                <View key={key} style={s.timeRow}>
                  <View style={s.dayBadge}>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 12, color: C.ink }}>{label}</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.timeLabel}>das</Text>
                      <TextInput
                        value={slot.from}
                        onChangeText={(v) => setTime(key, 'from', v)}
                        placeholder="08:00"
                        placeholderTextColor={C.inkSoft}
                        style={s.timeInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.timeLabel}>até</Text>
                      <TextInput
                        value={slot.to}
                        onChangeText={(v) => setTime(key, 'to', v)}
                        placeholder="22:00"
                        placeholderTextColor={C.inkSoft}
                        style={s.timeInput}
                      />
                    </View>
                  </View>
                </View>
              )
            })}
            {Object.values(availability).every(v => !v?.active) ? (
              <View style={s.emptySports}>
                <Text style={{ color: C.inkSoft, fontSize: 13, fontFamily: F.body, textAlign: 'center' }}>
                  Toque nos dias que você costuma jogar
                </Text>
              </View>
            ) : null}
          </View>
        </View>

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
  userName: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: {
    flex: 1, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: C.line,
    backgroundColor: C.card, alignItems: 'center',
  },
  statNum: { fontFamily: F.headingBold, fontSize: 20, color: C.ink },
  statLabel: { fontSize: 11, fontFamily: F.bodySemi, color: C.inkSoft },

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
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  sportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dayBtn: { flex: 1, borderRadius: 12, padding: 8, borderWidth: 1.5, alignItems: 'center' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  dayBadge: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(203,241,53,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  timeLabel: { fontSize: 10, fontFamily: F.bodySemi, color: C.inkSoft },
  timeInput: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 13, fontFamily: F.body, color: C.ink, backgroundColor: C.cream,
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
