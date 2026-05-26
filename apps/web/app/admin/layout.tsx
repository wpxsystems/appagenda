import React from 'react'
import Link from 'next/link'
import styles from './admin.module.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span>🎾</span> Admin
        </div>
        <nav className={styles.nav}>
          <Link href="/admin/cities">Cidades</Link>
          <Link href="/admin/venues">Arenas</Link>
        </nav>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  )
}
