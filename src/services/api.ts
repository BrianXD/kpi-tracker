import type {
  User,
  FormOptions,
  WorkItemPayload,
} from '../types'

// dev: 走 Vite server-side proxy（/gas-proxy），Node.js 幫忙 follow GAS redirect，不受 CORS 限制
// prod: 直連 GAS URL
const GAS_URL = import.meta.env.DEV
  ? '/gas-proxy'
  : (import.meta.env.VITE_GAS_URL as string)

async function gasGet<T>(action: string): Promise<T> {
  const res = await fetch(`${GAS_URL}?action=${action}`, {
    redirect: 'follow',
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`GAS 回應非 JSON：${text.slice(0, 200)}`)
  }
}

export async function getUsers(): Promise<User[]> {
  if (!GAS_URL) return MOCK_USERS
  return gasGet<User[]>('getUsers')
}

export async function getFormOptions(): Promise<FormOptions> {
  if (!GAS_URL) return MOCK_OPTIONS
  return gasGet<FormOptions>('getFormOptions')
}

export async function submitWorkItem(payload: WorkItemPayload): Promise<void> {
  if (!GAS_URL) {
    console.log('[mock] submitWorkItem', payload)
    return
  }
  // no-cors: response is opaque, assume success
  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// ── Mock data for local dev ──────────────────────────────────────────────────

const MOCK_USERS: User[] = [
  { id: '1', empId: 'E001', name: '張小明', loginId: 'ming' },
  { id: '2', empId: 'E002', name: '李大華', loginId: 'hua' },
  { id: '3', empId: 'E003', name: '王美麗', loginId: 'meli' },
]

const MOCK_OPTIONS: FormOptions = {
  systems: [
    { id: '1', name: 'ERP', order: 1 },
    { id: '2', name: 'CRM', order: 2 },
    { id: '3', name: 'OA', order: 3 },
    { id: '4', name: '其它', order: 99 },
  ],
  subModules: [
    { id: '1', parentSystem: 'ERP', name: '採購模組', order: 1 },
    { id: '2', parentSystem: 'ERP', name: '庫存管理', order: 2 },
    { id: '3', parentSystem: 'ERP', name: '財務報表', order: 3 },
    { id: '4', parentSystem: 'CRM', name: '客戶管理', order: 1 },
    { id: '5', parentSystem: 'CRM', name: '業務追蹤', order: 2 },
    { id: '6', parentSystem: 'OA', name: '請假系統', order: 1 },
    { id: '7', parentSystem: 'OA', name: '公文流程', order: 2 },
  ],
  questionTypes: [
    { id: '1', name: '電話', order: 1 },
    { id: '2', name: 'Email', order: 2 },
    { id: '3', name: '現場', order: 3 },
    { id: '4', name: 'Teams', order: 4 },
    { id: '5', name: '其它', order: 99 },
  ],
  employees: [
    { id: '1', empId: 'S001', name: '陳一心' },
    { id: '2', empId: 'S002', name: '林二郎' },
    { id: '3', empId: 'S003', name: '黃三妹' },
    { id: '4', empId: 'S004', name: '吳四方' },
  ],
}
