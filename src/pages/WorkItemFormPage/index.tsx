import { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useForm, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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

// ── LevelButtons (hoisted outside main component) ────────────────────────────
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

        <div className="user-badge">
          👤 {user.name}（{user.empId}）
        </div>

        {status === 'success' && (
          <div className="alert alert-success">✅ 記錄已成功送出！</div>
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
              <label htmlFor="questionType">提問方式 <span className="required">*</span></label>
              <Controller
                control={control}
                name="questionType"
                render={({ field }) =>
                  field.value === '其它' ? (
                    <input
                      type="text"
                      placeholder="請輸入提問方式"
                      value={questionTypeInput}
                      onChange={(e) => setQuestionTypeInput(e.target.value)}
                    />
                  ) : (
                    <select
                      id="questionType"
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value)
                        if (e.target.value !== '其它') setQuestionTypeInput('')
                      }}
                    >
                      <option value="" disabled>— 請選擇 —</option>
                      {options?.questionTypes.map((qt) => (
                        <option key={qt.id} value={qt.name}>{qt.name}</option>
                      ))}
                    </select>
                  )
                }
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
              <label htmlFor="questionDate">發問日期時間 <span className="required">*</span></label>
              <input id="questionDate" type="datetime-local" {...register('questionDate')} />
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
                <label htmlFor="closedDate">結案日期時間</label>
                <input id="closedDate" type="datetime-local" {...register('closedDate')} />
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
