'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiGet, apiPost } from '@/lib/api'
import { PageWrapper, PhoneShell, C, DISPLAY, BODY } from '@/components/PhoneShell'
import { Compass, Plus, User, CalendarDays, Users, Star, UserPlus, ChevronRight, Search, X, Check } from 'lucide-react'

// ─── types ───────────────────────────────────────────────────────────────────
interface Group {
  id: string
  name: string
  sport: string | null
  memberCount: number
  isAdmin: boolean
}

interface FavoritePlayer {
  id: string
  name: string
  sport: string
  category: string | null
  skillLevel: string | null
}

const SPORTS_INFO: Record<string, { label: string; color: string }> = {
  padel:        { label: 'Padel',        color: '#2E6F9E' },
  beach_tennis: { label: 'Beach Tennis', color: '#D4880A' },
  tennis:       { label: 'Tênis',        color: '#B03A2E' },
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = color ? 0 : name.charCodeAt(0) * 37 % 360
  const bg = color ?? `hsl(${hue},50%,42%)`
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: bg,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, fontFamily: DISPLAY, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ─── NavBar ──────────────────────────────────────────────────────────────────
function NavBar() {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px 20px',
      background: C.card, borderTop: `1.5px solid ${C.line}` }}>
      {([
        ['descobrir',  Compass,      'Descobrir'],
        ['meus-jogos', CalendarDays, 'Meus jogos'],
        ['criar',      Plus,         'Criar'],
        ['comunidade', Users,        'Comunidade'],
        ['perfil',     User,         'Perfil'],
      ] as const).map(([key, Icon, label]) => {
        const isCenter = key === 'criar'
        const on = key === 'comunidade'
        if (isCenter) return (
          <button key={key} onClick={() => router.push('/criar')}
            style={{ flex: 1, display: 'flex', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 40, borderRadius: 13, background: C.lime,
              boxShadow: `0 6px 14px -4px ${C.lime}99`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} strokeWidth={3} color={C.ink} />
            </div>
          </button>
        )
        return (
          <button key={key} onClick={() => router.push(
            key === 'descobrir' ? '/descobrir' :
            key === 'meus-jogos' ? '/meus-jogos' :
            key === 'comunidade' ? '/comunidade' : '/perfil'
          )}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, border: 'none', background: 'none', cursor: 'pointer', padding: '2px 0' }}>
            <Icon size={19} strokeWidth={on ? 2.8 : 2.2} color={on ? C.ink : C.inkSoft} />
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
              color: on ? C.ink : C.inkSoft, whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ width: 16, height: 3, borderRadius: 3, background: on ? C.lime : 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyCard({ icon, title, subtitle, action, onAction }: {
  icon: React.ReactNode; title: string; subtitle: string
  action?: string; onAction?: () => void
}) {
  return (
    <div style={{ background: C.cream, borderRadius: 20, border: `1.5px solid ${C.line}`,
      padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: C.card,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: C.ink }}>{title}</div>
      <div style={{ fontFamily: BODY, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{subtitle}</div>
      {action && onAction && (
        <button onClick={onAction}
          style={{ marginTop: 4, padding: '10px 20px', borderRadius: 999, border: 'none',
            background: C.lime, color: C.ink, fontFamily: DISPLAY, fontWeight: 800,
            fontSize: 13, cursor: 'pointer' }}>
          {action}
        </button>
      )}
    </div>
  )
}

// ─── New Group Modal ──────────────────────────────────────────────────────────
function NewGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    if (!name.trim()) { setErr('Digite um nome para o grupo'); return }
    setSaving(true); setErr('')
    try {
      await apiPost('/community/groups', { name: name.trim(), sport: sport || null })
      onCreated()
    } catch {
      setErr('Erro ao criar grupo')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(26,24,19,0.55)', padding: '0 24px' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 360, background: C.cream, borderRadius: 28,
          padding: '28px 24px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: C.ink }}>Novo grupo</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color={C.inkSoft} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.15em', color: C.inkSoft, fontFamily: BODY, marginBottom: 8 }}>
              Nome do grupo
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Galera do Padel"
              onKeyDown={e => e.key === 'Enter' && create()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14,
                fontFamily: BODY, border: `1.5px solid ${C.line}`, background: C.card,
                color: C.ink, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.15em', color: C.inkSoft, fontFamily: BODY, marginBottom: 8 }}>
              Esporte (opcional)
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['', 'Todos'], ...Object.entries(SPORTS_INFO).map(([k, v]) => [k, v.label])].map(([val, label]) => {
                const on = sport === val
                return (
                  <button key={val} onClick={() => setSport(val)}
                    style={{ padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                      border: `1.5px solid ${on ? C.ink : C.line}`,
                      background: on ? C.ink : C.card,
                      color: on ? C.cream : C.inkSoft,
                      fontFamily: BODY, fontWeight: 700, fontSize: 13 }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {err && (
            <div style={{ fontSize: 13, color: C.coral, fontFamily: BODY }}>{err}</div>
          )}

          <button onClick={create} disabled={saving || !name.trim()}
            style={{ width: '100%', padding: '14px', borderRadius: 16, border: 'none',
              background: !name.trim() ? C.line : C.lime,
              color: !name.trim() ? C.inkSoft : C.ink,
              fontFamily: DISPLAY, fontWeight: 800, fontSize: 15,
              cursor: !name.trim() ? 'default' : 'pointer', marginTop: 4 }}>
            {saving ? 'Criando…' : 'Criar grupo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ComunidadePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tab, setTab] = useState<'grupos' | 'favoritos'>('grupos')
  const [groups, setGroups] = useState<Group[]>([])
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroupOpen, setNewGroupOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, f] = await Promise.all([
        apiGet<Group[]>('/community/groups').catch(() => [] as Group[]),
        apiGet<FavoritePlayer[]>('/community/favorites').catch(() => [] as FavoritePlayer[]),
      ])
      setGroups(g)
      setFavorites(f)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    load()
  }, [user, router, load])

  if (!user) return null

  return (
    <PageWrapper>
      {newGroupOpen && (
        <NewGroupModal
          onClose={() => setNewGroupOpen(false)}
          onCreated={() => { setNewGroupOpen(false); load() }}
        />
      )}
      <PhoneShell bottomBar={<NavBar />}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* header */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.2em', color: C.inkSoft, fontFamily: BODY }}>
              {user.name.split(' ')[0]}
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26,
              color: C.ink, letterSpacing: '-.02em', lineHeight: 1.1, marginTop: 2 }}>
              Comunidade
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft, fontFamily: BODY, marginTop: 4 }}>
              Conectar pessoas é o nosso propósito
            </div>

            {/* tabs */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 4 }}>
              {([['grupos', 'Grupos', groups.length], ['favoritos', 'Favoritos', favorites.length]] as const).map(([t, label, count]) => {
                const on = tab === t
                return (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: '8px 16px', borderRadius: 999, border: 'none',
                    background: on ? C.ink : C.card,
                    color: on ? C.cream : C.inkSoft,
                    fontFamily: BODY, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {label}
                    {count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800,
                        background: on ? `${C.lime}44` : C.line,
                        color: on ? C.lime : C.inkSoft,
                        padding: '1px 6px', borderRadius: 999 }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 10 }}>

            {loading && (
              <div style={{ padding: '40px 0', textAlign: 'center',
                color: C.inkSoft, fontSize: 13, fontFamily: BODY }}>
                Carregando…
              </div>
            )}

            {/* ── GRUPOS ── */}
            {!loading && tab === 'grupos' && (
              <>
                <button onClick={() => setNewGroupOpen(true)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 18,
                    border: `1.5px dashed ${C.line}`, background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: `${C.lime}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} strokeWidth={2.5} color={C.ink} />
                  </div>
                  <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                    Criar novo grupo
                  </span>
                </button>

                {groups.length === 0 && (
                  <EmptyCard
                    icon={<Users size={22} color={C.inkSoft} strokeWidth={1.8} />}
                    title="Nenhum grupo ainda"
                    subtitle="Crie um grupo para reunir seus parceiros de jogo e organizar partidas juntos"
                  />
                )}

                {groups.map(g => (
                  <button key={g.id}
                    style={{ width: '100%', textAlign: 'left', background: C.cream,
                      border: `1.5px solid ${C.line}`, borderRadius: 20, padding: '14px 16px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                      background: g.sport ? `${SPORTS_INFO[g.sport]?.color ?? '#888'}18` : `${C.lime}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={20} color={g.sport ? (SPORTS_INFO[g.sport]?.color ?? C.inkSoft) : C.ink} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                        {g.name}
                      </div>
                      <div style={{ fontFamily: BODY, fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                        {g.memberCount} {g.memberCount === 1 ? 'membro' : 'membros'}
                        {g.sport ? ` · ${SPORTS_INFO[g.sport]?.label ?? g.sport}` : ''}
                      </div>
                    </div>
                    {g.isAdmin && (
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: BODY,
                        background: `${C.lime}44`, color: C.ink,
                        padding: '3px 8px', borderRadius: 999 }}>Admin</span>
                    )}
                    <ChevronRight size={16} color={C.inkSoft} />
                  </button>
                ))}
              </>
            )}

            {/* ── FAVORITOS ── */}
            {!loading && tab === 'favoritos' && (
              <>
                {favorites.length === 0 && (
                  <EmptyCard
                    icon={<Star size={22} color={C.inkSoft} strokeWidth={1.8} />}
                    title="Nenhum favorito ainda"
                    subtitle="Adicione jogadores que você quer ter sempre por perto para organizar jogos com facilidade"
                  />
                )}

                {favorites.map(f => {
                  const s = SPORTS_INFO[f.sport] ?? { label: f.sport, color: '#888' }
                  const detail = f.category ? `Cat. ${f.category}` : f.skillLevel ? f.skillLevel : ''
                  return (
                    <div key={f.id}
                      style={{ background: C.cream, border: `1.5px solid ${C.line}`,
                        borderRadius: 20, padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={f.name} size={44} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: C.ink }}>
                          {f.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: BODY,
                            color: s.color, background: `${s.color}18`,
                            padding: '2px 7px', borderRadius: 6 }}>
                            {s.label}
                          </span>
                          {detail && (
                            <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: BODY }}>
                              {detail}
                            </span>
                          )}
                        </div>
                      </div>
                      <Star size={18} color={C.coral} fill={C.coral} />
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </PhoneShell>
    </PageWrapper>
  )
}
