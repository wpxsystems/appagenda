import type { SportProfileInput } from '@racket-app/shared'
import type { Gender } from '@racket-app/shared'

export interface RegisterDraft {
  name: string
  email: string
  password: string
  gender: (typeof Gender)[number] | null
  cityId: string | null
  sports: string[]
  sportProfiles: SportProfileInput[]
}

export const registerDraft: RegisterDraft = {
  name: '',
  email: '',
  password: '',
  gender: null,
  cityId: null,
  sports: [],
  sportProfiles: [],
}

export function resetDraft() {
  registerDraft.name = ''
  registerDraft.email = ''
  registerDraft.password = ''
  registerDraft.gender = null
  registerDraft.cityId = null
  registerDraft.sports = []
  registerDraft.sportProfiles = []
}
