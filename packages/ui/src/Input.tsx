import React from 'react'
import { colors, spacing, borderRadius, fontSize, fontFamily } from './tokens.js'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      {label && (
        <label style={{ fontSize: fontSize.sm, fontFamily: fontFamily.body, color: colors.textSecondary, fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          fontFamily: fontFamily.body,
          fontSize: fontSize.base,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          border: `1px solid ${error ? colors.error : colors.border}`,
          borderRadius: borderRadius.md,
          padding: `${spacing.sm}px ${spacing.md}px`,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {error && (
        <span style={{ fontSize: fontSize.xs, color: colors.error, fontFamily: fontFamily.body }}>
          {error}
        </span>
      )}
    </div>
  )
}
