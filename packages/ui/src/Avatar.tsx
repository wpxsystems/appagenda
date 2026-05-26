import React from 'react'
import { colors, borderRadius, fontSize, fontFamily } from './tokens.js'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function Avatar({ src, name, size = 40 }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: borderRadius.full, objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size > 32 ? fontSize.base : fontSize.xs,
        fontFamily: fontFamily.heading,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}
