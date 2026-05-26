import { describe, it, expect } from 'vitest'
import type { SportProfileInput } from '@racket-app/shared'

type RacketCategory = 'C' | 'B' | 'A' | 'Open'
type SidePreference = 'left' | 'right' | 'both'
type TennisLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'
type PlayFormat = 'singles' | 'doubles' | 'both'

interface LevelState {
  padel: { category: RacketCategory | null; side: SidePreference | null }
  beach: { category: RacketCategory | null; side: SidePreference | null }
  tennis: { level: TennisLevel | null; format: PlayFormat | null }
}

function isComplete(sports: string[], state: LevelState): boolean {
  for (const sport of sports) {
    if (sport === 'padel' && (!state.padel.category || !state.padel.side)) return false
    if (sport === 'beach_tennis' && (!state.beach.category || !state.beach.side)) return false
    if (sport === 'tennis' && (!state.tennis.level || !state.tennis.format)) return false
  }
  return true
}

function buildProfiles(sports: string[], state: LevelState): SportProfileInput[] {
  return sports.map((sport) => {
    if (sport === 'padel') return { sport: 'padel', category: state.padel.category!, sidePreference: state.padel.side! }
    if (sport === 'beach_tennis') return { sport: 'beach_tennis', category: state.beach.category!, sidePreference: state.beach.side! }
    return { sport: 'tennis', skillLevel: state.tennis.level!, playFormat: state.tennis.format! }
  })
}

const fullState: LevelState = {
  padel: { category: 'B', side: 'right' },
  beach: { category: 'A', side: 'left' },
  tennis: { level: 'intermediate', format: 'doubles' },
}

describe('register-level isComplete', () => {
  it('returns true when all selected sports are filled', () => {
    expect(isComplete(['padel'], fullState)).toBe(true)
    expect(isComplete(['tennis'], fullState)).toBe(true)
    expect(isComplete(['padel', 'beach_tennis', 'tennis'], fullState)).toBe(true)
  })

  it('returns false when a required field is missing', () => {
    expect(isComplete(['padel'], { ...fullState, padel: { category: null, side: 'right' } })).toBe(false)
    expect(isComplete(['tennis'], { ...fullState, tennis: { level: null, format: 'singles' } })).toBe(false)
  })
})

describe('register-level buildProfiles', () => {
  it('builds correct padel profile', () => {
    const profiles = buildProfiles(['padel'], fullState)
    expect(profiles).toEqual([{ sport: 'padel', category: 'B', sidePreference: 'right' }])
  })

  it('builds correct tennis profile', () => {
    const profiles = buildProfiles(['tennis'], fullState)
    expect(profiles).toEqual([{ sport: 'tennis', skillLevel: 'intermediate', playFormat: 'doubles' }])
  })

  it('builds multiple profiles', () => {
    const profiles = buildProfiles(['padel', 'tennis'], fullState)
    expect(profiles).toHaveLength(2)
    expect(profiles[0]?.sport).toBe('padel')
    expect(profiles[1]?.sport).toBe('tennis')
  })
})
