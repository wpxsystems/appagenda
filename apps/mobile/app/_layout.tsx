import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts as useArchivo, Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo'
import { useFonts as useBricolage, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque'
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  const [archivoLoaded] = useArchivo({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  })
  const [bricolageLoaded] = useBricolage({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  })

  if (!archivoLoaded || !bricolageLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootGuard />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
