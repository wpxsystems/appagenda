import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiPost, apiGet } from '../../lib/api'
import { Btn, Input, Screen, StepDots, SegmentedPicker, colors as C, fonts as F } from '../../components/ui'
import { sportColors, sportLabels } from '@racket-app/ui'

type City = { id: string; nome: string; estado: string }
type Sport = 'padel' | 'beach_tennis' | 'tennis'

const SPORTS: Sport[] = ['padel', 'beach_tennis', 'tennis']
const PADEL_CATS = [
  ['8a', '8ª'], ['7a', '7ª'], ['6a', '6ª'], ['5a', '5ª'],
  ['4a', '4ª'], ['3a', '3ª'], ['2a', '2ª'], ['Open', 'Open'],
] as const
const PADEL_SIDES = [['left', 'Esquerdo'], ['right', 'Direito'], ['both', 'Ambos']] as const
const TENNIS_LEVELS = [['beginner', 'Iniciante'], ['intermediate', 'Intermediário'], ['advanced', 'Avançado'], ['competitive', 'Competitivo']] as const
const TENNIS_FORMATS = [['singles', 'Simples'], ['doubles', 'Duplas'], ['both', 'Ambos']] as const

const STEPS = ['Conta', 'Perfil', 'Esporte', 'Nível']

function PickerRow({ label, options, selected, onSelect }: {
  label: string
  options: readonly (readonly [string, string])[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <SegmentedPicker options={options} value={selected} onChange={onSelect} />
    </View>
  )
}

export default function CadastroScreen() {
  const router = useRouter()
  const { login } = useAuth()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [passErr, setPassErr] = useState('')

  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('')
  const [cityId, setCityId] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [citySearch, setCitySearch] = useState('')

  const [sports, setSports] = useState<Sport[]>([])
  const [profiles, setProfiles] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  useEffect(() => {
    apiGet<City[]>('/cidades').then(setCities).catch(() => {})
  }, [])

  function validateStep1() {
    let ok = true
    if (name.trim().length < 2) { setNameErr('Mínimo 2 caracteres'); ok = false } else setNameErr('')
    if (!email.includes('@')) { setEmailErr('Email inválido'); ok = false } else setEmailErr('')
    if (password.length < 8) { setPassErr('Mínimo 8 caracteres'); ok = false } else setPassErr('')
    return ok
  }

  function toggleSport(sp: Sport) {
    setSports(prev => prev.includes(sp) ? prev.filter(x => x !== sp) : [...prev, sp])
  }

  function setProfile(sport: string, key: string, value: string) {
    setProfiles(prev => ({ ...prev, [sport]: { ...(prev[sport] ?? {}), [key]: value } }))
  }

  async function submit() {
    setSubmitErr('')
    setLoading(true)
    try {
      const res = await apiPost<{
        accessToken: string
        refreshToken: string
        user?: { id: string; nome: string; email: string; role: string }
      }>('/auth/register', {
        nome: name,
        email: email.trim().toLowerCase(),
        password,
        genero: gender,
        cidade_id: cityId,
      })

      const raw = res.user
      const user = raw
        ? { id: raw.id, name: raw.nome, email: raw.email, role: raw.role }
        : { id: '', name, email, role: 'player' }
      // Login first so token is set before sending sport profiles
      await login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, user)

      // Send sport profiles separately (API has /me/sport-profiles)
      for (const sp of sports) {
        const p = profiles[sp] ?? {}
        try {
          const payload = sp === 'tennis'
            ? { sport: sp, skill_level: p.skillLevel ?? 'beginner', play_format: p.playFormat ?? 'both' }
            : { sport: sp, category: p.category ?? 'C', side_preference: p.sidePreference ?? 'both' }
          await apiPost('/me/sport-profiles', payload)
        } catch { /* ignore single failure */ }
      }
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string }
      if (err.status === 409) setSubmitErr('Este email já está cadastrado')
      else setSubmitErr(err.message ?? 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* header */}
          <View style={s.header}>
            {step > 1 ? (
              <TouchableOpacity
                onPress={() => setStep(p => p - 1)}
                style={s.backBtn}
              >
                <Ionicons name="chevron-back" size={18} color={C.ink} />
              </TouchableOpacity>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Passo {step} de 4</Text>
              <Text style={s.title}>{STEPS[step - 1]}</Text>
            </View>
          </View>

          {/* progress */}
          <View style={{ marginVertical: 20 }}>
            <StepDots step={step} total={4} />
          </View>

          {/* STEP 1 */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Input label="Nome completo" value={name} onChangeText={setName} placeholder="Seu nome" error={nameErr} />
              <Input
                label="Email" value={email} onChangeText={setEmail} placeholder="seu@email.com"
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={emailErr}
              />
              <Input
                label="Senha" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres"
                secureTextEntry error={passErr}
              />
              <Btn fullWidth onPress={() => { if (validateStep1()) setStep(2) }}>Continuar</Btn>
              <View style={s.footer}>
                <Text style={s.footerText}>Já tem conta? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                  <Text style={s.footerLink}>Entrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={s.fieldLabel}>Gênero</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['male', 'Masculino'], ['female', 'Feminino'], ['other', 'Outro']] as const).map(([val, label]) => {
                    const on = gender === val
                    return (
                      <TouchableOpacity
                        key={val}
                        activeOpacity={0.8}
                        onPress={() => setGender(val)}
                        style={[
                          s.genderBtn,
                          { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                        ]}
                      >
                        <Text style={{ color: on ? C.cream : C.inkSoft, fontFamily: F.bodyBold, fontSize: 13 }}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
              <View>
                <Text style={s.fieldLabel}>Cidade</Text>
                <View style={{ marginBottom: 8 }}>
                  <Input
                    label="Buscar cidade"
                    placeholder="Buscar cidade..."
                    value={citySearch}
                    onChangeText={setCitySearch}
                  />
                </View>
                <View style={{ gap: 8, maxHeight: 220 }}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {cities
                      .filter(c =>
                        citySearch.trim() === '' ||
                        `${c.nome} ${c.estado}`.toLowerCase().includes(citySearch.toLowerCase())
                      )
                      .map(c => {
                        const on = cityId === c.id
                        return (
                          <TouchableOpacity
                            key={c.id}
                            activeOpacity={0.8}
                            onPress={() => { setCityId(c.id); setCitySearch(`${c.nome}, ${c.estado}`) }}
                            style={[
                              s.cityItem,
                              { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
                            ]}
                          >
                            <Text style={{ fontFamily: F.bodySemi, fontSize: 14, color: on ? C.cream : C.ink, flex: 1 }}>
                              {c.nome}, {c.estado}
                            </Text>
                            {on ? <Ionicons name="checkmark" size={16} color={C.lime} /> : null}
                          </TouchableOpacity>
                        )
                      })}
                  </ScrollView>
                </View>
              </View>
              <Btn fullWidth onPress={() => setStep(3)} disabled={!gender || !cityId}>Continuar</Btn>
            </View>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 14, color: C.inkSoft, fontFamily: F.body }}>
                Selecione pelo menos um esporte
              </Text>
              {SPORTS.map(sp => {
                const on = sports.includes(sp)
                const color = sportColors[sp]
                return (
                  <TouchableOpacity
                    key={sp}
                    activeOpacity={0.8}
                    onPress={() => toggleSport(sp)}
                    style={[
                      s.sportItem,
                      { backgroundColor: on ? `${color}12` : C.card, borderColor: on ? color : C.line },
                    ]}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 12, backgroundColor: color }} />
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink, flex: 1 }}>
                      {sportLabels[sp]}
                    </Text>
                    {on ? <Ionicons name="checkmark" size={18} color={color} /> : null}
                  </TouchableOpacity>
                )
              })}
              <Btn fullWidth onPress={() => setStep(4)} disabled={sports.length === 0}>Continuar</Btn>
            </View>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <View style={{ gap: 20 }}>
              {sports.map(sp => {
                const p = profiles[sp] ?? {}
                const color = sportColors[sp]
                return (
                  <View key={sp}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: color }} />
                      <Text style={{ fontFamily: F.headingBold, fontSize: 16, color: C.ink }}>
                        {sportLabels[sp]}
                      </Text>
                    </View>
                    {sp === 'tennis' ? (
                      <View style={{ gap: 10 }}>
                        <PickerRow label="Nível" options={TENNIS_LEVELS} selected={p.skillLevel ?? ''} onSelect={v => setProfile(sp, 'skillLevel', v)} />
                        <PickerRow label="Formato" options={TENNIS_FORMATS} selected={p.playFormat ?? ''} onSelect={v => setProfile(sp, 'playFormat', v)} />
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        <PickerRow label="Categoria" options={PADEL_CATS} selected={p.category ?? ''} onSelect={v => setProfile(sp, 'category', v)} />
                        <PickerRow label="Lado" options={PADEL_SIDES} selected={p.sidePreference ?? ''} onSelect={v => setProfile(sp, 'sidePreference', v)} />
                      </View>
                    )}
                  </View>
                )
              })}
              {submitErr ? (
                <View style={s.errorBox}>
                  <Text style={{ color: C.coral, fontFamily: F.body, fontSize: 13, textAlign: 'center' }}>{submitErr}</Text>
                </View>
              ) : null}
              <Btn fullWidth onPress={submit} disabled={loading}>
                {loading ? 'Criando conta…' : 'Criar conta'}
              </Btn>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.cream,
    borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 3,
  },
  title: {
    fontFamily: F.headingBold, fontSize: 22, color: C.ink, letterSpacing: -0.5,
  },
  fieldLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
  },
  genderBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center',
  },
  cityItem: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  sportItem: {
    padding: 16, borderRadius: 20, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  errorBox: {
    padding: 12, borderRadius: 12, backgroundColor: `${C.coral}1A`,
  },
  footer: { marginTop: 12, flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14, color: C.inkSoft, fontFamily: F.body },
  footerLink: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
})
