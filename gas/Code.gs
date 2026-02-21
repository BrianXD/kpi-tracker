/**
 * KPI Tracker - Google Apps Script
 *
 * 部署步驟：
 * 1. 在 Google Sheets 中選「擴充功能 > Apps Script」
 * 2. 貼上此程式碼
 * 3. 點選「部署 > 新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身份：我的帳戶
 *    - 誰可以存取：所有人（含匿名者）
 * 4. 複製部署 URL 貼到前端的 VITE_GAS_URL
 *
 * 工作表名稱：使用者、系統別、子模組、提問方式、員工資料、問題清單記錄
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// 是否啟用判斷：接受 '是'、'Y'、'y'、true、1
function isEnabled(val) {
  if (val === true || val === 1) return true;
  const s = String(val).trim().toLowerCase();
  return s === "是" || s === "y" || s === "yes" || s === "true";
}

// Sheet 名稱對應
const SHEET_MAP = {
  users: "使用者",
  systems: "系統別",
  subModules: "子模組",
  questionTypes: "提問方式",
  employees: "員工資料",
};

// ── GET ───────────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    if (action === "getUsers") {
      result = getUsers();
    } else if (action === "getFormOptions") {
      result = getFormOptions();
    } else if (action === "getAdminSheet") {
      result = getAdminSheet(e.parameter.sheet);
    } else if (action === "getRecords") {
      result = getRecords(e.parameter.handler, e.parameter.isAdmin);
    } else {
      result = { error: "unknown action: " + action };
    }
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getUsers() {
  const sheet = SS.getSheetByName("使用者");
  const rows = sheet.getDataRange().getValues();
  // 欄：id, 使用者工號, 使用者姓名, LOGIN ID, Password, 是否啟用, 是否為管理者
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[5]))
    .map((r) => ({
      id: String(r[0]),
      empId: String(r[1]),
      name: String(r[2]),
      loginId: String(r[3]),
      isAdmin: isEnabled(r[6]),
    }));
}

function getFormOptions() {
  return {
    systems: getSystems(),
    subModules: getSubModules(),
    questionTypes: getQuestionTypes(),
    employees: getEmployees(),
  };
}

function getSystems() {
  const sheet = SS.getSheetByName("系統別");
  const rows = sheet.getDataRange().getValues();
  // id, 系統別, 是否開啟, 排序
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[2]))
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .map((r) => ({
      id: String(r[0]),
      name: String(r[1]),
      order: Number(r[3]),
    }));
}

function getSubModules() {
  const sheet = SS.getSheetByName("子模組");
  const rows = sheet.getDataRange().getValues();
  // id, 父系統, 子模組, 是否開啟, 排序
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[3]))
    .sort((a, b) => Number(a[4]) - Number(b[4]))
    .map((r) => ({
      id: String(r[0]),
      parentSystem: String(r[1]),
      name: String(r[2]),
      order: Number(r[4]),
    }));
}

function getQuestionTypes() {
  const sheet = SS.getSheetByName("提問方式");
  const rows = sheet.getDataRange().getValues();
  // id, 提問方式, 是否開啟, 排序
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[2]))
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .map((r) => ({
      id: String(r[0]),
      name: String(r[1]),
      order: Number(r[3]),
    }));
}

function getEmployees() {
  const sheet = SS.getSheetByName("員工資料");
  const rows = sheet.getDataRange().getValues();
  // id, 提問人工號, 提問人姓名, 是否開啟
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[3]))
    .map((r) => ({
      id: String(r[0]),
      empId: String(r[1]),
      name: String(r[2]),
    }));
}

// ── Admin: getAdminSheet (回傳完整原始資料，不過濾) ───────────────────────────

function getAdminSheet(sheetKey) {
  const sheetName = SHEET_MAP[sheetKey];
  if (!sheetName) return { error: "unknown sheet: " + sheetKey };
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return { error: "sheet not found: " + sheetName };
  const all = sheet.getDataRange().getValues();
  if (all.length === 0) return { headers: [], data: [] };
  const headers = all[0].map(String);
  const data = all.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 }; // 1-indexed, row 1 = header
    headers.forEach((h, j) => {
      obj[h] = row[j];
    });
    return obj;
  });
  return { headers, data };
}

// ── POST ──────────────────────────────────────────────────────────────────────

function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "appendRecord" || !action) {
      // 原有的工作記錄送出
      appendRecord(data);
      result = { status: "ok" };
    } else if (action === "addAdminRow") {
      addAdminRow(data.sheet, data.rowData, data.headers);
      result = { status: "ok" };
    } else if (action === "saveAdminRow") {
      saveAdminRow(data.sheet, data.rowIndex, data.rowData, data.headers);
      result = { status: "ok" };
    } else if (action === "deleteAdminRow") {
      deleteAdminRow(data.sheet, data.rowIndex);
      result = { status: "ok" };
    } else if (action === "updateRecord") {
      updateRecord(data.rowIndex, data.rowData);
      result = { status: "ok" };
    } else {
      result = { status: "error", message: "unknown action: " + action };
    }
  } catch (err) {
    result = { status: "error", message: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// ── Admin CRUD ─────────────────────────────────────────────────────────────────

function addAdminRow(sheetKey, rowData, headers) {
  const sheet = SS.getSheetByName(SHEET_MAP[sheetKey]);
  // 自動 ID
  const lastRow = sheet.getLastRow();
  const newId =
    lastRow < 1 ? 1 : (Number(sheet.getRange(lastRow, 1).getValue()) || 0) + 1;

  // 取得完整 headers（含 id）
  const fullHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);
  const now = new Date();
  const values = fullHeaders.map((h) => {
    if (h === "id") return newId;
    if (h === "建立時間") return now; // 自動填入建立時間
    return rowData[h] !== undefined ? rowData[h] : "";
  });
  sheet.appendRow(values);
}

function saveAdminRow(sheetKey, rowIndex, rowData, headers) {
  const sheet = SS.getSheetByName(SHEET_MAP[sheetKey]);
  const fullHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);
  const values = fullHeaders.map((h) => {
    return rowData[h] !== undefined
      ? rowData[h]
      : sheet.getRange(rowIndex, fullHeaders.indexOf(h) + 1).getValue();
  });
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

function deleteAdminRow(sheetKey, rowIndex) {
  const sheet = SS.getSheetByName(SHEET_MAP[sheetKey]);
  sheet.deleteRow(rowIndex);
}

// ──// 工作記錄寫入 ───────────────────────────────────────────────────

function getRecords(handlerName, isAdmin) {
  const sheet = SS.getSheetByName("問題清單記錄");
  const all = sheet.getDataRange().getValues();
  if (all.length < 2) return [];
  const headers = all[0].map(String);
  return (
    all
      .slice(1)
      .map((row, i) => {
        const obj = { _rowIndex: i + 2 };
        headers.forEach((h, j) => {
          obj[h] = row[j];
        });
        return obj;
      })
      // isAdmin=true 則回傳全部，否則僅回傳該使用者記錄
      .filter(
        (obj) =>
          isAdmin === "true" || String(obj["處理人員姓名"]) === handlerName,
      )
  );
}

function updateRecord(rowIndex, data) {
  const sheet = SS.getSheetByName("問題清單記錄");
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);
  const LEVEL_MAP = { HIGH: "高", MID: "中", LOW: "低" };
  const currentRow = sheet
    .getRange(rowIndex, 1, 1, headers.length)
    .getValues()[0];

  const MAP = {
    系統別: data.system,
    子模組: data.subModule,
    處理人員姓名: data.handler,
    提問人員: data.questioner,
    難度: LEVEL_MAP[data.difficulty] || data.difficulty,
    優先權: LEVEL_MAP[data.priority] || data.priority,
    提問日期: data.questionDate,
    提問方式: data.questionType,
    是否完成: data.isDone ? "是" : "否",
    結案日期: data.closedDate || "",
    處理分鐘數: data.minutes || "",
    備註: data.note || "",
  };

  const values = headers.map((h, i) => {
    return MAP[h] !== undefined ? MAP[h] : currentRow[i];
  });
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

// ── 工作記錄寫入 ───────────────────────────────────────────────────────────────

function appendRecord(data) {
  const sheet = SS.getSheetByName("問題清單記錄");
  const lastRow = sheet.getLastRow();
  const newId =
    lastRow < 1 ? 1 : (Number(sheet.getRange(lastRow, 1).getValue()) || 0) + 1;
  const now = new Date();
  const LEVEL_MAP = { HIGH: "高", MID: "中", LOW: "低" };
  sheet.appendRow([
    newId,
    data.system,
    data.subModule,
    data.handler,
    data.questioner,
    LEVEL_MAP[data.difficulty] || "",
    LEVEL_MAP[data.priority] || "",
    data.questionDate,
    data.questionType,
    data.isDone ? "是" : "否",
    data.closedDate || "",
    data.minutes || "",
    data.note || "",
    now,
  ]);
}
