export const Sport = ['padel', 'beach_tennis', 'tennis'] as const
export type Sport = (typeof Sport)[number]

export const RacketCategory = ['C', 'B', 'A', 'Open'] as const
export type RacketCategory = (typeof RacketCategory)[number]

export const SidePreference = ['left', 'right', 'both'] as const
export type SidePreference = (typeof SidePreference)[number]

export const TennisLevel = ['beginner', 'intermediate', 'advanced', 'competitive'] as const
export type TennisLevel = (typeof TennisLevel)[number]

export const PlayFormat = ['singles', 'doubles', 'both'] as const
export type PlayFormat = (typeof PlayFormat)[number]

export const Gender = ['male', 'female', 'other'] as const
export type Gender = (typeof Gender)[number]

export const UserRole = ['player', 'admin'] as const
export type UserRole = (typeof UserRole)[number]

export const GameGenderType = ['mixed', 'male', 'female'] as const
export type GameGenderType = (typeof GameGenderType)[number]

export const GameStatus = ['open', 'full', 'cancelled', 'completed'] as const
export type GameStatus = (typeof GameStatus)[number]

export const ParticipantStatus = ['registered', 'confirmed', 'attended', 'absent', 'removed'] as const
export type ParticipantStatus = (typeof ParticipantStatus)[number]
