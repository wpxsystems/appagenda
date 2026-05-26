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
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Input, colors, spacing, fontSize } from '@racket-app/ui'
import { registerDraft } from '../../lib/register-store'

interface FormErrors {
  name?: string
  email?: string
  password?: string
}

function validate(name: string, email: string, password: string): FormErrors {
  const errors: FormErrors = {}
  if (name.trim().length < 2) errors.name = 'Nome deve ter pelo menos 2 caracteres'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) errors.email = 'Email inválido'
  if (password.length < 8) errors.password = 'Senha deve ter pelo menos 8 caracteres'
  return errors
}

export default function RegisterAccountScreen() {
  const router = useRouter()
  const [name, setName] = useState(registerDraft.name)
  const [email, setEmail] = useState(registerDraft.email)
  const [password, setPassword] = useState(registerDraft.password)
  const [errors, setErrors] = useState<FormErrors>({})

  function handleContinue() {
    const errs = validate(name, email, password)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    registerDraft.name = name.trim()
    registerDraft.email = email.trim().toLowerCase()
    registerDraft.password = password
    router.push('/(auth)/register-profile')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Passo 1 de 4</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Nome"
              placeholder="Seu nome completo"
              value={name}
              onChange={setName}
              error={errors.name}
            />
            <View style={styles.fieldGap} />
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
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={setPassword}
              type="password"
              error={errors.password}
            />
          </View>

          <View style={styles.actions}>
            <Button fullWidth onPress={handleContinue}>
              Continuar
            </Button>
            <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginLinkText}>Já tenho conta</Text>
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
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  form: { flex: 1 },
  fieldGap: { height: spacing.md },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  loginLink: { alignItems: 'center', paddingVertical: spacing.sm },
  loginLinkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
})
