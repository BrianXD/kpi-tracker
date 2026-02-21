import { useState, useEffect, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import type { User, AdminSheetKey, AdminSheetData, AdminRow } from '../../types'
import AppLayout from '../../components/AppLayout'
import {
  getAdminSheet,
  addAdminRow,
  saveAdminRow,
  deleteAdminRow,
} from '../../services/api'

// ── Config ────────────────────────────────────────────────────────────────────

const SHEET_TABS: { key: AdminSheetKey; label: string; emoji: string }[] = [
  { key: 'users', label: '使用者', emoji: '👤' },
  { key: 'systems', label: '系統別', emoji: '🖥' },
  { key: 'subModules', label: '子模組', emoji: '📦' },
  { key: 'questionTypes', label: '提問方式', emoji: '💬' },
  { key: 'employees', label: '員工資料', emoji: '🧑‍💼' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isYNField(header: string) {
  return header.includes('是否') || header.includes('管理者')
}
function isNumberField(header: string) {
  return header === '排序' || header === 'id'
}
function isReadOnly(header: string) {
  return header === 'id'
}

function CellInput({
  header,
  value,
  onChange,
  customOptions,
}: {
  header: string
  value: string | number | boolean
  onChange: (v: string) => void
  customOptions?: string[]
}) {
  const strVal = String(value)
  if (isReadOnly(header)) {
    return <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{strVal || '自動'}</span>
  }
  // 自訂下拉（優先）
  if (customOptions && customOptions.length > 0) {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        {strVal === '' && <option value="">— 請選擇 —</option>}
        {customOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }
  // Y/N 下拉
  if (isYNField(header)) {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="Y">Y</option>
        <option value="N">N</option>
      </select>
    )
  }
  return (
    <input
      type={isNumberField(header) ? 'number' : 'text'}
      value={strVal}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%' }}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const location = useLocation()
  const user = location.state?.user as User | undefined

  const [activeSheet, setActiveSheet] = useState<AdminSheetKey>('users')
  const [sheetData, setSheetData] = useState<AdminSheetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 欄位自訂下拉選項：{ '父系統': ['ERP','CRM',...] }
  const [fieldOptions, setFieldOptions] = useState<Record<string, string[]>>({})

  // Editing state
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null) // _rowIndex
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // Adding state
  const [isAdding, setIsAdding] = useState(false)
  const [newValues, setNewValues] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setEditingRowIdx(null)
    setIsAdding(false)
    try {
      const data = await getAdminSheet(activeSheet)
      setSheetData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [activeSheet])

  useEffect(() => { fetchData() }, [fetchData])

  // subModules tab：額外 fetch 系統列表作為「父系統」下拉選項
  useEffect(() => {
    if (activeSheet === 'subModules') {
      getAdminSheet('systems').then((d) => {
        const names = d.data.map((r) => String(r['系統別'] ?? '')).filter(Boolean)
        setFieldOptions({ '父系統': names })
      }).catch(() => setFieldOptions({}))
    } else {
      setFieldOptions({})
    }
  }, [activeSheet])

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = (row: AdminRow) => {
    const vals: Record<string, string> = {}
    sheetData?.headers.forEach((h) => { vals[h] = String(row[h] ?? '') })
    setEditValues(vals)
    setEditingRowIdx(row._rowIndex)
    setIsAdding(false)
  }

  const saveEdit = async (row: AdminRow) => {
    if (!sheetData) return
    setSaving(true)
    try {
      const rowData: Record<string, string | number> = {}
      sheetData.headers.forEach((h) => {
        rowData[h] = isNumberField(h) ? Number(editValues[h]) : editValues[h]
      })
      await saveAdminRow(activeSheet, row._rowIndex, rowData, sheetData.headers)
      showToast('success', '儲存成功')
      await fetchData()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── Add ─────────────────────────────────────────────────────────────────────
  const startAdd = () => {
    const vals: Record<string, string> = {}
    sheetData?.headers.forEach((h) => {
      vals[h] = isYNField(h) ? 'Y' : ''
    })
    setNewValues(vals)
    setIsAdding(true)
    setEditingRowIdx(null)
  }

  const confirmAdd = async () => {
    if (!sheetData) return
    setSaving(true)
    try {
      const rowData: Record<string, string | number> = {}
      sheetData.headers.forEach((h) => {
        if (isReadOnly(h)) return
        rowData[h] = isNumberField(h) ? Number(newValues[h]) : newValues[h]
      })
      await addAdminRow(activeSheet, rowData, sheetData.headers.filter((h) => !isReadOnly(h)))
      showToast('success', '新增成功')
      await fetchData()
      setIsAdding(false)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (row: AdminRow) => {
    if (!confirm(`確定要刪除這筆資料嗎？\nID: ${row['id'] ?? row._rowIndex}`)) return
    setSaving(true)
    try {
      await deleteAdminRow(activeSheet, row._rowIndex)
      showToast('success', '刪除成功')
      await fetchData()
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '刪除失敗')
    } finally {
      setSaving(false)
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!user?.isAdmin) {
    return (
      <div className="page-wrapper">
        <div className="card" style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔒</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>僅限管理者存取</p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            返回登入
          </Link>
        </div>
      </div>
    )
  }

  const headers = sheetData?.headers ?? []
  const rows = sheetData?.data ?? []

  return (
    <AppLayout user={user}>
      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type}`}
          style={{ position: 'fixed', top: 16, right: 280, zIndex: 999, minWidth: 220 }}>
          {toast.type === 'success' ? '✅' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>系統管理</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>資料維護介面 · 管理者專用</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SHEET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSheet(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: activeSheet === tab.key ? 'var(--accent)' : 'var(--border)',
              background: activeSheet === tab.key ? 'var(--accent-dim)' : 'var(--surface)',
              color: activeSheet === tab.key ? 'var(--accent-hover)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: activeSheet === tab.key ? 600 : 400,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

        {/* Table card */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              共 <strong style={{ color: 'var(--text)' }}>{rows.length}</strong> 筆
            </span>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 18px', fontSize: 13, marginTop: 0 }}
              onClick={startAdd}
              disabled={loading || isAdding}
            >
              + 新增
            </button>
          </div>

          {/* Loading / Error */}
          {loading && (
            <div className="spinner-wrap"><div className="spinner" /><span>載入中…</span></div>
          )}
          {error && !loading && (
            <div className="alert alert-error" style={{ margin: 16 }}>⚠ {error}</div>
          )}

          {/* Table */}
          {!loading && !error && sheetData && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {headers.map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: 12,
                          letterSpacing: '0.04em',
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: 12,
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                        width: 120,
                      }}
                    >
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* New row */}
                  {isAdding && (
                    <tr style={{ background: 'rgba(124,111,247,0.06)' }}>
                      {headers.map((h) => (
                        <td key={h} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                          <CellInput
                            header={h}
                            value={newValues[h] ?? ''}
                            onChange={(v) => setNewValues((prev) => ({ ...prev, [h]: v }))}
                            customOptions={fieldOptions[h]}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <ActionBtn color="var(--success)" onClick={confirmAdd} disabled={saving}>✓ 確認</ActionBtn>
                          <ActionBtn color="var(--text-muted)" onClick={() => setIsAdding(false)} disabled={saving}>✕</ActionBtn>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data rows */}
                  {rows.map((row) => {
                    const isEditing = editingRowIdx === row._rowIndex
                    return (
                      <tr
                        key={row._rowIndex}
                        style={{
                          background: isEditing ? 'rgba(124,111,247,0.06)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isEditing) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isEditing) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                        }}
                      >
                        {headers.map((h) => (
                          <td key={h} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                            {isEditing ? (
                              <CellInput
                                header={h}
                                value={editValues[h] ?? ''}
                                onChange={(v) => setEditValues((prev) => ({ ...prev, [h]: v }))}
                                customOptions={fieldOptions[h]}
                              />
                            ) : (
                              <span style={{ color: renderCellColor(h, row[h]) }}>
                                {String(row[h] ?? '')}
                              </span>
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <ActionBtn color="var(--success)" onClick={() => saveEdit(row)} disabled={saving}>✓ 儲存</ActionBtn>
                              <ActionBtn color="var(--text-muted)" onClick={() => setEditingRowIdx(null)} disabled={saving}>✕</ActionBtn>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <ActionBtn color="var(--accent-hover)" onClick={() => startEdit(row)} disabled={saving}>✏ 編輯</ActionBtn>
                              <ActionBtn color="var(--error)" onClick={() => handleDelete(row)} disabled={saving}>🗑</ActionBtn>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {rows.length === 0 && !isAdding && (
                    <tr>
                      <td
                        colSpan={headers.length + 1}
                        style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}
                      >
                        尚無資料，點選「+ 新增」開始建立
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </AppLayout>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ActionBtn({
  children,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid currentColor',
        background: 'transparent',
        color: color ?? 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function renderCellColor(header: string, value: string | number | boolean) {
  if (isYNField(header)) {
    const v = String(value).toUpperCase()
    return v === 'Y' ? 'var(--low)' : 'var(--text-dim)'
  }
  if (header === 'id') return 'var(--text-dim)'
  return 'var(--text)'
}
