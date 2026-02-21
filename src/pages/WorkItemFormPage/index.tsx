import { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import type { User, Level } from '../../types'
import { submitWorkItem } from '../../services/api'
import { useFormOptions } from '../../hooks/useFormOptions'

// ── Schema ───────────────────────────────────────────────────────────────────
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

type FormValues = z.infer<typeof schema>

// ── Utils ────────────────────────────────────────────────────────────────────
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const levelLabels: Record<Level, string> = { HIGH: '高', MID: '中', LOW: '低' }

// 提問方式 Icon 元件（支援 Email/Teams/LINE SVG）
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

// ── LevelButtons ─────────────────────────────────────────────────────────────
function LevelButtons({
  name,
  control,
}: {
  name: 'difficulty' | 'priority'
  control: Control<FormValues>
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="btn-group">
          {(['HIGH', 'MID', 'LOW'] as Level[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`btn-level${field.value === v ? ` active-${v}` : ''}`}
              onClick={() => field.onChange(v)}
            >
              {levelLabels[v]}
            </button>
          ))}
        </div>
      )}
    />
  )
}

// ── QuestionTypeButtons ───────────────────────────────────────────────────────
function QuestionTypeButtons({
  control,
  options,
  qtypeInput,
  onQtypeInput,
}: {
  control: Control<FormValues>
  options: import('../../types').QuestionType[] | undefined
  qtypeInput: string
  onQtypeInput: (v: string) => void
}) {
  return (
    <Controller
      control={control}
      name="questionType"
      render={({ field }) => (
        <>
          <div className="btn-group-qtype">
            {(options ?? []).map((qt) => (
              <button
                key={qt.id}
                type="button"
                className={`btn-qtype${field.value === qt.name ? ' active' : ''}`}
                onClick={() => {
                  field.onChange(qt.name)
                  if (qt.name !== '其它') onQtypeInput('')
                }}
              >
                <span className="qtype-icon"><QTypeIconDisplay name={qt.name} /></span>
                <span className="qtype-label">{qt.name}</span>
              </button>
            ))}
          </div>
          {field.value === '其它' && (
            <input
              type="text"
              placeholder="請輸入提問方式說明"
              value={qtypeInput}
              onChange={(e) => onQtypeInput(e.target.value)}
              autoFocus
              style={{ marginTop: 8 }}
            />
          )}
        </>
      )}
    />
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function WorkItemFormPage() {
  const location = useLocation()
  const user = location.state?.user as User | undefined
  const { data: options, loading: optLoading, error: optError } = useFormOptions()

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const [subModuleInput, setSubModuleInput] = useState('')
  const [questionTypeInput, setQuestionTypeInput] = useState('')

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({ resolver: zodResolver(schema) as any,
    defaultValues: {
      system: '',
      subModule: '',
      questionType: '',
      questioner: '',
      questionDate: toDatetimeLocal(new Date()),
      difficulty: 'MID',
      priority: 'MID',
      isDone: false,
      closedDate: '',
      minutes: undefined,
      note: '',
    },
  })

  const watchedSystem = watch('system')
  const watchedIsDone = watch('isDone')
  const isSystemOther = watchedSystem === '其它'

  const filteredSubModules =
    options?.subModules.filter((sm) => sm.parentSystem === watchedSystem) ?? []

  useEffect(() => {
    setValue('subModule', '')
    setSubModuleInput('')
  }, [watchedSystem, setValue])

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setStatus('submitting')
    setErrMsg('')

    const finalSubModule = isSystemOther ? subModuleInput : data.subModule
    const isQTypeOther = data.questionType === '其它'
    const finalQuestionType = isQTypeOther ? questionTypeInput : data.questionType

    if (isSystemOther && !subModuleInput.trim()) {
      setStatus('idle')
      setErrMsg('請填寫子模組名稱')
      return
    }
    if (isQTypeOther && !questionTypeInput.trim()) {
      setStatus('idle')
      setErrMsg('請填寫提問方式')
      return
    }

    try {
      await submitWorkItem({
        system: data.system,
        subModule: finalSubModule,
        handler: user.name,
        questioner: data.questioner,
        difficulty: data.difficulty,
        priority: data.priority,
        questionDate: data.questionDate,
        questionType: finalQuestionType,
        isDone: data.isDone,
        closedDate: data.closedDate || undefined,
        minutes: Number(data.minutes) || undefined,
        note: data.note || undefined,
      })

      setStatus('success')
      reset({
        system: '',
        subModule: '',
        questionType: '',
        questioner: '',
        questionDate: toDatetimeLocal(new Date()),
        difficulty: 'MID',
        priority: 'MID',
        isDone: false,
        closedDate: '',
        minutes: '',
        note: '',
      })
      setSubModuleInput('')
      setQuestionTypeInput('')
      successTimer.current = setTimeout(() => setStatus('idle'), 4000)
    } catch (e) {
      setStatus('error')
      setErrMsg(e instanceof Error ? e.message : '送出失敗，請稍後再試')
    }
  }

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>請先選擇使用者</p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            返回登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrapper" style={{ alignItems: 'flex-start', paddingTop: 24 }}>
      <div className="card">
        <div className="app-logo">
          <div className="logo-icon">📋</div>
          <div className="logo-text">
            <h1>工作記錄</h1>
            <p>KPI Tracker</p>
          </div>
        </div>

        <Link to="/" className="back-link">← 切換使用者</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="user-badge" style={{ margin: 0 }}>
            👤 {user.name}（{user.empId}）
          </div>
          {user.isAdmin && (
            <Link
              to="/admin"
              state={{ user }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(249,168,37,0.12)',
                border: '1px solid rgba(249,168,37,0.3)',
                color: 'var(--mid)',
                fontSize: 13,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              ⚙ 系統管理
            </Link>
          )}
          <Link
            to="/records"
            state={{ user }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(124,111,247,0.12)',
              border: '1px solid rgba(124,111,247,0.3)',
              color: 'var(--accent-hover)',
              fontSize: 13,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            📋 查詢記錄
          </Link>
        </div>


        {/* 送出成功 overlay */}
        {status === 'success' && (
          <div className="success-overlay">
            <div className="success-card">
              <span className="success-emoji">✅</span>
              <p>記錄已成功送出！</p>
              <small>表單已清空，可繼續新增項目</small>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="alert alert-error">⚠ {errMsg}</div>
        )}
        {errMsg && status === 'idle' && (
          <div className="alert alert-error">⚠ {errMsg}</div>
        )}
        {optError && (
          <div className="alert alert-error">⚠ 下拉資料載入失敗：{optError}</div>
        )}

        {optLoading ? (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span>載入下拉資料中…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            <p className="section-divider">系統資訊</p>

            <div className="form-group">
              <label htmlFor="system">系統別 <span className="required">*</span></label>
              <select id="system" autoFocus {...register('system')}>
                <option value="" disabled>— 請選擇 —</option>
                {options?.systems.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {errors.system && <span className="field-error">⚠ {errors.system.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="subModule">子模組 <span className="required">*</span></label>
              {isSystemOther ? (
                <input
                  id="subModule"
                  type="text"
                  placeholder="請輸入子模組名稱"
                  value={subModuleInput}
                  onChange={(e) => {
                    setSubModuleInput(e.target.value)
                    setValue('subModule', e.target.value)
                  }}
                />
              ) : (
                <select id="subModule" {...register('subModule')} disabled={!watchedSystem}>
                  <option value="" disabled>— 請先選系統別 —</option>
                  {filteredSubModules.map((sm) => (
                    <option key={sm.id} value={sm.name}>{sm.name}</option>
                  ))}
                </select>
              )}
              {errors.subModule && <span className="field-error">⚠ {errors.subModule.message}</span>}
            </div>

            <p className="section-divider">提問資訊</p>

            <div className="form-group">
              <label>提問方式 <span className="required">*</span></label>
              <QuestionTypeButtons
                control={control}
                options={options?.questionTypes}
                qtypeInput={questionTypeInput}
                onQtypeInput={setQuestionTypeInput}
              />
              {errors.questionType && <span className="field-error">⚠ {errors.questionType.message}</span>}
            </div>


            <div className="form-group">
              <label htmlFor="questioner">提問人員 <span className="required">*</span></label>
              <select id="questioner" {...register('questioner')}>
                <option value="" disabled>— 請選擇 —</option>
                {options?.employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name}（{emp.empId}）</option>
                ))}
              </select>
              {errors.questioner && <span className="field-error">⚠ {errors.questioner.message}</span>}
            </div>

            <div className="form-group">
              <label>發問日期時間 <span className="required">*</span></label>
              <Controller
                control={control}
                name="questionDate"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value ? new Date(field.value) : null}
                    onChange={(d: Date | null) => field.onChange(d ? toDatetimeLocal(d) : '')}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={5}
                    dateFormat="yyyy/MM/dd HH:mm"
                    placeholderText="請選擇日期時間"
                    timeCaption="時間"
                    className="dp-input-full"
                    wrapperClassName="dp-wrapper-full"
                  />
                )}
              />
              {errors.questionDate && <span className="field-error">⚠ {errors.questionDate.message}</span>}
            </div>

            <p className="section-divider">評級</p>

            <div className="form-grid-2">
              <div className="form-group">
                <label>難度 <span className="required">*</span></label>
                <LevelButtons name="difficulty" control={control} />
              </div>
              <div className="form-group">
                <label>優先權 <span className="required">*</span></label>
                <LevelButtons name="priority" control={control} />
              </div>
            </div>

            <p className="section-divider">完成狀態</p>

            <div className="form-group">
              <Controller
                control={control}
                name="isDone"
                render={({ field }) => (
                  <div
                    className="toggle-row"
                    onClick={() => field.onChange(!field.value)}
                    role="switch"
                    aria-checked={field.value}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        field.onChange(!field.value)
                      }
                    }}
                  >
                    <span>{field.value ? '✅ 已完成' : '⏳ 尚未完成'}</span>
                    <div className={`toggle-switch ${field.value ? 'on' : ''}`} />
                  </div>
                )}
              />
            </div>

            {watchedIsDone && (
              <div className="form-group">
                <label>結案日期時間</label>
                <Controller
                  control={control}
                  name="closedDate"
                  render={({ field }) => (
                    <DatePicker
                      selected={field.value ? new Date(field.value) : null}
                      onChange={(d: Date | null) => field.onChange(d ? toDatetimeLocal(d) : '')}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={5}
                      dateFormat="yyyy/MM/dd HH:mm"
                      placeholderText="請選擇日期時間"
                      timeCaption="時間"
                      className="dp-input-full"
                      wrapperClassName="dp-wrapper-full"
                    />
                  )}
                />
              </div>
            )}

            <p className="section-divider">其他資訊</p>

            <div className="form-group">
              <label htmlFor="minutes">處理花費時間（分鐘）</label>
              <input
                id="minutes"
                type="number"
                min={0}
                step={1}
                placeholder="例：30"
                {...register('minutes')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="note">備註</label>
              <textarea id="note" rows={3} placeholder="選填備註說明…" {...register('note')} />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? '送出中…' : '送出記錄 ✓'}
            </button>

          </form>
        )}
      </div>
    </div>
  )
}
