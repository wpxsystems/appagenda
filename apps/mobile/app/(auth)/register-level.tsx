import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button, colors, spacing, fontSize, borderRadius } from '@racket-app/ui'
import { registerDraft, resetDraft } from '../../lib/register-store'
import { useAuth } from '../../lib/auth-context'
import { apiPost } from '../../lib/api'
import type { SportProfileInput } from '@racket-app/shared'

type RacketCategory = 'C' | 'B' | 'A' | 'Open'
type SidePreference = 'left' | 'right' | 'both'
type TennisLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'
type PlayFormat = 'singles' | 'doubles' | 'both'

const CATEGORIES: { value: RacketCategory; label: string }[] = [
  { value: 'C', label: 'Categoria C' },
  { value: 'B', label: 'Categoria B' },
  { value: 'A', label: 'Categoria A' },
  { value: 'Open', label: 'Open' },
]
const SIDES: { value: SidePreference; label: string }[] = [
  { value: 'left', label: 'Esquerdo' },
  { value: 'right', label: 'Direito' },
  { value: 'both', label: 'Ambos' },
]
const TENNIS_LEVELS: { value: TennisLevel; label: string }[] = [
  { value: 'beginner', label: 'Iniciante' },
  { value: 'intermediate', label: 'Intermediário' },
  { value: 'advanced', label: 'Avançado' },
  { value: 'competitive', label: 'Competitivo' },
]
const FORMATS: { value: PlayFormat; label: string }[] = [
  { value: 'singles', label: 'Simples' },
  { value: 'doubles', label: 'Duplas' },
  { value: 'both', label: 'Ambos' },
]

function OptionRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[]
  selected: T | null
  onSelect: (v: T) => void
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.optionItem, selected === opt.value && styles.optionActive]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.optionText, selected === opt.value && styles.optionTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function RegisterLevelScreen() {
  const router = useRouter()
  const { login } = useAuth()
  const sports = registerDraft.sports

  const [padel, setPadel] = useState<{ category: RacketCategory | null; side: SidePreference | null }>({ category: null, side: null })
  const [beach, setBeach] = useState<{ category: RacketCategory | null; side: SidePreference | null }>({ category: null, side: null })
  const [tennis, setTennis] = useState<{ level: TennisLevel | null; format: PlayFormat | null }>({ level: null, format: null })
  const [loading, setLoading] = useState(false)

  function isComplete() {
    for (const sport of sports) {
      if (sport === 'padel' && (!padel.category || !padel.side)) return false
      if (sport === 'beach_tennis' && (!beach.category || !beach.side)) return false
      if (sport === 'tennis' && (!tennis.level || !tennis.format)) return false
    }
    return true
  }

  async function handleFinish() {
    if (!isComplete()) return
    setLoading(true)

    const sportProfiles: SportProfileInput[] = sports.map((sport) => {
      if (sport === 'padel') return { sport: 'padel', category: padel.category!, sidePreference: padel.side! }
      if (sport === 'beach_tennis') return { sport: 'beach_tennis', category: beach.category!, sidePreference: beach.side! }
      return { sport: 'tennis', skillLevel: tennis.level!, playFormat: tennis.format! }
    })

    try {
      const result = await apiPost<{ accessToken: string; refreshToken: string; user?: { id: string; name: string; email: string; role: string } }>(
        '/auth/register',
        {
          name: registerDraft.name,
          email: registerDraft.email,
          password: registerDraft.password,
          gender: registerDraft.gender,
          cityId: registerDraft.cityId,
          sportProfiles,
        },
      )

      const user = result.user ?? { id: '', name: registerDraft.name, email: registerDraft.email, role: 'player' }
      await login({ accessToken: result.accessToken, refreshToken: result.refreshToken }, user)
      resetDraft()
      router.replace('/(app)')
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number }
      if (e.status === 409) {
        Alert.alert('Email já cadastrado', 'Tente fazer login ou use outro email.')
      } else {
        Alert.alert('Erro no cadastro', e.message ?? 'Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const sportLabels: Record<string, string> = {
    padel: 'Padel',
    beach_tennis: 'Beach Tennis',
    tennis: 'Tênis',
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Seu nível</Text>
          <Text style={styles.subtitle}>Passo 4 de 4</Text>
        </View>

        {sports.includes('padel') && (
          <View style={styles.section}>
            <Text style={styles.sportTitle}>{sportLabels['padel']}</Text>
            <Text style={styles.fieldLabel}>Categoria</Text>
            <OptionRow options={CATEGORIES} selected={padel.category} onSelect={(v) => setPadel((p) => ({ ...p, category: v }))} />
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Lado preferido</Text>
            <OptionRow options={SIDES} selected={padel.side} onSelect={(v) => setPadel((p) => ({ ...p, side: v }))} />
          </View>
        )}

        {sports.includes('beach_tennis') && (
          <View style={styles.section}>
            <Text style={styles.sportTitle}>{sportLabels['beach_tennis']}</Text>
            <Text style={styles.fieldLabel}>Categoria</Text>
            <OptionRow options={CATEGORIES} selected={beach.category} onSelect={(v) => setBeach((p) => ({ ...p, category: v }))} />
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Lado preferido</Text>
            <OptionRow options={SIDES} selected={beach.side} onSelect={(v) => setBeach((p) => ({ ...p, side: v }))} />
          </View>
        )}

        {sports.includes('tennis') && (
          <View style={styles.section}>
            <Text style={styles.sportTitle}>{sportLabels['tennis']}</Text>
            <Text style={styles.fieldLabel}>Nível</Text>
            <OptionRow options={TENNIS_LEVELS} selected={tennis.level} onSelect={(v) => setTennis((p) => ({ ...p, level: v }))} />
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Formato</Text>
            <OptionRow options={FORMATS} selected={tennis.format} onSelect={(v) => setTennis((p) => ({ ...p, format: v }))} />
          </View>
        )}

        <View style={styles.actions}>
          <Button fullWidth onPress={handleFinish} disabled={!isComplete()} loading={loading}>
            Criar conta
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  header: { marginBottom: spacing.xl },
  title: { fontSize: fontSize['3xl'], fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  section: {
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sportTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionItem: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  optionText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  actions: { marginTop: spacing.lg },
})
