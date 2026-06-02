export const colors = {
  backdrop: '#1B1A16',
  bezel: '#0E0D0A',
  cream: '#F3EFE6',
  card: '#FFFFFF',
  ink: '#1A1813',
  inkSoft: '#8A8472',
  line: '#E7E1D2',
  lime: '#CBF135',
  coral: '#F0552E',
  success: '#1A7A45',

  primary: '#CBF135',
  primaryDark: '#A8C829',
  secondary: '#1A1813',
  accent: '#CBF135',
  background: '#F3EFE6',
  surface: '#FFFFFF',
  textPrimary: '#1A1813',
  textSecondary: '#8A8472',
  textMuted: '#8A8472',
  border: '#E7E1D2',
  error: '#F0552E',
  warning: '#F59E0B',
} as const

export const sportColors = {
  padel: '#2E6F9E',
  beach_tennis: '#D4880A',
  tennis: '#B03A2E',
} as const

export const sportLabels = {
  padel: 'Padel',
  beach_tennis: 'Beach Tennis',
  tennis: 'Tênis',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const

export const fontFamily = {
  heading: 'BricolageGrotesque_700Bold',
  headingBold: 'BricolageGrotesque_800ExtraBold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  bodyBold: 'Archivo_700Bold',
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const
