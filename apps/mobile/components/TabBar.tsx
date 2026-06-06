import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors as C, fontFamily as F } from '@racket-app/ui'

type TabKey = 'torneios' | 'meus-jogos' | 'index' | 'comunidade' | 'perfil'

interface TabDef {
  key: TabKey
  label: string
  iconActive: React.ComponentProps<typeof Ionicons>['name']
  iconInactive: React.ComponentProps<typeof Ionicons>['name']
}

const TABS: TabDef[] = [
  { key: 'torneios',   label: 'Torneios',   iconActive: 'trophy',        iconInactive: 'trophy-outline' },
  { key: 'meus-jogos', label: 'Jogos',      iconActive: 'calendar',      iconInactive: 'calendar-outline' },
  { key: 'index',      label: 'Descobrir',  iconActive: 'compass',       iconInactive: 'compass-outline' },
  { key: 'comunidade', label: 'Comunidade', iconActive: 'people',        iconInactive: 'people-outline' },
  { key: 'perfil',     label: 'Perfil',     iconActive: 'person-circle', iconInactive: 'person-circle-outline' },
]

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index]?.name as TabKey | undefined

  return (
    <View style={s.bar}>
      {TABS.map(t => {
        const active = activeRoute === t.key
        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(t.key)}
            style={s.tab}
          >
            <View style={[s.iconWrap, active && s.iconWrapActive]}>
              <Ionicons
                name={active ? t.iconActive : t.iconInactive}
                size={22}
                color={active ? C.ink : '#A8A49C'}
              />
            </View>
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingHorizontal: 4,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 44, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: `${C.lime}50`,
  },
  label: {
    fontSize: 10,
    fontFamily: F.bodySemi,
    color: '#A8A49C',
  },
  labelActive: {
    fontFamily: F.bodyBold,
    color: C.ink,
  },
})
