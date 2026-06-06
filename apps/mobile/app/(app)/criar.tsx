import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
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

const PT_WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PT_MONTH = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)
const MINUTES = [0, 15, 30, 45]
const DURATIONS = [[60, '1h'], [90, '1h30'], [120, '2h']] as const
const GENDER_TYPES = [['mixed', 'Misto'], ['male', 'Masculino'], ['female', 'Feminino']] as const

function buildDays(count = 30) {
  const days: Date[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function toISO(d: Date) {
  // usa data local, não UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function scheduledAt(d: Date, h: number, m: number) {
  // constrói no horário local e converte para UTC via toISOString()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).toISOString()
}

export default function CriarScreen() {
  const router = useRouter()

  const [sport, setSport] = useState<Sport | ''>('')
  const [category, setCategory] = useState('')
  const [skillLevel, setSkillLevel] = useState('')
  const [selDay, setSelDay] = useState<Date | null>(null)
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [duration, setDuration] = useState(90)
  const [vacancies, setVacancies] = useState(4)
  const [genderType, setGenderType] = useState<'mixed' | 'male' | 'female'>('mixed')
  const [courtReserved, setCourtReserved] = useState(false)
  const [notes, setNotes] = useState('')

  const [cidadeId, setCidadeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const days = useRef(buildDays(30)).current

  useEffect(() => {
    apiGet<{ cidade_id?: string }>('/me/location')
      .then(r => {
        if (r.cidade_id) { setCidadeId(r.cidade_id); return }
        // fallback: use city from user profile
        return apiGet<{ cidade_id?: string }>('/me').then(me => setCidadeId(me.cidade_id ?? null))
      })
      .catch(() => {
        apiGet<{ cidade_id?: string }>('/me').then(me => setCidadeId(me.cidade_id ?? null)).catch(() => {})
      })
  }, [])

  async function submit() {
    setError('')
    if (!sport) { showToast({ type: 'error', title: 'Selecione um esporte' }); return }
    if (!selDay) { showToast({ type: 'error', title: 'Selecione uma data' }); return }
    if (!cidadeId) { showToast({ type: 'error', title: 'Cidade não definida no perfil' }); return }

    setSubmitting(true)
    try {
      // Check for scheduling conflict
      const myGames = await apiGet<{ scheduled_at: string; duration_minutes: number }[]>('/me/jogos')
      const newStart = new Date(scheduledAt(selDay, hour, minute)).getTime()
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
        scheduled_at: scheduledAt(selDay, hour, minute),
        duration_minutes: duration,
        vacancies_total: vacancies,
        gender_type: genderType,
        court_reserved: courtReserved,
      }
      if (notes.trim()) payload.notes = notes.trim()
      if (category) payload.target_category = category
      if (skillLevel) payload.target_skill_level = skillLevel

      await apiPost('/jogos', payload)
      showToast({ type: 'success', title: 'Jogo publicado!', message: 'Seu jogo já está visível.' })
      setTimeout(() => router.replace('/(app)/meus-jogos' as never), 1000)
    } catch (e: unknown) {
      const err = e as { message?: string }
      showToast({ type: 'error', title: err.message ?? 'Erro ao criar jogo' })
    } finally {
      setSubmitting(false)
    }
  }

  function selectSport(sp: Sport) {
    setSport(sp)
    setCategory('')
    setSkillLevel('')
  }

  const sportColor = sport ? sportColors[sport] : C.ink

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.headerWrap}>
          <Text style={s.title}>Criar jogo</Text>
          <Text style={s.subtitle}>Defina os detalhes e publique</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <View>
            <SectionLabel>Esporte</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SPORTS.map(sp => {
                const on = sport === sp
                const color = sportColors[sp]
                return (
                  <TouchableOpacity
                    key={sp}
                    onPress={() => selectSport(sp)}
                    activeOpacity={0.85}
                    style={[
                      s.sportBtn,
                      { backgroundColor: on ? color : C.card, borderColor: on ? color : C.line },
                    ]}
                  >
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: on ? '#fff' : C.inkSoft, textAlign: 'center' }}>
                      {sportLabels[sp]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Categoria — Padel e Beach Tennis */}
          {(sport === 'padel' || sport === 'beach_tennis') ? (
            <View>
              <SectionLabel>Categoria <Text style={{ color: C.inkSoft, fontSize: 11 }}>(opcional)</Text></SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(sport === 'padel' ? PADEL_CATS : BEACH_CATS).map(cat => (
                  <Pill
                    key={cat}
                    label={cat === 'Open' ? 'Open' : `Cat. ${cat}`}
                    active={category === cat}
                    onPress={() => setCategory(prev => prev === cat ? '' : cat)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Nível — Tênis */}
          {sport === 'tennis' ? (
            <View>
              <SectionLabel>Nível <Text style={{ color: C.inkSoft, fontSize: 11 }}>(opcional)</Text></SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {TENNIS_LEVELS.map(([val, lbl]) => (
                  <Pill
                    key={val}
                    label={lbl}
                    active={skillLevel === val}
                    onPress={() => setSkillLevel(prev => prev === val ? '' : val)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <SectionLabel>Data</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {days.map((d, i) => {
                const on = selDay && toISO(d) === toISO(selDay)
                const isToday = i === 0
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setSelDay(d); setError('') }}
                    activeOpacity={0.85}
                    style={[
                      s.dayCard,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : isToday ? C.inkSoft : C.line },
                    ]}
                  >
                    <Text style={{ fontSize: 10, fontFamily: F.bodyBold, color: on ? 'rgba(243,239,230,0.55)' : C.inkSoft }}>
                      {isToday ? 'Hoje' : PT_WEEKDAY[d.getDay()]}
                    </Text>
                    <Text style={{ fontFamily: F.headingBold, fontSize: 18, color: on ? C.lime : C.ink }}>
                      {d.getDate()}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: F.body, color: on ? 'rgba(243,239,230,0.4)' : C.inkSoft }}>
                      {PT_MONTH[d.getMonth()]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <View>
            <SectionLabel>Horário</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
              {HOURS.map(h => {
                const on = hour === h
                return (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setHour(h)}
                    activeOpacity={0.85}
                    style={[
                      s.hourCard,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                    ]}
                  >
                    <Text style={{ fontFamily: F.headingBold, fontSize: 16, color: on ? C.lime : C.ink }}>
                      {String(h).padStart(2, '0')}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: F.bodySemi, color: on ? 'rgba(243,239,230,0.4)' : C.inkSoft }}>
                      {h < 12 ? 'am' : 'pm'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {MINUTES.map(m => {
                const on = minute === m
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMinute(m)}
                    activeOpacity={0.85}
                    style={[
                      s.minCard,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                    ]}
                  >
                    <Text style={{ fontFamily: F.headingBold, fontSize: 16, color: on ? C.lime : C.ink }}>
                      :{String(m).padStart(2, '0')}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: F.bodySemi, color: on ? 'rgba(243,239,230,0.4)' : C.inkSoft }}>min</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View>
            <SectionLabel>Duração</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DURATIONS.map(([val, lbl]) => (
                <Pill key={val} label={lbl} active={duration === val} onPress={() => setDuration(val)} />
              ))}
            </View>
          </View>

          <View>
            <SectionLabel>Vagas abertas</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3].map(open => {
                const total = open + 1
                const on = vacancies === total
                return (
                  <TouchableOpacity
                    key={open}
                    onPress={() => setVacancies(total)}
                    activeOpacity={0.85}
                    style={[
                      s.vacancyCard,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                    ]}
                  >
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

          <View>
            <SectionLabel>Tipo</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENDER_TYPES.map(([v, l]) => (
                <Pill key={v} label={l} active={genderType === v} onPress={() => setGenderType(v as 'mixed' | 'male' | 'female')} />
              ))}
            </View>
          </View>

          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Quadra já reservada</Text>
              <Text style={s.toggleSub}>Você já garantiu o horário na arena</Text>
            </View>
            <Toggle on={courtReserved} onChange={() => setCourtReserved(v => !v)} />
          </View>

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

          {error ? (
            <View style={s.errorBox}>
              <Text style={{ color: C.coral, fontFamily: F.body, fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.85}
            style={[s.publishBtn, { backgroundColor: sportColor === C.ink ? C.lime : sportColor }]}
          >
            <Text style={s.publishBtnText}>{submitting ? 'Criando…' : 'Publicar jogo'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  headerWrap: { padding: 20, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: C.line },
  title: { fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },

  scroll: { padding: 20, gap: 24, paddingBottom: 40 },

  sportBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  dayCard: {
    width: 52, padding: 10, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', gap: 4,
  },

  hourCard: { width: 44, padding: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  minCard: { flex: 1, padding: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },

  vacancyCard: { flex: 1, padding: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', gap: 2 },
  helper: { marginTop: 6, fontSize: 11, color: C.inkSoft, fontFamily: F.body },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  toggleTitle: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
  toggleSub: { fontSize: 12, color: C.inkSoft, fontFamily: F.body, marginTop: 2 },

  notesInput: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: C.card,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.body, color: C.ink,
    minHeight: 80, textAlignVertical: 'top',
  },

  errorBox: {
    padding: 12, borderRadius: 12, backgroundColor: `${C.coral}1A`,
  },

  publishBtn: {
    borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.lime, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6,
  },
  publishBtnText: { fontFamily: F.headingBold, fontSize: 16, color: C.ink },
})
