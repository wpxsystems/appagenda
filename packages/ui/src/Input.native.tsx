import React from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius, fontSize } from './tokens.js'

interface InputProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  type?: 'text' | 'email' | 'password' | 'number'
  error?: string
  disabled?: boolean
}

export function Input({ label, placeholder, value, onChange, type = 'text', error, disabled }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        secureTextEntry={type === 'password'}
        keyboardType={type === 'email' ? 'email-address' : type === 'number' ? 'numeric' : 'default'}
        autoCapitalize={type === 'email' ? 'none' : 'sentences'}
        style={[styles.input, error ? styles.inputError : null, disabled ? styles.disabled : null]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  input: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.error },
  disabled: { opacity: 0.5 },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.error,
  },
})
