import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import AppLayout from '../../components/AppLayout'
import { getRecords } from '../../services/api'
import type { AdminRow, User } from '../../types'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts'

const COLORS = ['#7c6ff7', '#f9a825', '#4eed9e', '#f97066', '#00bcd4', '#e91e63', '#9c27b0']

export default function DashboardPage() {
  const location = useLocation()
  const user = location.state?.user as User | undefined

  const [records, setRecords] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 篩選：預設為當月第一天至今天
  const todayStr = new Date().toISOString().substring(0, 10)
  const firstDayStr = todayStr.substring(0, 8) + '01'
  const [startDate, setStartDate] = useState<string>(firstDayStr)
  const [endDate, setEndDate] = useState<string>(todayStr)
  // 管理者可篩選人員
  const [fPerson, setFPerson] = useState<string>('')

  const fetchRecords = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const data = await getRecords(user.name, user.isAdmin)
      setRecords(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // 所有人員清單 (管理員用)
  const uniqPersons = useMemo(() => {
    return [...new Set(records.map(r => String(r['處理人員姓名'] ?? '')))].filter(Boolean).sort()
  }, [records])

  // 篩選過後的 records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (fPerson && String(r['處理人員姓名']) !== fPerson) return false
      const d = String(r['提問日期'] ?? '').substring(0, 10)
      if (startDate && d && d < startDate) return false
      if (endDate && d && d > endDate) return false
      return true
    })
  }, [records, fPerson, startDate, endDate])

  // KPI 計算
  const totalCases = filteredRecords.length
  const doneCases = filteredRecords.filter(r => String(r['是否完成']) === '是')
  const completionRate = totalCases > 0 ? Math.round((doneCases.length / totalCases) * 100) : 0
  
  const totalTime = doneCases.reduce((acc, r) => acc + (Number(r['處理分鐘數']) || 0), 0)
  const avgTime = doneCases.length > 0 ? Math.round(totalTime / doneCases.length) : 0
  
  const pendingCases = totalCases - doneCases.length
  const urgentPending = filteredRecords.filter(r => String(r['是否完成']) !== '是' && String(r['優先權']) === '高').length

  // 圖表 1：系統別圓餅圖
  const systemData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRecords.forEach(r => {
      const sys = String(r['系統別'] || '未知')
      map[sys] = (map[sys] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredRecords])

  // 圖表 2：工作趨勢折線圖 (每日案件數)
  const trendData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRecords.forEach(r => {
      const date = String(r['提問日期'] || '').substring(0, 10)
      if (date) map[date] = (map[date] || 0) + 1
    })
    return Object.entries(map)
      .map(([date, count]) => ({ date: date.substring(5), count })) // 僅顯示 MM-DD
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredRecords])

  // 圖表 3：難度與平均耗時 (長條圖)
  const difficultyTimeData = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {
      '高': { count: 0, total: 0 },
      '中': { count: 0, total: 0 },
      '低': { count: 0, total: 0 }
    }
    doneCases.forEach(r => {
      const diff = String(r['難度'] || '中')
      const time = Number(r['處理分鐘數']) || 0
      if (map[diff]) {
        map[diff].count += 1
        map[diff].total += time
      }
    })
    return ['高', '中', '低'].map(d => ({
      name: d,
      avgTime: map[d].count > 0 ? Math.round(map[d].total / map[d].count) : 0
    }))
  }, [doneCases])

  // 圖表 4：提問方式統計
  const qTypeData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredRecords.forEach(r => {
      const qt = String(r['提問方式'] || '其它')
      map[qt] = (map[qt] || 0) + 1
    })
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [filteredRecords])

  if (!user) {
    return (
      <div className="page-wrapper">
        <div className="card" style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>請先選擇使用者</p>
          <Link to="/" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>返回登入</Link>
        </div>
      </div>
    )
  }

  return (
    <AppLayout user={user}>
      {/* Header & Filter */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{ alignSelf: 'flex-start' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>儀表板</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>檢視工作負載與處理效率指標</p>
        </div>

        <div style={{ 
          display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', 
          background: 'var(--bg-elevated)', padding: '20px 32px', 
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)', width: '100%', maxWidth: '800px'
        }}>
          {user.isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>人員</span>
              <select 
                value={fPerson} 
                onChange={e => setFPerson(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, minWidth: '120px' }}
              >
                <option value="">👤 所有人</option>
                {uniqPersons.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>日期區間</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', colorScheme: 'dark', fontSize: 13 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', colorScheme: 'dark', fontSize: 13 }}
            />
          </div>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ width: 'auto', padding: '8px 16px', fontSize: 13, margin: 0, alignSelf: 'center' }}
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
          >
            全部時間
          </button>
        </div>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /><span>載入資料中…</span></div>
      ) : error ? (
        <div className="alert alert-error">⚠ {error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { label: '期間總案件數', value: totalCases, icon: '📝', color: 'var(--accent)' },
              { label: '累計耗時(分)', value: totalTime, icon: '⏳', color: 'var(--mid)' },
              { label: '完成率', value: `${completionRate}%`, icon: '✅', color: 'var(--low)' },
              { label: '平均耗時(分)', value: avgTime, icon: '⏱️', color: 'var(--mid)' },
              { label: '待處理案件', value: pendingCases, icon: '⏳', color: 'var(--text-muted)' },
              { label: '急件積壓', value: urgentPending, icon: '🔥', color: 'var(--high)' },
            ].map((kpi, idx) => (
              <div key={idx} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '20px 16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{kpi.label}</span>
                  <span style={{ fontSize: 18, opacity: 0.8 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Trend Chart */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>每日案件趨勢 (依提問日)</h3>
              {trendData.length > 0 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} itemStyle={{ color: 'var(--accent)' }} />
                      <Line type="monotone" dataKey="count" name="案件數" stroke="var(--accent)" strokeWidth={3} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>無資料</div>}
            </div>

            {/* System Pie Chart */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>系統別分佈</h3>
              {systemData.length > 0 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={systemData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {systemData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>無資料</div>}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Difficulty vs Time */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>難度與平均耗時分析</h3>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={difficultyTimeData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} width={50} />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} formatter={(v: number | string | Array<number | string> | undefined) => [`${v ?? 0} 分鐘`, '平均時間']} />
                    <Bar dataKey="avgTime" name="處理時間" fill="var(--mid)" radius={[0, 4, 4, 0]}>
                      {difficultyTimeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === '高' ? 'var(--high)' : entry.name === '低' ? 'var(--low)' : 'var(--mid)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Question Type */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>提問方式佔比</h3>
              {qTypeData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={qTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                      <Bar dataKey="count" name="次數" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>無資料</div>}
            </div>
          </div>

        </div>
      )}
    </AppLayout>
  )
}
