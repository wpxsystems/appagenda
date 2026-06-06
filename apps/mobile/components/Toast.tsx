import React, { createContext, useContext, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors as C, fontFamily as F } from '@racket-app/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastConfig {
  type: ToastType
  title: string
  message?: string
}

interface ConfirmConfig {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void
  showConfirm: (config: ConfirmConfig) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null)
  const toastAnim = useRef(new Animated.Value(0)).current
  const confirmAnim = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(config)
    toastAnim.setValue(0)
    Animated.spring(toastAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 80, friction: 10,
    }).start()
    timerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0, duration: 250, useNativeDriver: true,
      }).start(() => setToast(null))
    }, 3200)
  }, [])

  const showConfirm = useCallback((config: ConfirmConfig) => {
    setConfirm(config)
    confirmAnim.setValue(0)
    Animated.spring(confirmAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 70, friction: 10,
    }).start()
  }, [])

  function dismissConfirm() {
    Animated.timing(confirmAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => setConfirm(null))
  }

  function handleConfirm() {
    const fn = confirm?.onConfirm
    dismissConfirm()
    setTimeout(() => fn?.(), 220)
  }

  const toastColors = {
    success: { bg: C.ink, icon: C.lime, iconName: 'checkmark-circle' as const },
    error:   { bg: C.coral, icon: '#fff', iconName: 'close-circle' as const },
    info:    { bg: C.ink, icon: C.lime, iconName: 'information-circle' as const },
  }

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* ── Confirm Modal ── */}
      {confirm ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[s.overlay, { opacity: confirmAnim }]}
            pointerEvents="auto"
          >
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismissConfirm} activeOpacity={1} />
          </Animated.View>
          <Animated.View style={[
            s.confirmCard,
            {
              opacity: confirmAnim,
              transform: [{
                scale: confirmAnim.interpolate({
                  inputRange: [0, 1], outputRange: [0.92, 1],
                }),
              }],
            },
          ]}>
            <Text style={s.confirmTitle}>{confirm.title}</Text>
            <Text style={s.confirmMsg}>{confirm.message}</Text>
            <View style={s.confirmActions}>
              <TouchableOpacity onPress={dismissConfirm} activeOpacity={0.8} style={s.cancelAction}>
                <Text style={s.cancelActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                activeOpacity={0.85}
                style={[
                  s.confirmAction,
                  { backgroundColor: confirm.destructive ? C.coral : C.ink },
                ]}
              >
                <Text style={[s.confirmActionText, { color: confirm.destructive ? '#fff' : C.lime }]}>
                  {confirm.confirmLabel ?? 'Confirmar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {/* ── Toast ── */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            { backgroundColor: toastColors[toast.type].bg },
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1], outputRange: [-16, 0],
                }),
              }],
            },
          ]}
        >
          <Ionicons
            name={toastColors[toast.type].iconName}
            size={22}
            color={toastColors[toast.type].icon}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.toastTitle}>{toast.title}</Text>
            {toast.message ? (
              <Text style={s.toastMsg}>{toast.message}</Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Confirm
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,24,19,0.55)',
  },
  confirmCard: {
    position: 'absolute', left: 24, right: 24,
    top: '35%',
    backgroundColor: C.card, borderRadius: 28,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 20,
  },
  confirmTitle: {
    fontFamily: F.headingBold, fontSize: 20, color: C.ink,
    letterSpacing: -0.5, marginBottom: 8,
  },
  confirmMsg: {
    fontFamily: F.body, fontSize: 14, color: C.inkSoft,
    lineHeight: 20, marginBottom: 24,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
  cancelAction: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.line,
    alignItems: 'center',
  },
  cancelActionText: { fontFamily: F.bodyBold, fontSize: 14, color: C.inkSoft },
  confirmAction: {
    flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
  },
  confirmActionText: { fontFamily: F.headingBold, fontSize: 14 },

  // Toast
  toast: {
    position: 'absolute', left: 24, right: 24,
    top: '42%',
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  toastTitle: { fontFamily: F.bodyBold, fontSize: 14, color: '#fff' },
  toastMsg: { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
})
