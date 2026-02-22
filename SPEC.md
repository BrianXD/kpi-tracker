# KPI Tracker — 系統規格書

> **版本**：1.3.0
> **最後更新**：2026-02-21
> **維護方式**：本文件由 AI 自動維護，規格變更時同步更新

---

## 1. 系統概述

| 項目       | 內容                                              |
| ---------- | ------------------------------------------------- |
| 系統名稱   | KPI Tracker — 工作記錄系統                        |
| 目的       | 上班時記錄所有處理的工作事項，供主管查閱 KPI      |
| 使用者對象 | 公司內部員工（處理人員）、主管（查閱者）          |
| 前端框架   | React 19 + Vite 7 + TypeScript                    |
| 後端       | Google Apps Script（GAS）Web App                  |
| 資料庫     | Google Sheets                                     |
| 部署方式   | 前端 Vite Dev Server / 靜態部署；後端 GAS Web App |

---

## 2. 系統架構

```
┌──────────────────────────────────────────────┐
│  前端 React App (Vite)                        │
│                                              │
│  LoginPage  →  WorkItemFormPage              │
│  (選使用者)     (填寫工作記錄)                 │
└──────────────┬───────────────────────────────┘
               │ HTTP (dev: /gas-proxy → Node.js server-side)
               │ HTTP (prod: 直連 GAS URL)
               ▼
┌──────────────────────────────────────────────┐
│  Google Apps Script (GAS) Web App            │
│                                              │
│  doGet(action)  →  讀取各工作表資料            │
│  doPost(data)   →  寫入問題清單記錄            │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Google Sheets                               │
│  使用者 / 系統別 / 子模組 / 提問方式           │
│  員工資料 / 問題清單記錄                       │
└──────────────────────────────────────────────┘
```

### CORS 解決方案（開發環境）

GAS Web App 回應 302 redirect，瀏覽器直接 fetch 會遇到 CORS 問題。  
解法：Vite dev server 加入自訂 middleware（`/gas-proxy`），由 Node.js 在 server 端 fetch GAS 再回傳給瀏覽器。

---

## 3. 環境變數

| 變數名         | 說明                 | 範例                                          |
| -------------- | -------------------- | --------------------------------------------- |
| `VITE_GAS_URL` | GAS Web App 部署 URL | `https://script.google.com/macros/s/.../exec` |

設定檔：`.env`（不進版本控制）；範本：`.env.example`

---

## 4. 頁面規格

### 4.1 LoginPage（首頁）

**路由**：`/`

**功能**：
- 從 GAS 讀取「使用者」工作表取得名單
- 使用者下拉選單（顯示格式：`{姓名}（{工號}）`）
- 「記住我」checkbox → 儲存選取的 userId 至 `localStorage`
- 送出後導向 `/form`，透過 `location.state.user` 傳遞使用者資料

**狀態**：
- 頁面載入時若 localStorage 有記住的 userId，自動帶入選單（不自動跳轉）
- Loading spinner 於資料載入中顯示
- API 錯誤顯示 alert-error

---

### 4.2 WorkItemFormPage（工作記錄表單）

**路由**：`/form`

**功能**：填寫一筆工作記錄並送出至 GAS

**若未登入（無 `location.state.user`）**：顯示「請先選擇使用者」並提供返回連結

**表單欄位規格**：

| 欄位                 | 類型                | 來源                            | 必填 | 備註                                                                           |
| -------------------- | ------------------- | ------------------------------- | ---- | ------------------------------------------------------------------------------ |
| 系統別               | 下拉選單            | Google Sheets「系統別」工作表   | ✅    | 選「其它」時子模組切換為文字輸入                                               |
| 子模組               | 下拉選單 / 文字輸入 | Google Sheets「子模組」工作表   | ✅    | 依系統別過濾；系統別為「其它」時變輸入框                                       |
| 提問方式             | Icon 按鈕組         | Google Sheets「提問方式」工作表 | ✅    | Email/Teams/LINE 使用 SVG 圖示；其餘各有唯一 emoji；選「其它」後下方出現文字框 |
| 提問人員             | 下拉選單            | Google Sheets「員工資料」工作表 | ✅    | 顯示格式：`{姓名}（{工號}）`                                                   |
| 發問日期時間         | react-datepicker    | —                               | ✅    | 24 小時制；預設：當下日期時間                                                  |
| 難度                 | 三按鈕（高/中/低）  | —                               | ✅    | 預設：中                                                                       |
| 優先權               | 三按鈕（高/中/低）  | —                               | ✅    | 預設：中                                                                       |
| 是否完成             | Toggle 開關         | —                               | ✅    | 預設：否（⏳ 尚未完成）                                                         |
| 結案日期時間         | react-datepicker    | —                               | ❌    | 僅在「是否完成=是」時顯示；24 小時制                                           |
| 處理花費時間（分鐘） | number              | —                               | ❌    | 最小值 0，整數                                                                 |
| 備註                 | text input          | —                               | ❌    | 單行文字（單行 input 取代 textarea）                                           |

**表單驗證**：使用 `react-hook-form` + `zod`

**送出行為**：
- POST 至 GAS（`mode: no-cors`，無法讀取回應）
- 前端假設送出成功
- 成功後：顯示全螢幕成功 overlay（動畫彈出，4 秒後消失）、清空表單（保留使用者身份）

**Layout（PC-first）**：
- 使用 `AppLayout` 共用元件，呈現 **Sidebar（260px）+ Main** 兩欄結構
- **Sidebar**：Logo、使用者 Card（姓名/工號/身份）、導覽選單（新增記錄 / 查詢記錄 / 系統管理）、底部切換使用者
- **Main**：頁面標題 + 副標題、Alerts、表單
- 表單欄位採 **form-grid-wide（2欄 grid）** 排列：系統別/子模組、提問人/日期、難度/優先權並排
- **RWD**：< 900px 時 sidebar 收至頂部橫欄

**導覽列**：已整合至 Sidebar，不再使用 Badge 連結

---

## 5. Google Sheets 工作表規格

> **是否啟用欄位**：接受 `是`、`Y`、`y`、`true`、`1`（布林或字串均可）

### 5.1 使用者

| 欄位         | 型態 | 說明                           |
| ------------ | ---- | ------------------------------ |
| id           | 數字 | 自動編號                       |
| 使用者工號   | 文字 | 唯一識別碼                     |
| 使用者姓名   | 文字 | 顯示名稱                       |
| LOGIN ID     | 文字 | 登入帳號                       |
| Password     | 文字 | 密碼（目前僅儲存，無驗證機制） |
| 是否啟用     | 文字 | Y/N，控制是否出現在選單        |
| 是否為管理者 | 文字 | Y/N，Y=可進入管理介面          |

### 5.2 系統別

| 欄位     | 型態 | 說明                   |
| -------- | ---- | ---------------------- |
| id       | 數字 | 自動編號               |
| 系統別   | 文字 | 系統名稱（含「其它」） |
| 是否開啟 | 文字 | 控制是否出現在選單     |
| 排序     | 數字 | 升冪排序               |
| 建立時間 | Date | 新增時 GAS 自動填入    |

### 5.3 子模組

| 欄位     | 型態 | 說明                 |
| -------- | ---- | -------------------- |
| id       | 數字 | 自動編號             |
| 父系統   | 文字 | 對應「系統別」欄位值 |
| 子模組   | 文字 | 子模組名稱           |
| 是否開啟 | 文字 | 控制是否出現         |
| 排序     | 數字 | 升冪排序             |
| 建立時間 | Date | 新增時 GAS 自動填入  |

### 5.4 提問方式

| 欄位     | 型態 | 說明                               |
| -------- | ---- | ---------------------------------- |
| id       | 數字 | 自動編號                           |
| 提問方式 | 文字 | 例：電話、Email、現場、Teams、其它 |
| 是否開啟 | 文字 | 控制是否出現                       |
| 排序     | 數字 | 升冪排序                           |
| 建立時間 | Date | 新增時 GAS 自動填入                |

### 5.5 員工資料

| 欄位       | 型態 | 說明                |
| ---------- | ---- | ------------------- |
| id         | 數字 | 自動編號            |
| 提問人工號 | 文字 | 提問人員工號        |
| 提問人姓名 | 文字 | 提問人顯示名稱      |
| 是否開啟   | 文字 | 控制是否出現在選單  |
| 建立時間   | Date | 新增時 GAS 自動填入 |

### 5.5a 使用者（DataSheet 共通規則）

> 所有 DataSheet（使用者、系統別、子模組、提問方式、員工資料）透過 Admin CRUD 新增資料時，GAS 自動填入 **建立時間**（`new Date()`）。

### 5.6 問題清單記錄

| 欄位         | 型態 | 說明                         |
| ------------ | ---- | ---------------------------- |
| id           | 數字 | 自動遞增                     |
| 系統別       | 文字 |                              |
| 子模組       | 文字 |                              |
| 處理人員姓名 | 文字 | 登入使用者的姓名             |
| 提問人員     | 文字 |                              |
| 難度         | 文字 | 高/中/低                     |
| 優先權       | 文字 | 高/中/低                     |
| 提問日期     | 文字 | ISO 8601 datetime-local 格式 |
| 提問方式     | 文字 |                              |
| 是否完成     | 文字 | 是/否                        |
| 結案日期     | 文字 | ISO 8601 或空字串            |
| 處理分鐘數   | 數字 | 空則留空                     |
| 備註         | 文字 |                              |
| 建立日期時間 | Date | GAS 伺服器寫入時間           |

---

## 6. GAS API 規格

**部署類型**：Web App  
**執行身份**：我的帳戶  
**存取權限**：所有人（含匿名者）

### 6.1 GET 端點

**URL**：`{GAS_URL}?action={action}`

| action           | 回傳             | 說明                                                   |
| ---------------- | ---------------- | ------------------------------------------------------ |
| `getUsers`       | `User[]`         | 回傳啟用中的使用者清單                                 |
| `getFormOptions` | `FormOptions`    | 一次回傳所有下拉選單資料                               |
| `getAdminSheet`  | `AdminSheetData` | 讀取指定 Sheet（`?sheet=users/systems/...`）           |
| `getRecords`     | `AdminRow[]`     | 讀取問題清單記錄（`?handler=姓名&isAdmin=true/false`） |

**`User` 物件**：
```json
{ "id": "1", "empId": "4483", "name": "BRIAN", "loginId": "BRIAN", "isAdmin": true }
```

**`FormOptions` 物件**：
```json
{
  "systems": [{ "id": "1", "name": "ERP", "order": 1 }],
  "subModules": [{ "id": "1", "parentSystem": "ERP", "name": "採購模組", "order": 1 }],
  "questionTypes": [{ "id": "1", "name": "電話", "order": 1 }],
  "employees": [{ "id": "1", "empId": "S001", "name": "陳一心" }]
}
```

**`AdminData` 物件**：
```json
{
  "users": [{ "id": "1", "empId": "4483", "name": "BRIAN", "loginId": "BRIAN", "isAdmin": true, "isEnabled": true }],
  "systems": [{ "id": "1", "name": "ERP", "order": 1, "isEnabled": true }],
  "subModules": [{ "id": "1", "parentSystem": "ERP", "name": "採購模組", "order": 1, "isEnabled": true }],
  "questionTypes": [{ "id": "1", "name": "電話", "order": 1, "isEnabled": true }],
  "employees": [{ "id": "1", "empId": "S001", "name": "陳一心", "isEnabled": true }]
}
```

### 6.2 POST 端點

**URL**：`{GAS_URL}`  
**Content-Type**：`application/json`  
**Mode**：`no-cors`（前端無法讀取回應）

**Request Body**：
```json
{
  "action": "addWorkItem", // 或 "updateUser", "addSystem", "deleteEmployee" 等
  "data": {
    // 依 action 決定資料結構
    "system": "ERP",
    "subModule": "採購模組",
    "handler": "BRIAN",
    "questioner": "陳一心",
    "difficulty": "HIGH",
    "priority": "MID",
    "questionDate": "2026-02-21T10:30",
    "questionType": "電話",
    "isDone": false,
    "closedDate": "",
    "minutes": 30,
    "note": "備註說明"
  }
}
```

**難度/優先權對照**：`HIGH` → 高、`MID` → 中、`LOW` → 低

---

## 7. 前端程式碼結構

```
kpi-tracker/
├── .env                          # 環境變數（不進版控）
├── .env.example                  # 環境變數範本
├── vite.config.ts                # Vite 設定 + gas-proxy middleware
├── gas/
│   └── Code.gs                   # GAS 後端程式碼範本
└── src/
    ├── main.tsx                  # 入口點
    ├── App.tsx                   # Router 設定（BrowserRouter）
    ├── index.css                 # 設計系統（CSS variables + PC layout classes）
    ├── types/
    │   └── index.ts              # TypeScript 介面定義
    ├── services/
    │   └── api.ts                # GAS API 封裝（含 mock 資料）
    ├── hooks/
    │   └── useFormOptions.ts     # 下拉資料 fetching hook
    ├── components/
    │   └── AppLayout.tsx         # 共用 Sidebar + Main layout 元件
    └── pages/
        ├── LoginPage/
        │   └── index.tsx
        ├── WorkItemFormPage/
        │   └── index.tsx
        ├── RecordsPage/
        │   └── index.tsx         # 查詢記錄 + 編輯 Modal
        └── AdminPage/
            └── index.tsx
```

---

## 8. 路由設計

| 路徑         | 頁面             | 說明                   |
| ------------ | ---------------- | ---------------------- |
| `/`          | LoginPage        | 選擇使用者             |
| `/form`      | WorkItemFormPage | 填寫工作記錄           |
| `/records`   | RecordsPage      | 查詢記錄 / 編輯        |
| `/dashboard` | DashboardPage    | KPI 儀表板             |
| `/admin`     | AdminPage        | 管理頁面（需 isAdmin） |
| `*`          | 重導向 `/`       | 404 fallback           |

### DashboardPage 規格

**路由**：`/dashboard`

**功能**：
- 一般使用者：預設檢視個人的工作負載與 KPI 指標
- 管理者：可透過下拉選單檢視「所有人」或指定人員的數據
- 畫面分成兩大區塊：
  1. **KPI 指標卡片**：期間總案件數、完成率、平均處理耗時、待處理與急件積壓
  2. **圖表視覺化**：整合 `recharts` 繪製「每日案件趨勢（折線圖）」、「系統別分佈（圓餅圖）」、「難度與平均耗時（長條圖）」、「提問方式佔比（長條圖）」
- 預設載入當前月份 (`YYYY-MM`) 的資料，提供月份篩選或檢視「全部時間」

### RecordsPage 規格

**路由**：`/records`

**功能**：
- 一般使用者：只看自己的工作記錄
- 管理者：可看所有人的記錄並篩選人員
- 點擊「✏ 編輯」→ 跳出 Modal，含完整表單（提問方式 icon 按鈕組）

**篩選條件**（全部客戶端篩選）：

| 篩選項             | 說明                                                     |
| ------------------ | -------------------------------------------------------- |
| 人員（管理者限定） | 處理人員姓名                                             |
| 系統別             | 精確比對                                                 |
| 子模組             | 模糊包含搜尋                                             |
| 提問人員           | 精確比對                                                 |
| 提問方式           | 精確比對                                                 |
| 難度               | 高/中/低                                                 |
| 優先權             | 高/中/低                                                 |
| 完成狀態           | 已完成/未完成                                            |
| 日期範圍           | react-datepicker 日曆選取；快速預設：今天/本週/本月/全部 |

**排序**：點擊任意欄位標題切換升/降序

**依賴**：
- `react-datepicker` + `date-fns`（日曆選取元件）

---

## 9. 設計系統

**主題**：深色（Dark Mode）

| Token            | 值        | 說明                |
| ---------------- | --------- | ------------------- |
| `--bg`           | `#0d0d1a` | 頁面背景            |
| `--bg-elevated`  | `#13132a` | 卡片背景            |
| `--accent`       | `#7c6ff7` | 主色（紫色）        |
| `--accent-hover` | `#a09aff` | hover 狀態          |
| `--high`         | `#f97066` | 高難度/優先（紅）   |
| `--mid`          | `#f9a825` | 中難度/優先（橘黃） |
| `--low`          | `#4eed9e` | 低難度/優先（綠）   |
| `--radius`       | `12px`    | 標準圓角            |

**字型**：Inter（Google Fonts），fallback system-ui

---

## 10. 已知限制

| 項目           | 說明                                                           |
| -------------- | -------------------------------------------------------------- |
| 無登入驗證     | 使用者僅以下拉選單選取，無密碼驗證機制                         |
| POST 無法確認  | GAS POST 使用 `no-cors`，前端無法讀取回應，一律假設成功        |
| GAS 部署需手動 | GAS 程式碼更新後需手動在 Apps Script 介面新增部署版本          |
| 生產環境 CORS  | 部署至真實 domain 後，GAS GET 請求是否需要額外 CORS 處理待確認 |

---

## 11. 變更記錄

| 日期       | 版本  | 內容                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-21 | 1.0.0 | 初版建立；LoginPage + WorkItemFormPage；GAS 後端；Vite gas-proxy                                                                                                                                                                                                                                                                    |
| 2026-02-21 | 1.0.1 | GAS `isEnabled()` 函式新增支援 `Y`/`y`/`true`/`1` 等多種啟用值                                                                                                                                                                                                                                                                      |
| 2026-02-21 | 1.1.0 | 管理者功能：使用者 Sheet 加 `是否為管理者` 欄；AdminPage CRUD；GAS admin 端點；gas-proxy POST 支援                                                                                                                                                                                                                                  |
| 2026-02-21 | 1.2.0 | DataSheet 加入建立時間欄（GAS 自動填入）；RecordsPage 新增（查詢/篩選/排序/編輯/管理者可查全部）；提問方式改 icon 按鈕組；送出成功改動畫 overlay；日曆元件（react-datepicker 深色主題）；子模組父系統欄改下拉                                                                                                                       |
| 2026-02-21 | 1.3.0 | **PC-first Layout 重構**：建立共用 `AppLayout`（Sidebar 260px + Main）；WorkItemFormPage/RecordsPage/AdminPage 全面改用 AppLayout；表單欄位改 form-grid-wide 2-col；提問方式 icon 各自唯一（Email/Teams/LINE SVG + 其餘 emoji）；子模組篩選改下拉；備註改單行 input；CSS 全域加 color-scheme/touch-action/text-wrap/transition 明細 |
