import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { User } from '../types'

interface AppLayoutProps {
  user: User
  children: ReactNode
}

export default function AppLayout({ user, children }: AppLayoutProps) {
  const { pathname } = useLocation()

  const navItems = [
    { to: '/dashboard', icon: '📊', label: '儀表板' },
    { to: '/form', icon: '✏️', label: '新增工作記錄' },
    { to: '/records', icon: '📋', label: '查詢記錄' },
    ...(user.isAdmin ? [{ to: '/admin', icon: '⚙', label: '系統管理' }] : []),
  ]

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">📋</div>
          <div className="logo-text">
            <h1>KPI Tracker</h1>
            <p>工作記錄系統</p>
          </div>
        </div>

        {/* User card */}
        <div className="sidebar-user-card">
          <div className="user-name">{user.isAdmin ? '👑' : '👤'} {user.name}</div>
          <div className="user-meta">{user.empId} · {user.isAdmin ? '管理者' : '一般使用者'}</div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="主選單">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              state={{ user }}
              className={pathname === item.to ? 'active' : ''}
              aria-current={pathname === item.to ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom: switch user */}
        <div style={{ marginTop: 'auto' }}>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none',
              transition: 'background var(--transition), color var(--transition)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-hover)'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>↩</span>
            切換使用者
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="app-main">
        <div className="app-main-inner">
          {children}
        </div>
      </main>
    </div>
  )
}
