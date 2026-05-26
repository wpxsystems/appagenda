import React from 'react'
import { colors, spacing, borderRadius, shadow } from './tokens.js'

interface CardProps {
  children: React.ReactNode
  padding?: keyof typeof spacing
  style?: React.CSSProperties
}

export function Card({ children, padding = 'md', style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing[padding],
        border: `1px solid ${colors.border}`,
        boxShadow: `0 ${shadow.sm.shadowOffset.height}px ${shadow.sm.shadowRadius}px rgba(0,0,0,${shadow.sm.shadowOpacity})`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
