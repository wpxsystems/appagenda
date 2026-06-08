import React from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle, TextInputProps, Image } from 'react-native'
import { colors as C, fontFamily as F } from '@racket-app/ui'

export { C as colors }
export const fonts = F

// ── Btn ─────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'outline'
export function Btn({
  children, onPress, variant = 'primary', fullWidth, disabled, style,
}: {
  children: React.ReactNode
  onPress?: () => void
  variant?: BtnVariant
  fullWidth?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const variantStyle = btnVariants[variant]
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.btnBase, variantStyle.bg, fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
    >
      <Text style={[styles.btnText, variantStyle.text]}>
        {children}
      </Text>
    </TouchableOpacity>
  )
}

// ── Input ───────────────────────────────────────────────────────────
export function Input({
  label, error, ...rest
}: { label: string; error?: string } & Omit<TextInputProps, 'style'>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={C.inkSoft}
        {...rest}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────
export function Avatar({ name, size = 36, uri }: { name?: string; size?: number; uri?: string | null }) {
  const initials = (name ?? '?').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
  const hue = (name ?? '?').charCodeAt(0) * 37 % 360
  const containerStyle = {
    width: size, height: size, borderRadius: size / 2,
    alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const,
    backgroundColor: uri ? C.line : `hsl(${hue},50%,42%)`,
  }
  if (uri) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
    )
  }
  return (
    <View style={containerStyle}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontFamily: F.headingBold }}>{initials}</Text>
    </View>
  )
}

// ── Pill (tab pill) ─────────────────────────────────────────────────
export function Pill({ label, active, onPress, small, count, color }: {
  label: string; active: boolean; onPress: () => void; small?: boolean; count?: number; color?: string
}) {
  const activeBg = color ?? C.ink
  // sem cor customizada → fundo ink, texto cream; com cor de esporte → fundo colorido, texto branco
  const activeText = color ? '#fff' : C.cream
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[
      styles.pill,
      { paddingHorizontal: small ? 12 : 16, paddingVertical: small ? 6 : 8 },
      { backgroundColor: active ? activeBg : C.card, borderColor: active ? activeBg : C.line },
    ]}>
      <Text style={[styles.pillText, { color: active ? activeText : C.inkSoft, fontSize: small ? 12 : 13 }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 ? (
        <View style={{
          marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
          backgroundColor: active ? 'rgba(255,255,255,0.25)' : C.line,
        }}>
          <Text style={{ fontSize: 11, fontFamily: F.bodyBold, color: active ? '#fff' : C.inkSoft }}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

// ── SectionLabel ────────────────────────────────────────────────────
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>
}

// ── SegmentedPicker ─────────────────────────────────────────────────
export function SegmentedPicker<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]
  value: T | ''
  onChange: (v: T) => void
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([v, label]) => {
        const on = value === v
        return (
          <TouchableOpacity
            key={v}
            onPress={() => onChange(v)}
            activeOpacity={0.8}
            style={[
              styles.segItem,
              { backgroundColor: on ? C.ink : C.card, borderColor: on ? C.ink : C.line },
            ]}
          >
            <Text style={{ color: on ? C.cream : C.inkSoft, fontSize: 13, fontFamily: F.bodyBold }}>{label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── StepDots ────────────────────────────────────────────────────────
export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{
          height: 4, borderRadius: 4,
          width: i === step - 1 ? 22 : 8,
          backgroundColor: i < step ? C.lime : '#D1D0CB',
        }} />
      ))}
    </View>
  )
}

// ── Toggle ──────────────────────────────────────────────────────────
export function Toggle({ on, onChange, color }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <TouchableOpacity onPress={onChange} activeOpacity={0.85} style={{
      width: 44, height: 26, borderRadius: 13, backgroundColor: on ? (color ?? C.lime) : '#D1D0CB',
      justifyContent: 'center', paddingHorizontal: 3,
    }}>
      <View style={{
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
        alignSelf: on ? 'flex-end' : 'flex-start',
      }} />
    </TouchableOpacity>
  )
}

// ── Screen wrapper (cream background, safe area aware) ──────────────
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'react-native'
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: C.cream }, style]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      {children}
    </SafeAreaView>
  )
}

// ── styles ──────────────────────────────────────────────────────────
const btnVariants = StyleSheet.create({
  primary:  { bg: { backgroundColor: C.lime }, text: { color: C.ink } } as any,
  ghost:    { bg: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.line }, text: { color: C.inkSoft } } as any,
  outline:  { bg: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.coral }, text: { color: C.coral } } as any,
}) as any

const styles = StyleSheet.create({
  btnBase: {
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  btnText: { fontFamily: F.headingBold, fontSize: 15 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },

  inputLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  input: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    fontFamily: F.body, color: C.ink, backgroundColor: C.card,
  },
  inputError: { borderColor: C.coral },
  errorText: { fontSize: 12, color: C.coral, fontFamily: F.body },

  pill: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 999,
  },
  pillText: { fontFamily: F.bodyBold },

  sectionLabel: {
    fontSize: 11, fontFamily: F.bodyBold, color: C.inkSoft,
    textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 10,
  },

  segItem: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5,
  },
})
