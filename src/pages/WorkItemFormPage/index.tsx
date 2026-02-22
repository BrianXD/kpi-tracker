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
import AppLayout from '../../components/AppLayout'

// ── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  system: z.string().min(1, '請選擇系統別'),
  subModule: z.string().optional(),
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

// 提問方式 Icon 元件（支援 Email/Teams/LINE SVG + 各自独立 emoji）
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
  // 每個名稱對應唯一 emoji
  const EMOJI: Record<string, string> = {
    '電話': '☎️',   // 耶筒
    '現場': '🤝',   // 面對面
    '口述': '🗣️',   // 口述說明
    'Slack': '📬',   // 信件夺
    'Zoom': '📹',   // 視訊
    '對講': '📢',   // 廣播
    'WhatsApp': '📱', // 手機訊息
    '其它': '✏️',   // 其它
  }
  return <span style={{ fontSize: 18 }}>{EMOJI[name] ?? '📝'}</span>
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
          {field.value === '其它' && (
            <input
              type="text"
              placeholder="請輸入提問方式說明"
              value={qtypeInput}
              onChange={(e) => onQtypeInput(e.target.value)}
              autoFocus
              style={{ display: 'inline-block', width: '200px', flex: '1 1 auto', margin: 0 }}
            />
          )}
        </div>
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
  const [questionTypeInput, setQuestionTypeInput] = useState('')

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    getValues,
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
      isDone: true,
      closedDate: toDatetimeLocal(new Date()),
      minutes: undefined,
      note: '',
    }
  })

  const watchedSystem = watch('system')
  const watchedMinutes = watch('minutes')

  const filteredSubModules =
    options?.subModules.filter((sm) => sm.parentSystem === watchedSystem) ?? []

  // 1. 初始化預設值
  useEffect(() => {
    if (options && !optLoading) {
      const curSys = getValues('system')
      const curEr = getValues('questioner')
      const curQt = getValues('questionType')

      // 若全空代表表單初次載入，設定各欄位第一項為預設
      if (!curSys && !curEr && !curQt) {
        const firstSys = options.systems[0]?.name || ''
        const firstErItem = options.employees[0]
        const firstEr = firstErItem ? `${firstErItem.name}（${firstErItem.empId}）` : ''
        const firstQt = options.questionTypes[0]?.name || ''

        setValue('system', firstSys)
        setValue('questioner', firstEr)
        setValue('questionType', firstQt)
        if (firstQt !== '其它') setQuestionTypeInput('')
      }
    }
  }, [options, optLoading, setValue, getValues])

  // 2. 當選擇的「系統別」改變時，自動將子模組切換到該系統的第一項
  useEffect(() => {
    const currentSmList = options?.subModules.filter((sm) => sm.parentSystem === watchedSystem) ?? []
    if (currentSmList.length > 0) {
      const curSm = getValues('subModule')
      if (!currentSmList.some(s => s.name === curSm)) {
        setValue('subModule', currentSmList[0].name)
      }
    }
  }, [watchedSystem, options?.subModules, setValue, getValues])

  const onSubmit = async (data: FormValues) => {
    if (!user) return
    setStatus('submitting')
    setErrMsg('')

    const isQTypeOther = data.questionType === '其它'
    const finalQuestionType = isQTypeOther ? questionTypeInput : data.questionType
    if (isQTypeOther && !questionTypeInput.trim()) {
      setStatus('idle')
      setErrMsg('請填寫提問方式')
      return
    }

    try {
      await submitWorkItem({
        system: data.system,
        subModule: data.subModule || '',
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
        isDone: true,
        closedDate: toDatetimeLocal(new Date()),
        minutes: undefined,
        note: '',
      })
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
    <AppLayout user={user}>
      {/* Success overlay */}
      {status === 'success' && (
        <div className="success-overlay">
          <div className="success-card">
            <span className="success-emoji">✅</span>
            <p>記錄已成功送出！</p>
            <small>表單已清空，可繼續新增項目</small>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>新增工作記錄</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>填寫本次處理的工作項目，記錄將同步至 Google Sheets</p>
      </div>

      {/* Inline alerts */}
      {status === 'error' && <div className="alert alert-error">⚠ {errMsg}</div>}
      {errMsg && status === 'idle' && <div className="alert alert-error">⚠ {errMsg}</div>}
      {optError && <div className="alert alert-error">⚠ 下拉資料載入失敗：{optError}</div>}

      <div className="card form-card">
        {optLoading ? (
          <div className="spinner-wrap"><div className="spinner" /><span>載入基礎資料中…</span></div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              // 支援 Ctrl + Enter 快捷鍵送出
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSubmit(onSubmit)()
              }
            }}
            noValidate
          >

              <p className="section-divider">提問資訊</p>

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

              <div className="form-group">
                <label htmlFor="system">系統別 <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <select id="system" autoFocus {...register('system')} style={{ flex: 1 }}>
                    <option value="" disabled>— 請選擇 —</option>
                    {options?.systems.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {errors.system && <span className="field-error">⚠ {errors.system.message}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="subModule">子模組</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <select id="subModule" {...register('subModule')} disabled={!watchedSystem || filteredSubModules.length === 0} style={{ flex: 1 }}>
                    <option value="">{watchedSystem && filteredSubModules.length === 0 ? '— 無子模組選項 —' : '— 請先選系統別 —'}</option>
                    {filteredSubModules.map((sm) => (
                      <option key={sm.id} value={sm.name}>{sm.name}</option>
                    ))}
                  </select>
                </div>
                {errors.subModule && <span className="field-error">⚠ {errors.subModule.message}</span>}
              </div>

              <div className="form-group">
                <label>提問方式 <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <QuestionTypeButtons
                    control={control}
                    options={options?.questionTypes}
                    qtypeInput={questionTypeInput}
                    onQtypeInput={setQuestionTypeInput}
                  />
                </div>
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

              <p className="section-divider">評級與進度</p>

              <div className="form-group">
                <label>難度 <span className="required">*</span></label>
                <LevelButtons name="difficulty" control={control} />
              </div>

              <div className="form-group">
                <label>優先權 <span className="required">*</span></label>
                <LevelButtons name="priority" control={control} />
              </div>

              <div className="form-group">
                <label>完成狀態</label>
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
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {[10, 20, 30, 40, 50, 60, 90, 120].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setValue('minutes', m, { shouldValidate: true })}
                      style={{
                        padding: '4px 10px', fontSize: 13, borderRadius: 16, border: '1px solid var(--border)',
                        background: watchedMinutes === m ? 'var(--accent)' : 'var(--bg-elevated)',
                        color: watchedMinutes === m ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {m}分
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="note">備註</label>
                <textarea
                  id="note"
                  rows={3}
                  placeholder="選填備註說明…"
                  {...register('note')}
                  style={{ width: '100%', resize: 'vertical', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

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

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={status === 'submitting'}
                  style={{ maxWidth: '100%' }}
                >
                  {status === 'submitting' ? '送出中…' : '送出記錄 ✓ (Ctrl+Enter)'}
                </button>
              </div>

            </form>
        )}
      </div>
    </AppLayout>
  )
}
