import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors as C, fontFamily as F } from '@racket-app/ui'

type TabKey = 'index' | 'meus-jogos' | 'criar' | 'comunidade' | 'perfil'

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'index',      label: 'Descobrir',  icon: 'compass-outline' },
  { key: 'meus-jogos', label: 'Meus jogos', icon: 'calendar-outline' },
  { key: 'criar',      label: 'Criar',      icon: 'add' },
  { key: 'comunidade', label: 'Comunidade', icon: 'people-outline' },
  { key: 'perfil',     label: 'Perfil',     icon: 'person-outline' },
]

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index]?.name as TabKey | undefined

  return (
    <View style={styles.bar}>
      {TABS.map(t => {
        const isCenter = t.key === 'criar'
        const active = activeRoute === t.key

        if (isCenter) {
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(t.key)}
              style={styles.centerWrap}
            >
              <View style={styles.centerBtn}>
                <Ionicons name="add" size={22} color={C.ink} />
              </View>
            </TouchableOpacity>
          )
        }

        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(t.key)}
            style={styles.tabItem}
          >
            <Ionicons name={t.icon} size={20} color={active ? C.ink : C.inkSoft} />
            <Text style={[styles.label, { color: active ? C.ink : C.inkSoft }]} numberOfLines={1}>
              {t.label}
            </Text>
            <View style={[styles.indicator, { backgroundColor: active ? C.lime : 'transparent' }]} />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 4,
    backgroundColor: C.card,
    borderTopWidth: 1.5,
    borderTopColor: C.line,
  },
  tabItem: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2,
  },
  label: { fontSize: 9, fontFamily: F.bodyBold },
  indicator: { width: 14, height: 3, borderRadius: 3 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerBtn: {
    width: 46, height: 40, borderRadius: 13, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.lime, shadowOpacity: 0.6, shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
})
