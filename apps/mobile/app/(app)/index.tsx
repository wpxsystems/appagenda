import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { Button, colors, spacing, fontSize } from '@racket-app/ui'
import { useAuth } from '../../lib/auth-context'

export default function HomeScreen() {
  const { user, logout } = useAuth()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.greeting}>Bem-vindo{user?.name ? `, ${user.name}` : ''}! 👋</Text>
        <Text style={styles.subtitle}>O feed de jogos será implementado em breve.</Text>
        <View style={styles.spacer} />
        <Button variant="ghost" onPress={logout}>
          Sair
        </Button>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  greeting: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.sm },
  spacer: { flex: 1 },
})
