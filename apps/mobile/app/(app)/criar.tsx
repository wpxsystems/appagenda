import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { apiPost, apiGet } from '../../lib/api'
import { Btn, Pill, SectionLabel, Toggle, Screen, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

type Sport = 'padel' | 'beach_tennis' | 'tennis'

const SPORTS: Sport[] = ['padel', 'beach_tennis', 'tennis']
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

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function scheduledAt(d: Date, h: number, m: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toISO(d)}T${pad(h)}:${pad(m)}:00.000Z`
}

export default function CriarScreen() {
  const router = useRouter()

  const [sport, setSport] = useState<Sport | ''>('')
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

  const days = useRef(buildDays(30)).current

  useEffect(() => {
    apiGet<{ cidade_id?: string }>('/me/location').then(r => setCidadeId(r.cidade_id ?? null)).catch(() => {})
  }, [])

  async function submit() {
    setError('')
    if (!sport) { setError('Selecione um esporte'); return }
    if (!selDay) { setError('Selecione uma data'); return }
    if (!cidadeId) { setError('Cidade não definida no perfil'); return }

    setSubmitting(true)
    try {
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

      await apiPost('/jogos', payload)
      router.replace('/meus-jogos' as never)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setError(err.message ?? 'Erro ao criar jogo')
    } finally {
      setSubmitting(false)
    }
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
            <View style={{ gap: 8 }}>
              {SPORTS.map(sp => {
                const on = sport === sp
                const color = sportColors[sp]
                return (
                  <TouchableOpacity
                    key={sp}
                    onPress={() => setSport(sp)}
                    activeOpacity={0.85}
                    style={[
                      s.sportRow,
                      { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                    ]}
                  >
                    <View style={[s.sportBar, { backgroundColor: color }]} />
                    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
                      <Text style={{ fontFamily: F.headingBold, fontSize: 15, color: on ? C.cream : C.ink }}>
                        {sportLabels[sp]}
                      </Text>
                    </View>
                    {on ? (
                      <View style={s.checkCircle}>
                        <Ionicons name="checkmark" size={13} color={C.ink} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

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

          <Btn fullWidth onPress={submit} disabled={submitting} style={{ backgroundColor: sportColor === C.ink ? C.lime : sportColor }}>
            {submitting ? 'Criando…' : 'Publicar jogo'}
          </Btn>
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

  sportRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 2, overflow: 'hidden',
  },
  sportBar: { width: 6, alignSelf: 'stretch' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
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
})
