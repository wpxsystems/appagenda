import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors as C, fontFamily as F } from '@racket-app/ui'
import { notifBadge } from '../lib/notif-badge'
import { apiGet } from '../lib/api'

type TabKey = 'notificacoes' | 'meus-jogos' | 'index' | 'comunidade' | 'perfil'

interface TabDef {
  key: TabKey
  label: string
  iconActive: React.ComponentProps<typeof Ionicons>['name']
  iconInactive: React.ComponentProps<typeof Ionicons>['name']
}

const TABS: TabDef[] = [
  { key: 'notificacoes', label: 'Notificações', iconActive: 'notifications',     iconInactive: 'notifications-outline' },
  { key: 'meus-jogos',   label: 'Jogos',        iconActive: 'calendar',          iconInactive: 'calendar-outline' },
  { key: 'index',        label: 'Descobrir',    iconActive: 'compass',           iconInactive: 'compass-outline' },
  { key: 'comunidade',   label: 'Comunidade',   iconActive: 'people',            iconInactive: 'people-outline' },
  { key: 'perfil',       label: 'Perfil',       iconActive: 'person-circle',     iconInactive: 'person-circle-outline' },
]

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index]?.name as TabKey | undefined
  const [badge, setBadge] = useState(notifBadge.get())

  useEffect(() => {
    const unsub = notifBadge.subscribe(() => setBadge(notifBadge.get()))
    // Busca a contagem inicial ao montar
    apiGet<{ count: number }>('/notifications/unread-count')
      .then(r => notifBadge.set(r.count))
      .catch(() => {})
    return unsub
  }, [])

  return (
    <View style={s.bar}>
      {TABS.map(t => {
        const active = activeRoute === t.key
        const showBadge = t.key === 'notificacoes' && badge > 0

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
              {showBadge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
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
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: {
    width: 44, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  iconWrapActive: { backgroundColor: `${C.lime}50` },
  badge: {
    position: 'absolute', top: -3, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.card,
  },
  badgeText: { fontSize: 9, fontFamily: F.bodyBold, color: '#fff', lineHeight: 11 },
  label: { fontSize: 10, fontFamily: F.bodySemi, color: '#A8A49C' },
  labelActive: { fontFamily: F.bodyBold, color: C.ink },
})
