import type {
  User,
  FormOptions,
  WorkItemPayload,
  AdminSheetKey,
  AdminSheetData,
} from '../types'

// dev: Vite server-side proxy（no CORS）; prod: direct GAS URL
const PROXY = import.meta.env.DEV ? '/gas-proxy' : (import.meta.env.VITE_GAS_URL as string)
const GAS_PROD_URL = import.meta.env.VITE_GAS_URL as string

// ── GET ───────────────────────────────────────────────────────────────────────
async function gasGet<T>(action: string, extra?: string): Promise<T> {
  const qs = extra ? `action=${action}&${extra}` : `action=${action}`
  const res = await fetch(`${PROXY}?${qs}`, { redirect: 'follow' })
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`GAS 回應非 JSON：${text.slice(0, 200)}`)
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`GAS POST 回應非 JSON：${text.slice(0, 200)}`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  if (!GAS_PROD_URL) return MOCK_USERS
  return gasGet<User[]>('getUsers')
}

export async function getFormOptions(): Promise<FormOptions> {
  if (!GAS_PROD_URL) return MOCK_OPTIONS
  return gasGet<FormOptions>('getFormOptions')
}

export async function submitWorkItem(payload: WorkItemPayload): Promise<void> {
  if (!GAS_PROD_URL) {
    console.log('[mock] submitWorkItem', payload)
    return
  }
  await gasPost({ action: 'appendRecord', ...payload })
}

export async function getRecords(
  handlerName: string,
  isAdmin: boolean,
): Promise<import('../types').AdminRow[]> {
  if (!GAS_PROD_URL) return []
  return gasGet(
    'getRecords',
    `handler=${encodeURIComponent(handlerName)}&isAdmin=${isAdmin}`,
  )
}

export async function updateRecord(
  rowIndex: number,
  payload: WorkItemPayload,
): Promise<void> {
  if (!GAS_PROD_URL) return
  const result = await gasPost<{ status: string; message?: string }>({
    action: 'updateRecord',
    rowIndex,
    rowData: payload,
  })
  if (result.status !== 'ok') throw new Error(result.message ?? '更新失敗')
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function getAdminSheet(sheet: AdminSheetKey): Promise<AdminSheetData> {
  if (!GAS_PROD_URL) return getMockAdminSheet(sheet)
  return gasGet<AdminSheetData>('getAdminSheet', `sheet=${sheet}`)
}

export async function addAdminRow(
  sheet: AdminSheetKey,
  rowData: Record<string, string | number>,
  headers: string[],
): Promise<void> {
  if (!GAS_PROD_URL) return
  const result = await gasPost<{ status: string; message?: string }>({
    action: 'addAdminRow',
    sheet,
    rowData,
    headers,
  })
  if (result.status !== 'ok') throw new Error(result.message ?? '新增失敗')
}

export async function saveAdminRow(
  sheet: AdminSheetKey,
  rowIndex: number,
  rowData: Record<string, string | number>,
  headers: string[],
): Promise<void> {
  if (!GAS_PROD_URL) return
  const result = await gasPost<{ status: string; message?: string }>({
    action: 'saveAdminRow',
    sheet,
    rowIndex,
    rowData,
    headers,
  })
  if (result.status !== 'ok') throw new Error(result.message ?? '儲存失敗')
}

export async function deleteAdminRow(
  sheet: AdminSheetKey,
  rowIndex: number,
): Promise<void> {
  if (!GAS_PROD_URL) return
  const result = await gasPost<{ status: string; message?: string }>({
    action: 'deleteAdminRow',
    sheet,
    rowIndex,
  })
  if (result.status !== 'ok') throw new Error(result.message ?? '刪除失敗')
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USERS: User[] = [
  { id: '1', empId: 'E001', name: '張小明', loginId: 'ming', isAdmin: true },
  { id: '2', empId: 'E002', name: '李大華', loginId: 'hua', isAdmin: false },
  { id: '3', empId: 'E003', name: '王美麗', loginId: 'meli', isAdmin: false },
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

function getMockAdminSheet(sheet: AdminSheetKey): AdminSheetData {
  const map: Record<AdminSheetKey, AdminSheetData> = {
    users: {
      headers: ['id', '使用者工號', '使用者姓名', 'LOGIN ID', 'Password', '是否啟用', '是否為管理者'],
      data: [
        { _rowIndex: 2, id: 1, 使用者工號: 'E001', 使用者姓名: '張小明', 'LOGIN ID': 'ming', Password: 'ming', 是否啟用: 'Y', 是否為管理者: 'Y' },
        { _rowIndex: 3, id: 2, 使用者工號: 'E002', 使用者姓名: '李大華', 'LOGIN ID': 'hua', Password: 'hua', 是否啟用: 'Y', 是否為管理者: 'N' },
      ],
    },
    systems: {
      headers: ['id', '系統別', '是否開啟', '排序'],
      data: [
        { _rowIndex: 2, id: 1, 系統別: 'ERP', 是否開啟: 'Y', 排序: 1 },
        { _rowIndex: 3, id: 2, 系統別: 'CRM', 是否開啟: 'Y', 排序: 2 },
      ],
    },
    subModules: {
      headers: ['id', '父系統', '子模組', '是否開啟', '排序'],
      data: [
        { _rowIndex: 2, id: 1, 父系統: 'ERP', 子模組: '採購模組', 是否開啟: 'Y', 排序: 1 },
      ],
    },
    questionTypes: {
      headers: ['id', '提問方式', '是否開啟', '排序'],
      data: [
        { _rowIndex: 2, id: 1, 提問方式: '電話', 是否開啟: 'Y', 排序: 1 },
      ],
    },
    employees: {
      headers: ['id', '提問人工號', '提問人姓名', '是否開啟'],
      data: [
        { _rowIndex: 2, id: 1, 提問人工號: 'S001', 提問人姓名: '陳一心', 是否開啟: 'Y' },
      ],
    },
  }
  return map[sheet]
}
