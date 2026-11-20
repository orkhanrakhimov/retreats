/* retreats.ge admin: lists sign-ups from the Google Sheet and updates status and notes. */
(function () {
  "use strict";
  var root = document.querySelector("[data-admin]");
  if (!root) return;
  var endpoint = root.getAttribute("data-endpoint");
  var demo = /[?&]demo\b/.test(location.search);
  var $ = function (s) { return root.querySelector(s); };
  var STATUSES = ["New", "Contacted", "Booked", "Not interested"];
  var KEY_STORE = "retreats-admin-key";
  var key = null, rows = [];

  var store = {
    get: function () { try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE); } catch (e) { return null; } },
    set: function (k, remember) { try { (remember ? localStorage : sessionStorage).setItem(KEY_STORE, k); } catch (e) {} },
    clear: function () { try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (e) {} }
  };

  var esc = function (s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  var fmtDate = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  var waLink = function (phone) {
    var n = String(phone || "").replace(/\D/g, "");
    return n.length >= 8 ? "https://wa.me/" + n : null;
  };

  var sample = function () {
    var now = Date.now(), day = 864e5;
    return [
      { id: "a1", date: new Date(now - 0.2 * day).toISOString(), name: "Nino Beridze", email: "nino@example.com", phone: "+995 555 12 34 56", level: "New to it", motivation: "Switch off from work and finally start moving again.", health: "Lower back pain after long days at the desk.", retreat: "Any upcoming retreat", status: "New", notes: "" },
      { id: "a2", date: new Date(now - 1.5 * day).toISOString(), name: "Mariam K.", email: "mariam@example.com", phone: "+995 599 22 33 44", level: "Practise regularly", motivation: "Deepen my practice and get stronger.", health: "None", retreat: "Any upcoming retreat", status: "Contacted", notes: "Wants to come with her sister" },
      { id: "a3", date: new Date(now - 4 * day).toISOString(), name: "Sophie Laurent", email: "sophie@example.com", phone: "+33 6 12 34 56 78", level: "Some experience", motivation: "Rest, sea air and time for myself.", health: "Pregnant, 14 weeks.", retreat: "Any upcoming retreat", status: "Booked", notes: "Prenatal modifications" },
      { id: "a4", date: new Date(now - 9 * day).toISOString(), name: "Ana Gelashvili", email: "ana@example.com", phone: "+995 599 00 11 22", level: "Advanced", motivation: "Learn from a doctor how to avoid injuries.", health: "Old knee injury (left).", retreat: "Any upcoming retreat", status: "New", notes: "" }
    ];
  };

  var api = {
    list: function () {
      if (demo) return Promise.resolve({ ok: true, rows: sample() });
      return fetch(endpoint + "?key=" + encodeURIComponent(key)).then(function (r) { return r.json(); });
    },
    update: function (id, field, value) {
      if (demo) return Promise.resolve({ ok: true });
      var body = { action: "update", key: key, id: id }; body[field] = value;
      return fetch(endpoint, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
    }
  };

  // ---------- Rendering ----------
  var renderStats = function () {
    var weekAgo = Date.now() - 7 * 864e5;
    var count = function (fn) { return rows.filter(fn).length; };
    var hasHealth = function (r) { return r.health && !/^\s*(none|no|nothing|-|нет|არა)\.?\s*$/i.test(r.health); };
    var cards = [
      ["Registered", rows.length],
      ["New this week", count(function (r) { return new Date(r.date) > weekAgo; })],
      ["Not contacted yet", count(function (r) { return (r.status || "New") === "New"; })],
      ["Booked", count(function (r) { return r.status === "Booked"; })],
      ["Beginners", count(function (r) { return r.level === "New to it"; })],
      ["With health notes", count(hasHealth)]
    ];
    $("[data-stats]").innerHTML = cards.map(function (c) {
      return '<div class="stat"><span class="stat-num">' + c[1] + '</span><span class="stat-label">' + c[0] + "</span></div>";
    }).join("");
  };

  var renderRows = function () {
    var q = $("[data-search]").value.trim().toLowerCase();
    var st = $("[data-filter-status]").value, lv = $("[data-filter-level]").value;
    var list = rows.filter(function (r) {
      if (st && (r.status || "New") !== st) return false;
      if (lv && r.level !== lv) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone, r.motivation, r.health, r.retreat].join(" ").toLowerCase().indexOf(q) > -1;
    });
    $("[data-empty]").hidden = list.length > 0;
    $("[data-rows]").innerHTML = list.map(function (r) {
      var wa = waLink(r.phone), status = r.status || "New";
      var health = r.health && !/^\s*(none|no|nothing|-)\.?\s*$/i.test(r.health);
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td class="nowrap" data-label="Date">' + esc(fmtDate(r.date)) + "</td>" +
        '<td data-label="Person"><strong>' + esc(r.name) + "</strong><br>" +
          '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a>" +
          (r.phone ? '<br><a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + '">' + esc(r.phone) + "</a>" + (wa ? ' · <a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : "") : "") + "</td>" +
        '<td data-label="Level">' + esc(r.level || "–") + "</td>" +
        '<td data-label="About them" class="about-cell">' +
          (r.motivation ? '<p><span class="cell-label">Wants</span>' + esc(r.motivation) + "</p>" : "") +
          '<p class="' + (health ? "health-flag" : "") + '"><span class="cell-label">Health</span>' + esc(r.health || "–") + "</p>" +
          (r.retreat ? '<p><span class="cell-label">Retreat</span>' + esc(r.retreat) + "</p>" : "") + "</td>" +
        '<td data-label="Status"><select class="status status-' + esc(status.toLowerCase().replace(/\s+/g, "-")) + '" data-field="status" aria-label="Status for ' + esc(r.name) + '">' +
          STATUSES.map(function (s) { return "<option" + (s === status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></td>" +
        '<td data-label="Notes"><textarea rows="2" data-field="notes" placeholder="Add a note" aria-label="Notes for ' + esc(r.name) + '">' + esc(r.notes) + "</textarea></td>" +
        "</tr>";
    }).join("");
  };

  var render = function () { renderStats(); renderRows(); };

  var load = function () {
    $("[data-updated]").textContent = "Loading…";
    return api.list().then(function (res) {
      if (!res.ok) throw new Error(res.error || "error");
      rows = res.rows || [];
      if (res.sheet) { var a = $("[data-sheet-link]"); a.href = res.sheet; a.hidden = false; }
      $("[data-updated]").textContent = (demo ? "Sample data · " : "") + "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      render();
      return true;
    });
  };

  var showApp = function () { $("[data-login]").hidden = true; $("[data-app]").hidden = false; };
  var showLogin = function (msg) {
    $("[data-app]").hidden = true; $("[data-login]").hidden = false;
    var err = $("[data-login-error]"); err.textContent = msg || ""; err.hidden = !msg;
  };

  // ---------- Events ----------
  $("[data-login-form]").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!endpoint && !demo) { showLogin("The sign-up sheet isn't connected yet."); return; }
    key = $("#a-key").value;
    var btn = e.target.querySelector("button"); btn.disabled = true;
    load().then(function () {
      store.set(key, $("[data-remember]").checked); showApp();
    }).catch(function () {
      showLogin("That password didn't work, or the sheet couldn't be reached.");
    }).then(function () { btn.disabled = false; });
  });

  $("[data-logout]").addEventListener("click", function () { store.clear(); key = null; rows = []; $("#a-key").value = ""; showLogin(); });
  $("[data-refresh]").addEventListener("click", function () { load().catch(function () { showLogin("Please log in again."); }); });
  $("[data-search]").addEventListener("input", renderRows);
  $("[data-filter-status]").addEventListener("change", renderRows);
  $("[data-filter-level]").addEventListener("change", renderRows);

  $("[data-rows]").addEventListener("change", function (e) {
    var el = e.target, field = el.getAttribute("data-field");
    if (!field) return;
    var id = el.closest("tr").getAttribute("data-id");
    var row = rows.filter(function (r) { return String(r.id) === id; })[0];
    if (!row) return;
    row[field] = el.value;
    el.classList.add("saving");
    api.update(id, field, el.value).then(function (res) {
      if (!res.ok) throw new Error();
      el.classList.remove("saving"); el.classList.add("saved");
      setTimeout(function () { el.classList.remove("saved"); }, 1200);
      if (field === "status") { el.className = "status status-" + el.value.toLowerCase().replace(/\s+/g, "-"); renderStats(); }
    }).catch(function () { el.classList.remove("saving"); alert("Couldn't save. Please try again."); });
  });

  $("[data-export]").addEventListener("click", function () {
    var cols = ["date", "retreat", "name", "email", "phone", "level", "motivation", "health", "status", "notes"];
    var csv = [cols.join(",")].concat(rows.map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c] == null ? "" : r[c]).replace(/"/g, '""') + '"'; }).join(",");
    })).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "retreats-signups-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  });

  // ---------- Start ----------
  if (demo) { key = "demo"; load().then(showApp); return; }
  if (!endpoint) { $("[data-not-connected]").hidden = false; return; }
  key = store.get();
  if (key) load().then(showApp).catch(function () { store.clear(); showLogin(); });
})();
