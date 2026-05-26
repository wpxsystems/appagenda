import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button, colors, spacing, fontSize, borderRadius } from '@racket-app/ui'
import { apiGet } from '../../lib/api'
import { registerDraft } from '../../lib/register-store'
import type { Gender } from '@racket-app/shared'

interface City {
  id: string
  name: string
  state: string
  slug: string | null
}

const GENDER_OPTIONS: { value: (typeof Gender)[number]; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'other', label: 'Outro' },
]

export default function RegisterProfileScreen() {
  const router = useRouter()
  const [gender, setGender] = useState<(typeof Gender)[number] | null>(registerDraft.gender)
  const [cityId, setCityId] = useState<string | null>(registerDraft.cityId)
  const [cities, setCities] = useState<City[]>([])
  const [loadingCities, setLoadingCities] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<City[]>('/cities')
      .then(setCities)
      .catch(() => setError('Não foi possível carregar as cidades'))
      .finally(() => setLoadingCities(false))
  }, [])

  function handleContinue() {
    if (!gender || !cityId) return
    registerDraft.gender = gender
    registerDraft.cityId = cityId
    router.push('/(auth)/register-sport')
  }

  const canContinue = !!gender && !!cityId

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Seu perfil</Text>
          <Text style={styles.subtitle}>Passo 2 de 4</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Gênero</Text>
          <View style={styles.segmented}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segmentItem, gender === opt.value && styles.segmentActive]}
                onPress={() => setGender(opt.value)}
              >
                <Text
                  style={[styles.segmentText, gender === opt.value && styles.segmentTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cidade onde quer jogar</Text>
          {loadingCities ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <View style={styles.cityList}>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city.id}
                  style={[styles.cityItem, cityId === city.id && styles.cityItemActive]}
                  onPress={() => setCityId(city.id)}
                >
                  <Text
                    style={[styles.cityText, cityId === city.id && styles.cityTextActive]}
                  >
                    {city.name} — {city.state}
                  </Text>
                  {cityId === city.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              {cities.length === 0 && (
                <Text style={styles.emptyText}>
                  Sua cidade ainda não tem jogos — entre na lista de espera
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button fullWidth onPress={handleContinue} disabled={!canContinue}>
            Continuar
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
  section: { marginBottom: spacing.xl },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  segmentText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },
  cityList: { gap: spacing.sm },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cityItemActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  cityText: { fontSize: fontSize.base, color: colors.textPrimary },
  cityTextActive: { color: colors.primary, fontWeight: '600' },
  checkmark: { color: colors.primary, fontWeight: '700', fontSize: fontSize.base },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  errorText: { fontSize: fontSize.sm, color: colors.error },
  actions: { marginTop: 'auto', paddingTop: spacing.lg },
})
