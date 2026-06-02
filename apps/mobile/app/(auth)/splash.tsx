import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Btn, Screen, colors as C, fonts as F } from '../../components/ui'

export default function SplashScreen() {
  const router = useRouter()

  return (
    <Screen>
      <View style={s.container}>
        <View style={s.logoArea}>
          <Text style={s.logoText}>🎾</Text>
          <Text style={s.eyebrow}>Racket App</Text>
          <Text style={s.appName}>AppAgenda</Text>
          <Text style={s.tagline}>Encontre jogadores. Marque jogos.</Text>
        </View>

        <View style={s.actions}>
          <Btn fullWidth onPress={() => router.push('/(auth)/cadastro' as never)}>
            Criar conta
          </Btn>
          <View style={{ height: 12 }} />
          <Btn fullWidth variant="ghost" onPress={() => router.push('/(auth)/login')}>
            Entrar
          </Btn>
        </View>
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  logoArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 72, marginBottom: 16 },
  eyebrow: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.lime,
    textTransform: 'uppercase', letterSpacing: 3,
  },
  appName: {
    fontSize: 38, fontFamily: F.headingBold, color: C.ink,
    letterSpacing: -1, marginTop: 4,
  },
  tagline: {
    fontSize: 14, color: C.inkSoft, fontFamily: F.body,
    marginTop: 8, textAlign: 'center',
  },
  actions: { paddingBottom: 12 },
})
