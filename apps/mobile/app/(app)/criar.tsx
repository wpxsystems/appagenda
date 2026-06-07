import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { apiPost, apiGet } from '../../lib/api'
import { Btn, Pill, SectionLabel, Toggle, Screen, colors as C, fonts as F } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { sportColors, sportLabels } from '@racket-app/ui'

type Sport = 'padel' | 'beach_tennis' | 'tennis'

const SPORTS: Sport[] = ['padel', 'beach_tennis', 'tennis']
const PADEL_CATS = ['8a','7a','6a','5a','4a','3a','2a','Open'] as const
const BEACH_CATS = ['C','B','A','Open'] as const
const TENNIS_LEVELS = [['beginner','Iniciante'],['intermediate','Intermediário'],['advanced','Avançado'],['competitive','Competitivo']] as const
const GENDER_TYPES = [['mixed', 'Misto'], ['male', 'Masculino'], ['female', 'Feminino']] as const

const PT_WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PT_MONTH_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Horários de 06:00 até 23:30 de 30 em 30 min
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}


function buildScheduledAt(d: Date, timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).toISOString()
}

function formatCurrency(raw: string) {
  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Trata como centavos: "1234" → "12,34"
  const cents = parseInt(digits, 10)
  const reais = Math.floor(cents / 100)
  const centavos = cents % 100
  return `R$ ${reais.toLocaleString('pt-BR')},${String(centavos).padStart(2, '0')}`
}

function parseCurrency(formatted: string): number {
  const digits = formatted.replace(/\D/g, '')
  return parseInt(digits || '0', 10) / 100
}

function formatDuration(startTime: string, endTime: string) {
  const diff = timeToMin(endTime) - timeToMin(startTime)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${m}min`
}

export default function CriarScreen() {
  const router = useRouter()

  const [sport, setSport] = useState<Sport | ''>('')
  const [category, setCategory] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [selDay, setSelDay] = useState<Date | null>(null)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })
  const [calOpen, setCalOpen] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [timePicker, setTimePicker] = useState<'start' | 'end' | null>(null)
  const [vacancies, setVacancies] = useState(4)
  const [genderType, setGenderType] = useState<'mixed' | 'male' | 'female'>('mixed')
  const [courtReserved, setCourtReserved] = useState(false)
  const [courtPrice, setCourtPrice] = useState('')
  const [notes, setNotes] = useState('')

  const [cidadeId, setCidadeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    apiGet<{ cidade_id?: string }>('/me/location')
      .then(r => {
        if (r.cidade_id) { setCidadeId(r.cidade_id); return }
        return apiGet<{ cidade_id?: string }>('/me').then(me => setCidadeId(me.cidade_id ?? null))
      })
      .catch(() => {
        apiGet<{ cidade_id?: string }>('/me').then(me => setCidadeId(me.cidade_id ?? null)).catch(() => {})
      })
  }, [])

  const duration = Math.max(0, timeToMin(endTime) - timeToMin(startTime))

  async function submit() {
    if (!sport) { showToast({ type: 'error', title: 'Selecione um esporte' }); return }
    if (!selDay) { showToast({ type: 'error', title: 'Selecione uma data' }); return }
    if (duration <= 0) { showToast({ type: 'error', title: 'Horário de fim deve ser após o início' }); return }
    if (!cidadeId) { showToast({ type: 'error', title: 'Cidade não definida no perfil' }); return }

    setSubmitting(true)
    try {
      const myGames = await apiGet<{ scheduled_at: string; duration_minutes: number }[]>('/me/jogos')
      const newStart = new Date(buildScheduledAt(selDay, startTime)).getTime()
      const conflict = myGames.find(g => {
        const start = new Date(g.scheduled_at).getTime()
        const end = start + g.duration_minutes * 60_000
        return newStart >= start && newStart < end
      })
      if (conflict) {
        showToast({ type: 'error', title: 'Conflito de horário', message: 'Você já tem um jogo neste horário.' })
        return
      }

      const payload: Record<string, unknown> = {
        sport,
        cidade_id: cidadeId,
        scheduled_at: buildScheduledAt(selDay, startTime),
        duration_minutes: duration,
        vacancies_total: vacancies,
        gender_type: genderType,
        court_reserved: courtReserved,
      }
      if (notes.trim()) payload.notes = notes.trim()
      // Padel categories só funcionam após deploy da API — beach tennis OK agora
      if (category && (sport === 'beach_tennis' || ['C','B','A','Open'].includes(category))) {
        payload.target_category = category
      }
      if (skillLevel) payload.target_skill_level = skillLevel
      if (courtReserved && courtPrice) payload.court_price_per_person = parseCurrency(courtPrice)

      await apiPost('/jogos', payload)
      showToast({ type: 'success', title: 'Jogo publicado!', message: 'Seu jogo já está visível.' })
      setTimeout(() => router.replace('/(app)/meus-jogos' as never), 1000)
    } catch (e: unknown) {
      const err = e as { message?: string; body?: { details?: { path: string[]; message: string }[] } }
      const detail = err.body?.details?.[0]
      const msg = detail ? `${detail.path.join('.')}: ${detail.message}` : (err.message ?? 'Erro ao criar jogo')
      showToast({ type: 'error', title: msg })
    } finally {
      setSubmitting(false)
    }
  }

  function selectSport(sp: Sport) { setSport(sp); setCategory(''); setSkillLevel('') }

  const sportColor = sport ? sportColors[sport] : C.ink
  const durationLabel = formatDuration(startTime, endTime)

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.headerWrap}>
          <Text style={s.title}>Criar jogo</Text>
          <Text style={s.subtitle}>Defina os detalhes e publique</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Esporte */}
          <View>
            <SectionLabel>Esporte</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SPORTS.map(sp => {
                const on = sport === sp
                const color = sportColors[sp]
                return (
                  <TouchableOpacity key={sp} onPress={() => selectSport(sp)} activeOpacity={0.85}
                    style={[s.sportBtn, { backgroundColor: on ? color : C.card, borderColor: on ? color : C.line }]}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: on ? '#fff' : C.inkSoft, textAlign: 'center' }}>
                      {sportLabels[sp]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Categoria */}
          {(sport === 'padel' || sport === 'beach_tennis') ? (
            <View>
              <SectionLabel>Categoria <Text style={{ color: C.inkSoft, fontSize: 11 }}>(opcional)</Text></SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(sport === 'padel' ? PADEL_CATS : BEACH_CATS).map(cat => (
                  <Pill key={cat} label={cat === 'Open' ? 'Open' : `Cat. ${cat}`}
                    active={category === cat} onPress={() => setCategory(prev => prev === cat ? '' : cat)} />
                ))}
              </View>
            </View>
          ) : null}

          {sport === 'tennis' ? (
            <View>
              <SectionLabel>Nível <Text style={{ color: C.inkSoft, fontSize: 11 }}>(opcional)</Text></SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TENNIS_LEVELS.map(([val, lbl]) => (
                  <Pill key={val} label={lbl} active={skillLevel === val}
                    onPress={() => setSkillLevel(prev => prev === val ? '' : val)} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Data */}
          <View>
            <SectionLabel>Data</SectionLabel>
            <TouchableOpacity onPress={() => setCalOpen(true)} activeOpacity={0.8} style={s.dateBtn}>
              <Ionicons name="calendar-outline" size={18} color={selDay ? C.ink : C.inkSoft} />
              <Text style={[s.dateBtnText, selDay && { color: C.ink, fontFamily: F.bodyBold }]}>
                {selDay
                  ? selDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
                  : 'Selecionar data'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          {/* Horário — início e fim */}
          <View>
            <SectionLabel>Horário</SectionLabel>
            <View style={s.timeRow}>
              <TouchableOpacity style={s.timeChip} activeOpacity={0.7} onPress={() => setTimePicker('start')}>
                <Text style={s.timeChipLabel}>Início</Text>
                <Text style={s.timeChipValue}>{startTime}</Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={18} color={C.inkSoft} />
              <TouchableOpacity style={s.timeChip} activeOpacity={0.7} onPress={() => setTimePicker('end')}>
                <Text style={s.timeChipLabel}>Fim</Text>
                <Text style={s.timeChipValue}>{endTime}</Text>
              </TouchableOpacity>
            </View>
            {durationLabel ? (
              <Text style={s.durationHint}>
                <Ionicons name="time-outline" size={12} color={C.inkSoft} /> Duração: {durationLabel}
              </Text>
            ) : (
              <Text style={s.durationHintError}>O horário de fim deve ser depois do início</Text>
            )}
          </View>

          {/* Vagas */}
          <View>
            <SectionLabel>Vagas abertas</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3].map(open => {
                const total = open + 1
                const on = vacancies === total
                return (
                  <TouchableOpacity key={open} onPress={() => setVacancies(total)} activeOpacity={0.85}
                    style={[s.vacancyCard, { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line }]}>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 18, color: on ? C.lime : C.ink }}>{open}</Text>
                    <Text style={{ fontSize: 9, fontFamily: F.bodySemi, color: on ? 'rgba(243,239,230,0.4)' : C.inkSoft }}>
                      vaga{open > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.helper}>Você já está dentro — total de {vacancies} jogadores</Text>
          </View>

          {/* Tipo */}
          <View>
            <SectionLabel>Tipo</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENDER_TYPES.map(([v, l]) => (
                <Pill key={v} label={l} active={genderType === v}
                  onPress={() => setGenderType(v as 'mixed' | 'male' | 'female')} />
              ))}
            </View>
          </View>

          {/* Quadra reservada */}
          <View style={{ gap: 10 }}>
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Quadra já reservada</Text>
                <Text style={s.toggleSub}>Você já garantiu o horário na arena</Text>
              </View>
              <Toggle on={courtReserved} onChange={() => setCourtReserved(v => !v)} />
            </View>

            {courtReserved ? (
              <View style={s.priceRow}>
                <Ionicons name="cash-outline" size={18} color={C.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={s.priceLabel}>Valor por pessoa (R$)</Text>
                  <TextInput
                    value={courtPrice}
                    onChangeText={v => setCourtPrice(formatCurrency(v))}
                    placeholder="R$ 0,00"
                    placeholderTextColor={C.inkSoft}
                    keyboardType="numeric"
                    style={s.priceInput}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {/* Observações */}
          <View>
            <SectionLabel>Observações</SectionLabel>
            <TextInput
              placeholder="Algo importante? (opcional)"
              placeholderTextColor={C.inkSoft}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={s.notesInput}
            />
          </View>

          <TouchableOpacity onPress={submit} disabled={submitting} activeOpacity={0.85}
            style={[s.publishBtn, { backgroundColor: sportColor === C.ink ? C.lime : sportColor }]}>
            <Text style={s.publishBtnText}>{submitting ? 'Criando…' : 'Publicar jogo'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendário modal */}
      <Modal visible={calOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCalOpen(false)}>
        <View style={s.pickerWrap}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Escolher data</Text>
            <TouchableOpacity onPress={() => setCalOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <View style={s.calHeader}>
              <TouchableOpacity onPress={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={C.ink} />
              </TouchableOpacity>
              <Text style={s.calMonthLabel}>{PT_MONTH_LONG[calMonth.getMonth()]} {calMonth.getFullYear()}</Text>
              <TouchableOpacity onPress={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>
            <View style={s.calWeekRow}>
              {PT_WEEKDAY_SHORT.map(d => <Text key={d} style={s.calWeekLabel}>{d}</Text>)}
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
                <View key={wi} style={s.calWeekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={s.calCell} />
                    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
                    date.setHours(0,0,0,0)
                    const isPast = date < today
                    const isToday = date.getTime() === today.getTime()
                    const isSelected = selDay?.getTime() === date.getTime()
                    return (
                      <TouchableOpacity key={di} disabled={isPast} activeOpacity={0.7}
                        onPress={() => { setSelDay(date); setCalOpen(false) }}
                        style={[s.calCell, isSelected && s.calCellSelected, isToday && !isSelected && s.calCellToday]}>
                        <Text style={[s.calCellText, isPast && { color: C.line },
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

      {/* Time picker modal */}
      <Modal visible={!!timePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTimePicker(null)}>
        <View style={s.pickerWrap}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>
              {timePicker === 'start' ? 'Horário de início' : 'Horário de término'}
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
              const current = timePicker === 'start' ? startTime : endTime
              const selected = item === current
              // Para "fim", bloqueia horários antes ou igual ao início
              const invalid = timePicker === 'end' && timeToMin(item) <= timeToMin(startTime)
              return (
                <TouchableOpacity
                  activeOpacity={invalid ? 1 : 0.7}
                  style={[s.pickerOption, invalid && { opacity: 0.3 }]}
                  onPress={() => {
                    if (invalid) return
                    if (timePicker === 'start') {
                      setStartTime(item)
                      // Auto-ajusta fim para início + 1h30 se necessário
                      const newEnd = timeToMin(item) + 90
                      if (newEnd > timeToMin(endTime) || timeToMin(endTime) <= timeToMin(item)) {
                        const h = Math.floor(newEnd / 60); const m = newEnd % 60
                        setEndTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
                      }
                    } else {
                      setEndTime(item)
                    }
                    setTimePicker(null)
                  }}
                >
                  <Text style={[s.pickerOptionText, selected && { color: C.ink, fontFamily: F.bodyBold }]}>
                    {item}
                  </Text>
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
  headerWrap: { padding: 20, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: C.line },
  title: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },
  scroll: { padding: 20, gap: 24, paddingBottom: 40 },

  sportBtn: { flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  // Data
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: C.line,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dateBtnText: { flex: 1, fontSize: 14, fontFamily: F.bodySemi, color: C.inkSoft },

  // Calendário (modal)
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  calMonthLabel: { fontFamily: F.bodyBold, fontSize: 17, color: C.ink },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: F.bodySemi, color: C.inkSoft, paddingBottom: 8 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, margin: 2 },
  calCellSelected: { backgroundColor: C.ink },
  calCellToday: { backgroundColor: `${C.lime}50` },
  calCellText: { fontSize: 15, fontFamily: F.bodySemi, color: C.inkSoft },

  // Horário
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeChip: {
    flex: 1, backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.line, padding: 8, alignItems: 'center', gap: 2,
  },
  timeChipLabel: { fontSize: 9, fontFamily: F.bodySemi, color: C.inkSoft },
  timeChipValue: { fontSize: 18, fontFamily: F.headingBold, color: C.ink, letterSpacing: -0.3 },
  durationHint: { marginTop: 8, fontSize: 12, color: C.inkSoft, fontFamily: F.bodySemi },
  durationHintError: { marginTop: 8, fontSize: 12, color: C.coral, fontFamily: F.bodySemi },

  vacancyCard: { flex: 1, padding: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  helper: { marginTop: 6, fontSize: 11, color: C.inkSoft, fontFamily: F.body },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  toggleTitle: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  toggleSub: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },

  // Valor por pessoa
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.lime,
  },
  priceLabel: { fontSize: 11, fontFamily: F.bodySemi, color: C.inkSoft, marginBottom: 4 },
  priceInput: {
    fontSize: 20, fontFamily: F.headingBold, color: C.ink, padding: 0, minWidth: 80,
  },

  notesInput: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: C.card,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.body, color: C.ink,
    minHeight: 80, textAlignVertical: 'top',
  },

  publishBtn: {
    borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.lime, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6,
  },
  publishBtnText: { fontFamily: F.headingBold, fontSize: 16, color: C.ink },

  // Time picker modal
  pickerWrap: { flex: 1, backgroundColor: C.cream },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  pickerTitle: { fontFamily: F.headingBold, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  pickerOptionText: { fontSize: 17, fontFamily: F.bodySemi, color: C.inkSoft },
})
