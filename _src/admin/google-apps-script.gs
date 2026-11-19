/**
 * retreats.ge: form sign-ups -> Google Sheet, plus data for the /admin page.
 *
 * Setup (once):
 * 1. Create a Google Sheet in Anastasia's account, e.g. "retreats.ge sign-ups".
 * 2. Extensions > Apps Script. Delete the sample code and paste this whole file. Save.
 * 3. Project Settings (gear) > Script properties > Add:
 *      ADMIN_KEY   = a password for the admin page (long, private)
 *      NOTIFY_EMAIL = anastasiamzhavia@gmail.com   (gets an email for each sign-up)
 * 4. Deploy > New deployment > type "Web app".
 *      Execute as: Me    Who has access: Anyone
 *    Approve the permissions, then copy the Web app URL and add it to the website.
 */

var SHEET_NAME = 'Sign-ups';
var COLUMNS = ['id', 'date', 'type', 'name', 'email', 'phone', 'preference', 'message', 'page', 'status', 'notes'];
var MAX_LEN = 1000;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }
  return sh;
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
    var sh = sheet_(), data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(body.id)) {
        if (body.status != null) sh.getRange(i + 1, COLUMNS.indexOf('status') + 1).setValue(clean_(body.status));
        if (body.notes != null) sh.getRange(i + 1, COLUMNS.indexOf('notes') + 1).setValue(clean_(body.notes));
        return json_({ ok: true });
      }
    }
    return json_({ ok: false, error: 'not found' });
  }

  // Honeypot: real visitors never fill this hidden field
  if (body.website) return json_({ ok: true });
  if (!body.name || !body.email) return json_({ ok: false, error: 'missing fields' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var id = Utilities.getUuid().slice(0, 8);
    sheet_().appendRow([
      id, new Date(), clean_(body.type || 'waitlist'), clean_(body.name), clean_(body.email),
      clean_(body.phone), clean_(body.preference), clean_(body.message), clean_(body.page), 'New', ''
    ]);
  } finally {
    lock.releaseLock();
  }

  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (to) {
    MailApp.sendEmail({
      to: to,
      subject: 'New ' + (body.type || 'waitlist') + ' sign-up: ' + String(body.name).slice(0, 80),
      body: [
        'Name: ' + body.name, 'Email: ' + body.email, 'Phone: ' + (body.phone || '-'),
        'Preference: ' + (body.preference || '-'), 'Message: ' + (body.message || '-'),
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
  var data = sheet_().getDataRange().getValues();
  var rows = data.slice(1).map(function (r) {
    var o = {};
    COLUMNS.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  }).reverse();
  return json_({ ok: true, rows: rows, sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
}
