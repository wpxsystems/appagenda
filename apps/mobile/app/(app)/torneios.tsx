import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen, colors as C, fonts as F } from '../../components/ui'

export default function TorneiosScreen() {
  return (
    <Screen>
      <View style={s.header}>
        <Text style={s.title}>Torneios</Text>
      </View>
      <View style={s.empty}>
        <Ionicons name="trophy-outline" size={48} color={C.line} />
        <Text style={s.emptyTitle}>Em breve</Text>
        <Text style={s.emptySub}>Os torneios estarão disponíveis em breve.</Text>
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  title: { fontFamily: F.headingBold, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyTitle: { fontFamily: F.headingBold, fontSize: 17, color: C.ink },
  emptySub: { fontSize: 13, color: C.inkSoft, fontFamily: F.body, textAlign: 'center', paddingHorizontal: 40 },
})
