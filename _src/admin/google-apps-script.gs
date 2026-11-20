/**
 * retreats.ge: form sign-ups -> Google Sheet, plus data for the /admin page.
 *
 * Setup (once):
 * 1. Create a Google Sheet in Anastasia's account, e.g. "retreats.ge sign-ups".
 * 2. Extensions > Apps Script. Delete the sample code and paste this whole file. Save.
 * 3. Project Settings (gear) > Script properties > Add:
 *      ADMIN_KEY   = a password for the admin page (long, private)
 *      NOTIFY_EMAIL = anastasiamzhavia@gmail.com   (gets an email for each sign-up)
 * 4. Choose "setup" in the function menu at the top and press Run. Approve the permissions.
 * 5. Deploy > New deployment > type "Web app".
 *      Execute as: Me    Who has access: Anyone
 *    Approve the permissions, then copy the Web app URL and add it to the website.
 */

var SHEET_NAME = 'Sign-ups';
var COLUMNS = ['id', 'date', 'type', 'name', 'email', 'phone', 'retreat', 'level', 'motivation', 'health', 'page', 'status', 'notes'];
var MAX_LEN = 1000;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    var first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0) { sh = first; sh.setName(SHEET_NAME); }
    else sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }
  // Add any columns that are missing (keeps older sheets working)
  var header = headers_(sh);
  COLUMNS.forEach(function (c) {
    if (header.indexOf(c) === -1) {
      sh.getRange(1, header.length + 1).setValue(c).setFontWeight('bold');
      header.push(c);
    }
  });
  return sh;
}

/** Run this once from the editor (select "setup", press Run) to create the columns and approve permissions. */
function setup() {
  sheet_();
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ADMIN_KEY')) throw new Error('Add ADMIN_KEY in Project Settings > Script properties first.');
  var to = p.getProperty('NOTIFY_EMAIL');
  if (to) MailApp.sendEmail(to, 'retreats.ge sign-ups are connected', 'New sign-ups from retreats.ge will be emailed here.');
  Logger.log('All set. Now Deploy > New deployment > Web app.');
}

function headers_(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, last).getValues()[0].map(String).filter(function (h) { return h; });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v) {
  v = String(v == null ? '' : v).slice(0, MAX_LEN);
  // Stop spreadsheet formulas being injected through the form
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function isAdmin_(key) {
  var k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return k && key && key === k;
}

/** Public: the website's forms send sign-ups here. Admin: status/notes updates. */
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad request' }); }

  if (body.action === 'update') {
    if (!isAdmin_(body.key)) return json_({ ok: false, error: 'unauthorised' });
    var sh = sheet_(), header = headers_(sh), data = sh.getDataRange().getValues();
    var idCol = header.indexOf('id');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(body.id)) {
        if (body.status != null) sh.getRange(i + 1, header.indexOf('status') + 1).setValue(clean_(body.status));
        if (body.notes != null) sh.getRange(i + 1, header.indexOf('notes') + 1).setValue(clean_(body.notes));
        return json_({ ok: true });
      }
    }
    return json_({ ok: false, error: 'not found' });
  }

  // Honeypot: real visitors never fill this hidden field
  if (body.website) return json_({ ok: true });
  if (!body.name || !body.email || !body.phone) return json_({ ok: false, error: 'missing fields' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var id = Utilities.getUuid().slice(0, 8);
    var sh = sheet_(), header = headers_(sh);
    var record = {
      id: id, date: new Date(), type: clean_(body.type || 'retreat interest'), name: clean_(body.name),
      email: clean_(body.email), phone: clean_(body.phone), level: clean_(body.level),
      motivation: clean_(body.motivation), health: clean_(body.health), retreat: clean_(body.retreat || 'Any upcoming retreat'),
      page: clean_(body.page), status: 'New', notes: ''
    };
    sh.appendRow(header.map(function (h) { return record[h] != null ? record[h] : ''; }));
  } finally {
    lock.releaseLock();
  }

  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (to) {
    MailApp.sendEmail({
      to: to,
      subject: 'New retreat sign-up: ' + String(body.name).slice(0, 80),
      body: [
        'Name: ' + body.name, 'Email: ' + body.email, 'Phone: ' + (body.phone || '-'),
        'Level: ' + (body.level || '-'), 'Wants from a retreat: ' + (body.motivation || '-'),
        'Health: ' + (body.health || '-'), 'Retreat: ' + (body.retreat || 'Any upcoming retreat'),
        '', 'See everyone at https://retreats.ge/admin/'
      ].join('\n'),
      replyTo: String(body.email)
    });
  }
  return json_({ ok: true });
}

/** Admin only: list all sign-ups for the /admin page. */
function doGet(e) {
  if (!isAdmin_(e.parameter.key)) return json_({ ok: false, error: 'unauthorised' });
  var sh = sheet_(), header = headers_(sh), data = sh.getDataRange().getValues();
  var rows = data.slice(1).map(function (r) {
    var o = {};
    header.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  }).reverse();
  return json_({ ok: true, rows: rows, sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
}
