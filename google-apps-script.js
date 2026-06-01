const SHEET_NAME = "Luke Johnson Website Contacts";
const COLUMNS = [
  "Timestamp",
  "Name",
  "Email",
  "Subject",
  "Message",
  "Source Page",
  "Inquiry Type"
];

function doPost(event) {
  const sheet = getOrCreateContactSheet_();
  const data = event.parameter || {};

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.name || "",
    data.email || "",
    data.subject || "",
    data.message || "",
    data.sourcePage || "",
    data.inquiryType || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateContactSheet_() {
  const files = DriveApp.getFilesByName(SHEET_NAME);
  const spreadsheet = files.hasNext()
    ? SpreadsheetApp.open(files.next())
    : SpreadsheetApp.create(SHEET_NAME);

  const sheet = spreadsheet.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
  } else {
    const headers = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
    const needsHeaders = COLUMNS.some((column, index) => headers[index] !== column);
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    }
  }

  return sheet;
}
