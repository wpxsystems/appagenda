import { Tabs } from 'expo-router'
import { TabBar } from '../../components/TabBar'

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Descobrir' }} />
      <Tabs.Screen name="meus-jogos" options={{ title: 'Meus jogos' }} />
      <Tabs.Screen name="criar" options={{ title: 'Criar' }} />
      <Tabs.Screen name="comunidade" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />

      <Tabs.Screen name="group/[id]" options={{ href: null }} />
    </Tabs>
  )
}
