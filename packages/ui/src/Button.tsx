import React from 'react'
import { colors, spacing, borderRadius, fontFamily, fontSize } from './tokens.js'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: React.ReactNode
  onPress?: () => void
  variant?: Variant
  size?: Size
  disabled?: boolean
  fullWidth?: boolean
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: colors.primary, color: '#fff', border: 'none' },
  secondary: { backgroundColor: 'transparent', color: colors.primary, border: `2px solid ${colors.primary}` },
  ghost: { backgroundColor: 'transparent', color: colors.textPrimary, border: 'none' },
  danger: { backgroundColor: colors.error, color: '#fff', border: 'none' },
}

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: fontSize.sm },
  md: { padding: `${spacing.sm}px ${spacing.md}px`, fontSize: fontSize.base },
  lg: { padding: `${spacing.md}px ${spacing.xl}px`, fontSize: fontSize.lg },
}

export function Button({ children, onPress, variant = 'primary', size = 'md', disabled, fullWidth }: ButtonProps) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        fontFamily: fontFamily.body,
        fontWeight: 600,
        borderRadius: borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  )
}
