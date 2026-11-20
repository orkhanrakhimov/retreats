/**
 * retreats.ge backend: form sign-ups, retreats and visitor statistics, stored in this Google Sheet.
 *
 * Setup (once):
 * 1. Extensions > Apps Script in the sign-ups Google Sheet. Paste this whole file. Save.
 * 2. Project Settings (gear) > Script properties:
 *      ADMIN_KEY    = the password for the admin page
 *      NOTIFY_EMAIL = anastasiamzhavia@gmail.com   (gets an email for each sign-up)
 * 3. Choose "setup" in the function menu at the top and press Run. Approve the permissions.
 * 4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *    (After changing this code later: Deploy > Manage deployments > Edit > Version: New version > Deploy.)
 */

var SIGNUP_SHEET = 'Sign-ups';
var SIGNUP_COLUMNS = ['id', 'date', 'type', 'name', 'email', 'phone', 'retreat', 'level', 'motivation', 'health',
  'company', 'team_size', 'interest', 'message', 'page', 'status', 'notes'];

var RETREAT_SHEET = 'Retreats';
var RETREAT_COLUMNS = ['id', 'slug', 'status', 'name', 'location', 'dates', 'start_date', 'price', 'summary',
  'description', 'programme', 'included', 'not_included', 'cover', 'gallery', 'updated'];

var VISIT_SHEET = 'Visits';
var VISIT_COLUMNS = ['date', 'path', 'source', 'device', 'zone', 'lang'];

var PHOTO_FOLDER = 'retreats.ge photos';
var MAX_LEN = 5000;

// ---------- helpers ----------

function sheet_(name, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    var first = ss.getSheets()[0];
    if (name === SIGNUP_SHEET && first && first.getLastRow() === 0) { sh = first; sh.setName(name); }
    else sh = ss.insertSheet(name);
    sh.appendRow(columns);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, columns.length).setFontWeight('bold');
  }
  var header = headers_(sh);
  columns.forEach(function (c) {
    if (header.indexOf(c) === -1) {
      sh.getRange(1, header.length + 1).setValue(c).setFontWeight('bold');
      header.push(c);
    }
  });
  return sh;
}

function headers_(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, last).getValues()[0].map(String).filter(function (h) { return h; });
}

function rows_(sh) {
  var header = headers_(sh), data = sh.getDataRange().getValues();
  return data.slice(1).map(function (r) {
    var o = {};
    header.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  });
}

function append_(sh, record) {
  var header = headers_(sh);
  sh.appendRow(header.map(function (h) { return record[h] != null ? record[h] : ''; }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  v = String(v == null ? '' : v).slice(0, max || MAX_LEN);
  return /^[=+\-@]/.test(v) ? "'" + v : v;  // no formulas injected through forms
}

function isAdmin_(key) {
  var k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return k && key && key === k;
}

function slugify_(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'retreat';
}

/** Run once from the editor: creates the tabs and asks for permissions. */
function setup() {
  sheet_(SIGNUP_SHEET, SIGNUP_COLUMNS);
  sheet_(RETREAT_SHEET, RETREAT_COLUMNS);
  sheet_(VISIT_SHEET, VISIT_COLUMNS);
  photoFolder_();
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ADMIN_KEY')) throw new Error('Add ADMIN_KEY in Project Settings > Script properties first.');
  Logger.log('All set. Now Deploy > New deployment > Web app (or Manage deployments > New version).');
}

function photoFolder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

// ---------- public + admin entry points ----------

function doGet(e) {
  var p = e.parameter || {};
  // Public: published retreats, used to build the website
  if (p.action === 'retreats') {
    var list = rows_(sheet_(RETREAT_SHEET, RETREAT_COLUMNS)).filter(function (r) {
      return r.status === 'open' || r.status === 'soon';
    });
    return json_({ ok: true, retreats: list });
  }
  if (!isAdmin_(p.key)) return json_({ ok: false, error: 'unauthorised' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return json_({
    ok: true,
    rows: rows_(sheet_(SIGNUP_SHEET, SIGNUP_COLUMNS)).reverse(),
    retreats: rows_(sheet_(RETREAT_SHEET, RETREAT_COLUMNS)),
    stats: stats_(Number(p.days) || 30),
    sheet: ss.getUrl()
  });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad request' }); }

  switch (body.action) {
    case 'visit': return visit_(body);
    case 'update': return admin_(body, updateSignup_);
    case 'saveRetreat': return admin_(body, saveRetreat_);
    case 'deleteRetreat': return admin_(body, deleteRetreat_);
    case 'uploadPhoto': return admin_(body, uploadPhoto_);
    default: return signup_(body);
  }
}

function admin_(body, fn) {
  if (!isAdmin_(body.key)) return json_({ ok: false, error: 'unauthorised' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return json_(fn(body)); } finally { lock.releaseLock(); }
}

// ---------- sign-ups ----------

function signup_(body) {
  if (body.website) return json_({ ok: true });  // honeypot: bots fill the hidden field
  if (!body.name || !body.email) return json_({ ok: false, error: 'missing fields' });
  var types = { 'retreat interest': 1, 'online session': 1, 'corporate': 1 };
  var type = types[body.type] ? body.type : 'retreat interest';

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    append_(sheet_(SIGNUP_SHEET, SIGNUP_COLUMNS), {
      id: Utilities.getUuid().slice(0, 8), date: new Date(), type: type,
      name: clean_(body.name, 200), email: clean_(body.email, 200), phone: clean_(body.phone, 60),
      retreat: clean_(body.retreat, 300), level: clean_(body.level, 60), motivation: clean_(body.motivation),
      health: clean_(body.health), company: clean_(body.company, 200), team_size: clean_(body.team_size, 60),
      interest: clean_(body.interest, 200), message: clean_(body.message), page: clean_(body.page, 200),
      status: 'New', notes: ''
    });
  } finally {
    lock.releaseLock();
  }

  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (to) {
    var labels = { 'retreat interest': 'retreat sign-up', 'online session': 'online session request', 'corporate': 'corporate enquiry' };
    var lines = [
      ['Name', body.name], ['Email', body.email], ['Phone', body.phone], ['Company', body.company],
      ['Team size', body.team_size], ['Interested in', body.interest], ['Retreat', body.retreat],
      ['Level', body.level], ['Wants', body.motivation], ['Health', body.health], ['Message', body.message]
    ].filter(function (l) { return l[1]; }).map(function (l) { return l[0] + ': ' + l[1]; });
    MailApp.sendEmail({
      to: to,
      subject: 'New ' + labels[type] + ': ' + String(body.name).slice(0, 80),
      body: lines.join('\n') + '\n\nSee everyone at https://retreats.ge/admin/',
      replyTo: String(body.email)
    });
  }
  return json_({ ok: true });
}

function updateSignup_(body) {
  var sh = sheet_(SIGNUP_SHEET, SIGNUP_COLUMNS), header = headers_(sh), data = sh.getDataRange().getValues();
  var idCol = header.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(body.id)) {
      if (body.status != null) sh.getRange(i + 1, header.indexOf('status') + 1).setValue(clean_(body.status, 60));
      if (body.notes != null) sh.getRange(i + 1, header.indexOf('notes') + 1).setValue(clean_(body.notes));
      return { ok: true };
    }
  }
  return { ok: false, error: 'not found' };
}

// ---------- retreats ----------

function saveRetreat_(body) {
  var r = body.retreat || {};
  if (!r.name) return { ok: false, error: 'A retreat needs a name' };
  var sh = sheet_(RETREAT_SHEET, RETREAT_COLUMNS), header = headers_(sh), data = sh.getDataRange().getValues();
  var all = rows_(sh);
  var id = r.id || Utilities.getUuid().slice(0, 8);
  var slug = slugify_(r.slug || r.name);
  var taken = all.filter(function (x) { return String(x.id) !== String(id); }).map(function (x) { return x.slug; });
  var base = slug, n = 2;
  while (taken.indexOf(slug) > -1) slug = base + '-' + n++;
  var status = { draft: 1, soon: 1, open: 1, closed: 1 }[r.status] ? r.status : 'draft';
  var record = {
    id: id, slug: slug, status: status, name: clean_(r.name, 200), location: clean_(r.location, 200),
    dates: clean_(r.dates, 200), start_date: clean_(r.start_date, 20), price: clean_(r.price, 200),
    summary: clean_(r.summary, 600), description: clean_(r.description), programme: clean_(r.programme),
    included: clean_(r.included), not_included: clean_(r.not_included), cover: clean_(r.cover, 500),
    gallery: clean_(r.gallery, 3000), updated: new Date()
  };
  var idCol = header.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sh.getRange(i + 1, 1, 1, header.length).setValues([header.map(function (h) { return record[h] != null ? record[h] : ''; })]);
      return { ok: true, retreat: record };
    }
  }
  append_(sh, record);
  return { ok: true, retreat: record };
}

function deleteRetreat_(body) {
  var sh = sheet_(RETREAT_SHEET, RETREAT_COLUMNS), header = headers_(sh), data = sh.getDataRange().getValues();
  var idCol = header.indexOf('id');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(body.id)) { sh.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: false, error: 'not found' };
}

function uploadPhoto_(body) {
  var mime = String(body.mime || '');
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, error: 'Please upload a JPG, PNG or WebP photo' };
  var bytes = Utilities.base64Decode(String(body.data || ''));
  if (bytes.length > 8 * 1024 * 1024) return { ok: false, error: 'Photo is too large (max 8 MB)' };
  var file = photoFolder_().createFile(Utilities.newBlob(bytes, mime, clean_(body.name || 'photo', 120)));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w2000', id: file.getId() };
}

// ---------- visitor statistics (no cookies, no personal data) ----------

function visit_(body) {
  var path = String(body.path || '/');
  if (path.indexOf('/admin') === 0) return json_({ ok: true });
  append_(sheet_(VISIT_SHEET, VISIT_COLUMNS), {
    date: new Date(), path: clean_(path, 200), source: clean_(body.source, 60),
    device: clean_(body.device, 20), zone: clean_(body.zone, 60), lang: clean_(body.lang, 20)
  });
  return json_({ ok: true });
}

function stats_(days) {
  var since = Date.now() - days * 864e5;
  var visits = rows_(sheet_(VISIT_SHEET, VISIT_COLUMNS)).filter(function (v) { return new Date(v.date).getTime() >= since; });
  var count = function (key) {
    var m = {};
    visits.forEach(function (v) { var k = v[key] || 'Unknown'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  };
  var byDay = {};
  visits.forEach(function (v) { var d = String(v.date).slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
  return { days: days, total: visits.length, byDay: byDay, pages: count('path'), sources: count('source'),
           devices: count('device'), zones: count('zone') };
}
