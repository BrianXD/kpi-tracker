import { useState, useEffect, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { User, Level, AdminRow } from '../../types'
import { getRecords, updateRecord } from '../../services/api'
import { useFormOptions } from '../../hooks/useFormOptions'

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  system: z.string().min(1, '請選擇系統別'),
  subModule: z.string().min(1, '請填寫子模組'),
  questionType: z.string().min(1, '請選擇提問方式'),
  questioner: z.string().min(1, '請選擇提問人員'),
  questionDate: z.string().min(1, '請填寫發問日期'),
  difficulty: z.enum(['HIGH', 'MID', 'LOW']),
  priority: z.enum(['HIGH', 'MID', 'LOW']),
  isDone: z.boolean(),
  closedDate: z.string().optional(),
  minutes: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  note: z.string().optional(),
})
type EditFormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_ZH_TO_EN: Record<string, Level> = { 高: 'HIGH', 中: 'MID', 低: 'LOW' }
const LEVEL_LABELS: Record<Level, string> = { HIGH: '高', MID: '中', LOW: '低' }

// 提問方式 Icon
function QTypeIconDisplay({ name }: { name: string }) {
  if (name === 'Email') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <polyline points="2 6 12 13 22 6"/>
      </svg>
    )
  }
  if (name === 'Teams') {
    return (
      <svg width="20" height="18" viewBox="0 0 32 32">
        <circle cx="22" cy="8" r="5" fill="#7B83EB"/>
        <text x="22" y="11.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui">T</text>
        <rect x="2" y="12" width="22" height="18" rx="3" fill="#4B53BC"/>
        <circle cx="13" cy="18" r="3" fill="white"/>
        <path d="M7 27c0-3 2.7-5 6-5s6 2 6 5H7z" fill="white"/>
      </svg>
    )
  }
  if (name === 'LINE') {
    return (
      <svg width="18" height="18" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="#00B900"/>
        <path d="M27 14.5C27 9.8 22 6 16 6S5 9.8 5 14.5c0 4.15 3.68 7.62 8.66 8.37.34.07.8.22.92.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1 .87.55s5.88-3.47 8.03-5.94C26.4 17.87 27 16.26 27 14.5z" fill="white"/>
      </svg>
    )
  }
  const EMOJI: Record<string, string> = { '電話': '☎️', '現場': '🏢', 'Slack': '🔧', 'Zoom': '📹', '其它': '✏️' }
  return <span style={{ fontSize: 18 }}>{EMOJI[name] ?? '💬'}</span>
}


function toDatetimeLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function parseDateVal(val: unknown): string {
  if (!val) return ''
  const s = String(val)
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return toDatetimeLocal(d)
  } catch { /* */ }
  return s.slice(0, 16)
}

function recordToFormValues(rec: AdminRow): EditFormValues {
  return {
    system: String(rec['系統別'] ?? ''),
    subModule: String(rec['子模組'] ?? ''),
    questionType: String(rec['提問方式'] ?? ''),
    questioner: String(rec['提問人員'] ?? ''),
    questionDate: parseDateVal(rec['提問日期']),
    difficulty: LEVEL_ZH_TO_EN[String(rec['難度'])] ?? 'MID',
    priority: LEVEL_ZH_TO_EN[String(rec['優先權'])] ?? 'MID',
    isDone: String(rec['是否完成']) === '是',
    closedDate: parseDateVal(rec['結案日期']),
    minutes: Number(rec['處理分鐘數']) || undefined,
    note: String(rec['備註'] ?? ''),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function LevelButtons({ name, control }: { name: 'difficulty' | 'priority'; control: Control<EditFormValues> }) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <div className="btn-group">
        {(['HIGH', 'MID', 'LOW'] as Level[]).map((v) => (
          <button key={v} type="button"
            className={`btn-level${field.value === v ? ` active-${v}` : ''}`}
            onClick={() => field.onChange(v)}>
            {LEVEL_LABELS[v]}
          </button>
        ))}
      </div>
    )} />
  )
}

function QTypeButtons({ control, options, qtypeInput, onQtypeInput }: {
  control: Control<EditFormValues>
  options: import('../../types').QuestionType[] | undefined
  qtypeInput: string
  onQtypeInput: (v: string) => void
}) {
  return (
    <Controller control={control} name="questionType" render={({ field }) => (
      <>
        <div className="btn-group-qtype">
          {(options ?? []).map((qt) => (
            <button key={qt.id} type="button"
              className={`btn-qtype${field.value === qt.name ? ' active' : ''}`}
              onClick={() => { field.onChange(qt.name); if (qt.name !== '其它') onQtypeInput('') }}>
              <span className="qtype-icon"><QTypeIconDisplay name={qt.name} /></span>
              <span className="qtype-label">{qt.name}</span>
            </button>
          ))}
        </div>
        {field.value === '其它' && (
          <input type="text" placeholder="請輸入提問方式說明" value={qtypeInput}
            onChange={(e) => onQtypeInput(e.target.value)} autoFocus style={{ marginTop: 8 }} />
        )}
      </>
    )} />
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditRecordModal({ record, user, onSave, onClose }: {
  record: AdminRow; user: User
  onSave: (rowIndex: number, values: EditFormValues, qTypeInput: string) => Promise<void>
  onClose: () => void
}) {
  const { data: options } = useFormOptions()
  const [qtypeInput, setQtypeInput] = useState('')
  const [subModuleInput, setSubModuleInput] = useState('')
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } =
    useForm<EditFormValues>({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolver: zodResolver(schema) as any,
      defaultValues: recordToFormValues(record),
    })

  const watchedSystem = watch('system')
  const watchedIsDone = watch('isDone')
  const isSystemOther = watchedSystem === '其它'
  const filteredSubModules = options?.subModules.filter((sm) => sm.parentSystem === watchedSystem) ?? []

  useEffect(() => { setValue('subModule', ''); setSubModuleInput('') }, [watchedSystem, setValue])

  const onSubmit = async (data: EditFormValues) => {
    setSaving(true)
    try { await onSave(record._rowIndex, data, qtypeInput); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>✏ 編輯記錄 #{String(record['id'] ?? '')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>處理人員（唯讀）</label>
          <div style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13 }}>
            {user.name}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <p className="section-divider">系統資訊</p>
          <div className="form-group">
            <label>系統別 <span className="required">*</span></label>
            <select autoFocus {...register('system')}>
              <option value="" disabled>— 請選擇 —</option>
              {options?.systems.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            {errors.system && <span className="field-error">⚠ {errors.system.message}</span>}
          </div>
          <div className="form-group">
            <label>子模組 <span className="required">*</span></label>
            {isSystemOther
              ? <input type="text" placeholder="請輸入子模組名稱" value={subModuleInput}
                  onChange={(e) => { setSubModuleInput(e.target.value); setValue('subModule', e.target.value) }} />
              : <select {...register('subModule')} disabled={!watchedSystem}>
                  <option value="" disabled>— 請先選系統別 —</option>
                  {filteredSubModules.map((sm) => <option key={sm.id} value={sm.name}>{sm.name}</option>)}
                </select>}
            {errors.subModule && <span className="field-error">⚠ {errors.subModule.message}</span>}
          </div>

          <p className="section-divider">提問資訊</p>
          <div className="form-group">
            <label>提問方式 <span className="required">*</span></label>
            <QTypeButtons control={control} options={options?.questionTypes} qtypeInput={qtypeInput} onQtypeInput={setQtypeInput} />
            {errors.questionType && <span className="field-error">⚠ {errors.questionType.message}</span>}
          </div>
          <div className="form-group">
            <label>提問人員 <span className="required">*</span></label>
            <select {...register('questioner')}>
              <option value="" disabled>— 請選擇 —</option>
              {options?.employees.map((e) => <option key={e.id} value={e.name}>{e.name}（{e.empId}）</option>)}
            </select>
            {errors.questioner && <span className="field-error">⚠ {errors.questioner.message}</span>}
          </div>
          <div className="form-group">
            <label>發問日期時間 <span className="required">*</span></label>
            <input type="datetime-local" {...register('questionDate')} />
          </div>

          <p className="section-divider">評級</p>
          <div className="form-grid-2">
            <div className="form-group"><label>難度 <span className="required">*</span></label><LevelButtons name="difficulty" control={control} /></div>
            <div className="form-group"><label>優先權 <span className="required">*</span></label><LevelButtons name="priority" control={control} /></div>
          </div>

          <p className="section-divider">完成狀態</p>
          <div className="form-group">
            <Controller control={control} name="isDone" render={({ field }) => (
              <div className="toggle-row" onClick={() => field.onChange(!field.value)}
                role="switch" aria-checked={field.value} tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); field.onChange(!field.value) } }}>
                <span>{field.value ? '✅ 已完成' : '⏳ 尚未完成'}</span>
                <div className={`toggle-switch ${field.value ? 'on' : ''}`} />
              </div>
            )} />
          </div>
          {watchedIsDone && (
            <div className="form-group">
              <label>結案日期時間</label>
              <input type="datetime-local" {...register('closedDate')} />
            </div>
          )}

          <p className="section-divider">其他資訊</p>
          <div className="form-group">
            <label>處理花費時間（分鐘）</label>
            <input type="number" min={0} step={1} placeholder="例：30" {...register('minutes')} />
          </div>
          <div className="form-group">
            <label>備註</label>
            <textarea rows={3} placeholder="備註說明…" {...register('note')} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? '儲存中…' : '✓ 儲存'}
            </button>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ flex: 0, padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Column config ─────────────────────────────────────────────────────────────
const BASE_COLS = [
  { key: 'id', label: 'ID' },
  { key: '系統別', label: '系統別' },
  { key: '子模組', label: '子模組' },
  { key: '提問人員', label: '提問人員' },
  { key: '難度', label: '難度' },
  { key: '優先權', label: '優先權' },
  { key: '提問日期', label: '提問日期' },
  { key: '提問方式', label: '提問方式' },
  { key: '是否完成', label: '完成' },
  { key: '建立日期時間', label: '建立時間' },
]
const ADMIN_COL = { key: '處理人員姓名', label: '處理人員' }

// quick-date preset helpers
function quickRange(days: number): [Date, Date] {
  const to = new Date(); to.setHours(23, 59, 59)
  const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0)
  return [from, to]
}
const QUICK_PRESETS = [
  { label: '今天', fn: () => quickRange(0) },
  { label: '本週', fn: () => quickRange(6) },
  { label: '本月', fn: (): [Date, Date] => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59)] } },
  { label: '全部', fn: (): [Date, Date] => [new Date(0), new Date()] },
]

// ── RecordsPage ───────────────────────────────────────────────────────────────
export default function RecordsPage() {
  const location = useLocation()
  const user = location.state?.user as User | undefined

  const [records, setRecords] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<AdminRow | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortKey, setSortKey] = useState('提問日期')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filters
  const [fPerson, setFPerson]         = useState('')
  const [fSystem, setFSystem]         = useState('')
  const [fSubModule, setFSubModule]   = useState('')
  const [fQuestioner, setFQuestioner] = useState('')
  const [fQType, setFQType]           = useState('')
  const [fDifficulty, setFDifficulty] = useState('')
  const [fPriority, setFPriority]     = useState('')
  const [fIsDone, setFIsDone]         = useState('')
  const [fFrom, setFFrom]             = useState<Date | null>(null)
  const [fTo, setFTo]                 = useState<Date | null>(null)

  // fSystem 變更時重置子模組
  useEffect(() => { setFSubModule('') }, [fSystem])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3500)
  }

  const fetchRecords = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try { setRecords(await getRecords(user.name, user.isAdmin)) }
    catch (e) { setError(e instanceof Error ? e.message : '讀取失敗') }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Unique values for dropdowns
  const uniq = (key: string) => [...new Set(records.map((r) => String(r[key] ?? '')))].filter(Boolean).sort()

  // Filter + sort
  const filtered = records.filter((r) => {
    if (fPerson     && String(r['處理人員姓名']) !== fPerson)    return false
    if (fSystem     && String(r['系統別']) !== fSystem)           return false
    if (fSubModule  && !String(r['子模組']).includes(fSubModule)) return false
    if (fQuestioner && String(r['提問人員']) !== fQuestioner)     return false
    if (fQType      && String(r['提問方式']) !== fQType)          return false
    if (fDifficulty && String(r['難度']) !== fDifficulty)         return false
    if (fPriority   && String(r['優先權']) !== fPriority)         return false
    if (fIsDone     && String(r['是否完成']) !== fIsDone)         return false
    if (fFrom || fTo) {
      const d = new Date(parseDateVal(r['提問日期']))
      if (fFrom && d < fFrom) return false
      if (fTo) { const toEnd = new Date(fTo); toEnd.setHours(23,59,59); if (d > toEnd) return false }
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortKey] ?? ''), bv = String(b[sortKey] ?? '')
    const cmp = av.localeCompare(bv, 'zh-TW', { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  // 日期顯示：轉成本地時間 + 24h
  const formatDateTime24 = (val: unknown): string => {
    if (!val) return ''
    const s = String(val)
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const clearFilters = () => {
    setFPerson(''); setFSystem(''); setFSubModule(''); setFQuestioner('')
    setFQType(''); setFDifficulty(''); setFPriority(''); setFIsDone('')
    setFFrom(null); setFTo(null)
  }

  const handleSave = async (rowIndex: number, values: EditFormValues, qTypeInput: string) => {
    if (!user) return
    await updateRecord(rowIndex, {
      system: values.system, subModule: values.subModule, handler: user.name,
      questioner: values.questioner, difficulty: values.difficulty, priority: values.priority,
      questionDate: values.questionDate,
      questionType: values.questionType === '其它' ? qTypeInput : values.questionType,
      isDone: values.isDone, closedDate: values.closedDate || undefined,
      minutes: Number(values.minutes) || undefined, note: values.note || undefined,
    })
    showToast('success', '記錄已更新')
    await fetchRecords()
  }

  const cols = user?.isAdmin ? [BASE_COLS[0], ADMIN_COL, ...BASE_COLS.slice(1)] : BASE_COLS

  if (!user) return (
    <div className="page-wrapper">
      <div className="card" style={{ textAlign: 'center', maxWidth: 360 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>請先選擇使用者</p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>返回登入</Link>
      </div>
    </div>
  )

  const hasFilter = fPerson || fSystem || fSubModule || fQuestioner || fQType || fDifficulty || fPriority || fIsDone || fFrom || fTo

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '20px 16px' }}>
      {/* Toast */}
      {toast && (
        <div className={`alert alert-${toast.type}`} style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, minWidth: 220 }}>
          {toast.type === 'success' ? '✅' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Edit Modal */}
      {editRecord && (
        <EditRecordModal record={editRecord} user={user} onSave={handleSave} onClose={() => setEditRecord(null)} />
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link to="/form" state={{ user }} className="back-link" style={{ margin: 0 }}>← 返回</Link>
          <div className="app-logo" style={{ margin: 0, flex: 1 }}>
            <div className="logo-icon">📋</div>
            <div className="logo-text">
              <h1>工作記錄查詢</h1>
              <p>{user.isAdmin ? '管理者：可查詢所有人員記錄' : `${user.name} 的記錄`}</p>
            </div>
          </div>
          <div className="user-badge" style={{ margin: 0 }}>{user.isAdmin ? '👑' : '👤'} {user.name}</div>
        </div>

        {/* Filter panel */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {/* Admin: person filter */}
            {user.isAdmin && (
              <select value={fPerson} onChange={(e) => setFPerson(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">👤 所有人員</option>
                {uniq('處理人員姓名').map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
            {/* System */}
            <select value={fSystem} onChange={(e) => setFSystem(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">🖥 系統別</option>
              {uniq('系統別').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* SubModule */}
            <select value={fSubModule} onChange={(e) => setFSubModule(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">📦 子模組</option>
              {records
                .filter((r) => !fSystem || String(r['系統別']) === fSystem)
                .map((r) => String(r['子模組'] ?? ''))
                .filter((v, i, arr) => v && arr.indexOf(v) === i)
                .sort()
                .map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* Questioner */}
            <select value={fQuestioner} onChange={(e) => setFQuestioner(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">🧑‍💼 提問人員</option>
              {uniq('提問人員').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* Question type */}
            <select value={fQType} onChange={(e) => setFQType(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">💬 提問方式</option>
              {uniq('提問方式').map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* Difficulty */}
            <select value={fDifficulty} onChange={(e) => setFDifficulty(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">💪 難度</option>
              {['高','中','低'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* Priority */}
            <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">🎯 優先權</option>
              {['高','中','低'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {/* isDone */}
            <select value={fIsDone} onChange={(e) => setFIsDone(e.target.value)} style={{ fontSize: 13 }}>
              <option value="">✅ 完成狀態</option>
              <option value="是">已完成</option>
              <option value="否">未完成</option>
            </select>
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>📅 日期範圍：</span>
            <DatePicker selected={fFrom} onChange={(d: Date | null) => setFFrom(d)}
              dateFormat="yyyy/MM/dd" placeholderText="開始日期" isClearable
              className="dp-input" wrapperClassName="dp-wrapper" />
            <span style={{ color: 'var(--text-dim)', alignSelf: 'center' }}>—</span>
            <DatePicker selected={fTo} onChange={(d: Date | null) => setFTo(d)}
              dateFormat="yyyy/MM/dd" placeholderText="結束日期" isClearable
              className="dp-input" wrapperClassName="dp-wrapper"
              minDate={fFrom ?? undefined} />
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {QUICK_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => { const [f, t] = p.fn(); setFFrom(p.label === '全部' ? null : f); setFTo(p.label === '全部' ? null : t) }}
                  style={{ padding: '6px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {p.label}
                </button>
              ))}
            </div>
            {hasFilter && (
              <button type="button" onClick={clearFilters}
                style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ 清除篩選
              </button>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: hasFilter ? 0 : 'auto', alignSelf: 'center' }}>
              共 <strong style={{ color: 'var(--text)' }}>{sorted.length}</strong> / {records.length} 筆
            </span>
          </div>
        </div>

        {/* Table */}
        {loading && <div className="spinner-wrap"><div className="spinner" /><span>載入中…</span></div>}
        {error && <div className="alert alert-error">⚠ {error} <button type="button" onClick={fetchRecords} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>重試</button></div>}

        {!loading && !error && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {cols.map((col) => {
                      const isSorted = sortKey === col.key
                      return (
                        <th key={col.key} onClick={() => handleSort(col.key)}
                          style={{ padding: '10px 14px', textAlign: 'left', color: isSorted ? 'var(--accent-hover)' : 'var(--text-muted)', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s' }}>
                          {col.label} {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
                        </th>
                      )
                    })}
                    <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border)', width: 80 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={cols.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                      {records.length === 0 ? '尚無工作記錄' : '沒有符合條件的記錄'}
                    </td></tr>
                  )}
                  {sorted.map((rec) => {
                    const diff = String(rec['難度'] ?? '')
                    const pri = String(rec['優先權'] ?? '')
                    const ZH_EN: Record<string, Level> = { 高:'HIGH', 中:'MID', 低:'LOW' }
                    const isDone = String(rec['是否完成']) === '是'
                    return (
                      <tr key={rec._rowIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                        {cols.map((col) => {
                          const v = String(rec[col.key] ?? '')
                          if (col.key === '難度') return <td key={col.key} style={{ padding: '8px 14px' }}><span className={`badge badge-${ZH_EN[diff] ?? 'MID'}`}>{diff}</span></td>
                          if (col.key === '優先權') return <td key={col.key} style={{ padding: '8px 14px' }}><span className={`badge badge-${ZH_EN[pri] ?? 'MID'}`}>{pri}</span></td>
                          if (col.key === '是否完成') return <td key={col.key} style={{ padding: '8px 14px' }}><span className={isDone ? 'badge badge-done' : 'badge badge-pending'}>{isDone ? '✅ 是' : '⏳ 否'}</span></td>
                          if (col.key === 'id') return <td key={col.key} style={{ padding: '8px 14px', color: 'var(--text-dim)' }}>{v}</td>
                          if (col.key.includes('日期') || col.key.includes('時間')) return <td key={col.key} style={{ padding: '8px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime24(rec[col.key])}</td>
                          return <td key={col.key} style={{ padding: '8px 14px' }}>{v}</td>
                        })}
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <button type="button" onClick={() => setEditRecord(rec)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent-hover)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            ✏
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
