import { View, StatusBar } from 'react-native'
import { Tabs, usePathname } from 'expo-router'
import { TabBar } from '../../components/TabBar'
import { colors as C } from '@racket-app/ui'

export default function AppLayout() {
  const pathname = usePathname()
  const isJogo = pathname.startsWith('/jogo/')

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
    {!isJogo && <StatusBar barStyle="dark-content" backgroundColor={C.cream} />}
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
    >
      <Tabs.Screen name="index"        options={{ title: 'Descobrir' }} />
      <Tabs.Screen name="notificacoes" options={{ title: 'Notificações' }} />
      <Tabs.Screen name="meus-jogos"   options={{ title: 'Meus jogos' }} />
      <Tabs.Screen name="comunidade"   options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="perfil"       options={{ title: 'Perfil' }} />
      <Tabs.Screen name="criar"        options={{ href: null }} />
      <Tabs.Screen name="torneios"     options={{ href: null }} />

      <Tabs.Screen name="group/[id]"   options={{ href: null }} />
      <Tabs.Screen name="jogo/[id]"    options={{ href: null }} />
    </Tabs>
    </View>
  )
}
