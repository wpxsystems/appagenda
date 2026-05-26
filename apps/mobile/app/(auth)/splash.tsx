import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, colors, spacing, fontSize } from '@racket-app/ui'

export default function SplashScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.logoText}>🎾</Text>
        <Text style={styles.appName}>Racket</Text>
        <Text style={styles.tagline}>Encontre jogadores. Marque jogos.</Text>
      </View>

      <View style={styles.actions}>
        <Button fullWidth onPress={() => router.push('/(auth)/register-account')}>
          Criar conta
        </Button>
        <View style={styles.gap} />
        <Button fullWidth variant="ghost" onPress={() => router.push('/(auth)/login')}>
          Entrar
        </Button>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 72,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSize['4xl'],
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: spacing.md,
  },
  gap: {
    height: spacing.sm,
  },
})
