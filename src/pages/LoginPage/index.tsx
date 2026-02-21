import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../../types'
import { getUsers } from '../../services/api'

const REMEMBER_KEY = 'kpi_remember_user'

export default function LoginPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getUsers()
      .then((list) => {
        setUsers(list)
        // 記住我：帶入上次選擇
        const saved = localStorage.getItem(REMEMBER_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as { userId: string }
          setSelectedId(parsed.userId)
          setRemember(true)
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : '無法取得使用者清單')
      )
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setSubmitting(true)

    const user = users.find((u) => u.id === selectedId)
    if (!user) { setSubmitting(false); return }

    if (remember) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ userId: selectedId }))
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }

    navigate('/form', { state: { user } })
  }

  return (
    <div className="page-wrapper">
      <div className="card" style={{ maxWidth: 400 }}>
        <div className="app-logo">
          <div className="logo-icon">📋</div>
          <div className="logo-text">
            <h1>KPI Tracker</h1>
            <p>工作記錄系統</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="user-select">
              請選擇使用者 <span className="required">*</span>
            </label>
            {loading ? (
              <div className="spinner-wrap">
                <div className="spinner" />
                <span>載入中…</span>
              </div>
            ) : (
              <select
                id="user-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                autoFocus
                required
              >
                <option value="" disabled>— 請選擇 —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{u.empId}）
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="checkbox-row" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>記住我，下次自動帶入</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!selectedId || loading || submitting}
            style={{ marginTop: 12 }}
          >
            {submitting ? '進入中…' : '進入記錄介面 →'}
          </button>
        </form>
      </div>
    </div>
  )
}
