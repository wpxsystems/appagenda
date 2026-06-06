import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { apiPost } from '../../lib/api'
import { Btn, Input, Screen, colors as C, fonts as F } from '../../components/ui'

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const res = await apiPost<{
        accessToken: string
        refreshToken: string
        user?: { id: string; nome: string; email: string; role: string }
      }>('/auth/login', { email: email.trim().toLowerCase(), password })
      const raw = res.user
      const user = raw
        ? { id: raw.id, name: raw.nome, email: raw.email, role: raw.role }
        : { id: '', name: '', email: email.trim().toLowerCase(), role: 'player' }
      await login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, user)
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string }
      if (err.status === 401) setError('Email ou senha incorretos')
      else setError(err.message ?? 'Erro ao entrar')
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>PlayNet</Text>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Entre para encontrar jogos perto de você</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              error={error || undefined}
            />
          </View>

          <View style={{ marginTop: 24 }}>
            <Btn fullWidth onPress={submit} disabled={loading || !email || !password}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Btn>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/cadastro' as never)}>
              <Text style={styles.footerLink}>Criar conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 48 },
  header: { marginBottom: 32 },
  eyebrow: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.lime,
    textTransform: 'uppercase', letterSpacing: 3,
  },
  title: {
    fontFamily: F.headingBold, fontSize: 28, color: C.ink, marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, color: C.inkSoft, marginTop: 4, fontFamily: F.body,
  },
  form: { gap: 14 },
  footer: {
    marginTop: 20, flexDirection: 'row', justifyContent: 'center',
  },
  footerText: { fontSize: 14, color: C.inkSoft, fontFamily: F.body },
  footerLink: { fontSize: 14, fontFamily: F.bodyBold, color: C.ink },
})
