import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Input, colors, spacing, fontSize } from '@racket-app/ui'
import { useAuth } from '../../lib/auth-context'
import { apiPost } from '../../lib/api'

interface FormErrors {
  email?: string
  password?: string
}

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido'
    if (!password) errs.password = 'Senha obrigatória'
    return errs
  }

  async function handleLogin() {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const result = await apiPost<{
        accessToken: string
        refreshToken: string
        user?: { id: string; name: string; email: string; role: string }
      }>('/auth/login', { email: email.trim().toLowerCase(), password })

      const user = result.user ?? { id: '', name: '', email: email.trim().toLowerCase(), role: 'player' }
      await login({ accessToken: result.accessToken, refreshToken: result.refreshToken }, user)
      router.replace('/(app)')
    } catch (err: unknown) {
      const e = err as { status?: number }
      if (e.status === 401) {
        Alert.alert('Credenciais inválidas', 'Verifique seu email e senha.')
      } else {
        Alert.alert('Erro ao entrar', 'Tente novamente mais tarde.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Entrar</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="seu@email.com"
              value={email}
              onChange={setEmail}
              type="email"
              error={errors.email}
            />
            <View style={styles.fieldGap} />
            <Input
              label="Senha"
              placeholder="Sua senha"
              value={password}
              onChange={setPassword}
              type="password"
              error={errors.password}
            />
          </View>

          <View style={styles.actions}>
            <Button fullWidth onPress={handleLogin} loading={loading}>
              Entrar
            </Button>
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.replace('/(auth)/register-account')}
            >
              <Text style={styles.registerLinkText}>Criar conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  header: { marginBottom: spacing.xl },
  title: { fontSize: fontSize['3xl'], fontWeight: '700', color: colors.textPrimary },
  form: { flex: 1 },
  fieldGap: { height: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  registerLink: { alignItems: 'center', paddingVertical: spacing.sm },
  registerLinkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
})
