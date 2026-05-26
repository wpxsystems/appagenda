import React from 'react'
import { colors, spacing, borderRadius, fontSize, fontFamily } from './tokens.js'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: '#D1FAE5', color: colors.success },
  warning: { bg: '#FEF3C7', color: colors.warning },
  error: { bg: '#FEE2E2', color: colors.error },
  info: { bg: '#DBEAFE', color: '#2563EB' },
  neutral: { bg: colors.background, color: colors.textSecondary },
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const { bg, color } = variantMap[variant]
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: bg,
        color,
        fontSize: fontSize.xs,
        fontFamily: fontFamily.body,
        fontWeight: 600,
        padding: `${spacing.xs / 2}px ${spacing.sm}px`,
        borderRadius: borderRadius.full,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
}
