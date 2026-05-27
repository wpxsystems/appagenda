'use client'
import { ReactNode } from 'react'

export const C = {
  backdrop: '#1B1A16',
  bezel: '#0E0D0A',
  cream: '#F3EFE6',
  card: '#FFFFFF',
  ink: '#1A1813',
  inkSoft: '#8A8472',
  line: '#E7E1D2',
  lime: '#CBF135',
  coral: '#F0552E',
}
export const DISPLAY = "'Bricolage Grotesque', sans-serif"
export const BODY = "'Archivo', sans-serif"

export function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
      background: `radial-gradient(900px 500px at 20% 0%, ${C.coral}22, transparent 60%),
                   radial-gradient(900px 600px at 90% 100%, ${C.lime}1F, transparent 55%),
                   ${C.backdrop}`,
      fontFamily: BODY,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Archivo:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.35s cubic-bezier(.22,.7,.2,1) both; }
      `}</style>
      {children}
    </div>
  )
}

export function PhoneShell({ children, bottomBar }: { children: ReactNode; bottomBar?: ReactNode }) {
  return (
    <div style={{
      width: 390, padding: 11, borderRadius: 54,
      background: C.bezel,
      boxShadow: '0 40px 80px -30px rgba(0,0,0,0.8), inset 0 0 0 1.5px rgba(243,239,230,0.06)',
    }}>
      <div style={{
        borderRadius: 44, background: C.cream,
        height: 'min(812px, 88vh)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        {/* dynamic island */}
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 116, height: 30, background: C.bezel, borderRadius: 20, zIndex: 20,
        }} />
        {/* status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px 4px', fontFamily: BODY, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>20:14</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              {[5,8,11,14].map(h => <div key={h} style={{ width: 3, height: h, background: C.ink, borderRadius: 1 }} />)}
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.6">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
            <div style={{ width: 22, height: 11, border: `1.6px solid ${C.ink}`, borderRadius: 3,
              display: 'flex', alignItems: 'center', padding: '1.5px' }}>
              <div style={{ width: '72%', height: '100%', background: C.ink, borderRadius: 1 }} />
            </div>
          </div>
        </div>
        {/* scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const }}>
          {children}
        </div>
        {bottomBar && (
          <div style={{ flexShrink: 0 }}>{bottomBar}</div>
        )}
      </div>
    </div>
  )
}

export function Btn({ children, onClick, variant = 'primary', fullWidth = false, disabled = false, style = {} }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'outline'
  fullWidth?: boolean; disabled?: boolean; style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 999,
    padding: '14px 24px', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15,
    width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s, transform 0.1s', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  }
  const variants = {
    primary: { background: C.lime, color: C.ink, boxShadow: `0 10px 22px -8px ${C.lime}` },
    ghost: { background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.line}` },
    outline: { background: 'transparent', color: C.coral, border: `1.5px solid ${C.coral}` },
  }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={e => { (e.currentTarget.style.transform = 'scale(0.97)') }}
      onMouseUp={e => { (e.currentTarget.style.transform = 'scale(1)') }}
      onMouseLeave={e => { (e.currentTarget.style.transform = 'scale(1)') }}>
      {children}
    </button>
  )
}

export function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkSoft, fontFamily: BODY }}>
        {label}
      </label>
      <input {...props} style={{
        border: `1.5px solid ${error ? C.coral : C.line}`, borderRadius: 16,
        padding: '12px 16px', fontSize: 15, fontFamily: BODY, color: C.ink,
        background: C.card, outline: 'none', width: '100%',
      }} />
      {error && <span style={{ fontSize: 12, color: C.coral, fontFamily: BODY }}>{error}</span>}
    </div>
  )
}
