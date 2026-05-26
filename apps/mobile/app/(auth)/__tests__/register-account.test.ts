import { describe, it, expect } from 'vitest'

function validate(name: string, email: string, password: string) {
  const errors: Record<string, string> = {}
  if (name.trim().length < 2) errors['name'] = 'Nome deve ter pelo menos 2 caracteres'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) errors['email'] = 'Email inválido'
  if (password.length < 8) errors['password'] = 'Senha deve ter pelo menos 8 caracteres'
  return errors
}

describe('register-account validation', () => {
  it('passes with valid data', () => {
    expect(validate('João Silva', 'joao@example.com', 'senha1234')).toEqual({})
  })

  it('requires name with at least 2 chars', () => {
    const e = validate('A', 'a@b.com', 'pass1234')
    expect(e['name']).toBeDefined()
  })

  it('requires valid email', () => {
    const e = validate('João', 'not-an-email', 'pass1234')
    expect(e['email']).toBeDefined()
  })

  it('requires password with at least 8 chars', () => {
    const e = validate('João', 'j@b.com', 'short')
    expect(e['password']).toBeDefined()
  })

  it('can return multiple errors', () => {
    const e = validate('', 'bad', '123')
    expect(Object.keys(e)).toHaveLength(3)
  })
})
