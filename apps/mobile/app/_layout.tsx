import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { colors } from '@racket-app/ui'

function RootGuard() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (isLoading) return
    const inApp = segments[0] === '(app)'
    if (isAuthenticated && !inApp) {
      router.replace('/(app)')
    } else if (!isAuthenticated && inApp) {
      router.replace('/(auth)/splash')
    }
  }, [isAuthenticated, isLoading, segments])

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
    </AuthProvider>
  )
}
