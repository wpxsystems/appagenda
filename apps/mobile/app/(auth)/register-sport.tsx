import { useState } from 'react'
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, colors, spacing, fontSize, borderRadius } from '@racket-app/ui'
import { registerDraft } from '../../lib/register-store'

const SPORTS = [
  { value: 'padel', label: 'Padel', emoji: '🎾' },
  { value: 'beach_tennis', label: 'Beach Tennis', emoji: '🏖️' },
  { value: 'tennis', label: 'Tênis', emoji: '🎾' },
] as const

type SportValue = (typeof SPORTS)[number]['value']

export default function RegisterSportScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<SportValue>>(new Set(registerDraft.sports as SportValue[]))

  function toggle(sport: SportValue) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sport)) next.delete(sport)
      else next.add(sport)
      return next
    })
  }

  function handleContinue() {
    if (selected.size === 0) return
    registerDraft.sports = Array.from(selected)
    router.push('/(auth)/register-level')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Seus esportes</Text>
          <Text style={styles.subtitle}>Passo 3 de 4 — Selecione pelo menos 1</Text>
        </View>

        <View style={styles.cards}>
          {SPORTS.map((sport) => {
            const isSelected = selected.has(sport.value)
            return (
              <TouchableOpacity
                key={sport.value}
                style={[styles.card, isSelected && styles.cardActive]}
                onPress={() => toggle(sport.value)}
                activeOpacity={0.8}
              >
                <Text style={styles.emoji}>{sport.emoji}</Text>
                <Text style={[styles.sportLabel, isSelected && styles.sportLabelActive]}>
                  {sport.label}
                </Text>
                {isSelected && <View style={styles.selectedDot} />}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.actions}>
          <Button fullWidth onPress={handleContinue} disabled={selected.size === 0}>
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
  cards: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  emoji: { fontSize: 32 },
  sportLabel: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  sportLabelActive: { color: colors.primary },
  selectedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  actions: { marginTop: spacing.xl },
})
