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
 * 工作表名稱對應：
 *   使用者、系統別、子模組、提問方式、員工資料、問題清單記錄
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

// 是否啟用判斷：接受 '是'、'Y'、'y'、true、1
function isEnabled(val) {
  if (val === true || val === 1) return true;
  const s = String(val).trim().toLowerCase();
  return s === "是" || s === "y" || s === "yes" || s === "true";
}

// ── GET ──────────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    if (action === "getUsers") {
      result = getUsers();
    } else if (action === "getFormOptions") {
      result = getFormOptions();
    } else {
      result = { error: "unknown action" };
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
  // 欄：ID, 使用者工號, 使用者姓名, LOGIN ID, Password, 是否啟用
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[5]))
    .map((r) => ({
      id: String(r[0]),
      empId: String(r[1]),
      name: String(r[2]),
      loginId: String(r[3]),
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
  // 欄：ID, 系統別, 是否開啟, 排序
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
  // 欄：ID, 父系統, 子模組, 是否開啟, 排序
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
  // 欄：ID, 提問方式, 是否開啟, 排序
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
  // 欄：ID, 提問人工號, 提問人姓名, 是否開啟
  return rows
    .slice(1)
    .filter((r) => isEnabled(r[3]))
    .map((r) => ({
      id: String(r[0]),
      empId: String(r[1]),
      name: String(r[2]),
    }));
}

// ── POST ─────────────────────────────────────────────────────────────────────

function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    appendRecord(data);
    result = { status: "ok" };
  } catch (err) {
    result = { status: "error", message: String(err) };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function appendRecord(data) {
  const sheet = SS.getSheetByName("問題清單記錄");
  const lastRow = sheet.getLastRow();
  // 自動 ID
  const newId =
    lastRow < 1 ? 1 : (Number(sheet.getRange(lastRow, 1).getValue()) || 0) + 1;

  const now = new Date();
  const LEVEL_MAP = { HIGH: "高", MID: "中", LOW: "低" };

  sheet.appendRow([
    newId, // ID
    data.system, // 系統別
    data.subModule, // 子模組
    data.handler, // 處理人員姓名
    data.questioner, // 提問人員
    LEVEL_MAP[data.difficulty] || "", // 難度
    LEVEL_MAP[data.priority] || "", // 優先權
    data.questionDate, // 提問日期
    data.questionType, // 提問方式
    data.isDone ? "是" : "否", // 是否完成
    data.closedDate || "", // 結案日期
    data.minutes || "", // 處理分鐘數
    data.note || "", // 備註
    now, // 建立日期時間
  ]);
}
