/* retreats.ge admin: sign-ups, retreats and visitor statistics, stored in the Google Sheet. */
(function () {
  "use strict";
  var root = document.querySelector("[data-admin]");
  if (!root) return;
  var endpoint = root.getAttribute("data-endpoint");
  var siteUrl = root.getAttribute("data-site");
  var demo = /[?&]demo\b/.test(location.search);
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var STATUSES = ["New", "Contacted", "Booked", "Not interested"];
  var TYPE_LABEL = { "retreat interest": "Retreat", "online session": "Online", "corporate": "Corporate" };
  var R_STATUS = { draft: "Draft", soon: "Coming soon", open: "Registration open", closed: "Closed" };
  var KEY_STORE = "retreats-admin-key";
  var key = null, rows = [], retreats = [], stats = null, days = 30;

  var store = {
    get: function () { try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE); } catch (e) { return null; } },
    set: function (k, remember) { try { (remember ? localStorage : sessionStorage).setItem(KEY_STORE, k); } catch (e) {} },
    clear: function () { try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (e) {} }
  };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };
  var fmtDate = function (iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  var waLink = function (phone) { var n = String(phone || "").replace(/\D/g, ""); return n.length >= 8 ? "https://wa.me/" + n : null; };
  var isNone = function (v) { return !v || /^\s*(none|no|nothing|-|нет|არა)\.?\s*$/i.test(v); };

  // ---------- sample data for ?demo ----------
  var sample = function () {
    var now = Date.now(), day = 864e5, byDay = {}, i;
    for (i = 0; i < 30; i++) byDay[new Date(now - i * day).toISOString().slice(0, 10)] = Math.round(8 + 14 * Math.random() + (i < 5 ? 20 : 0));
    var total = Object.keys(byDay).reduce(function (a, k) { return a + byDay[k]; }, 0);
    return {
      rows: [
        { id: "a1", date: new Date(now - 0.2 * day).toISOString(), type: "retreat interest", name: "Nino Beridze", email: "nino@example.com", phone: "+995 555 12 34 56", retreat: "Spring retreat in Kakheti (10–13 May 2027)", level: "New to it", motivation: "Switch off from work and start moving again.", health: "Lower back pain after long days at the desk.", status: "New", notes: "" },
        { id: "a2", date: new Date(now - 1.5 * day).toISOString(), type: "online session", name: "Mariam K.", email: "mariam@example.com", phone: "+995 599 22 33 44", level: "Practise regularly", motivation: "Pilates for posture, twice a week.", health: "None", status: "Contacted", notes: "Tue/Thu evenings" },
        { id: "a3", date: new Date(now - 3 * day).toISOString(), type: "corporate", name: "Giorgi Tsereteli", email: "giorgi@company.ge", phone: "+995 577 10 20 30", company: "Example LLC", team_size: "25", interest: "Wellness day at the office", message: "A Friday session for the office in March.", status: "New", notes: "" },
        { id: "a4", date: new Date(now - 4 * day).toISOString(), type: "retreat interest", name: "Sophie Laurent", email: "sophie@example.com", phone: "+33 6 12 34 56 78", retreat: "Any upcoming retreat", level: "Some experience", motivation: "Rest, sea air and time for myself.", health: "Pregnant, 14 weeks.", status: "Booked", notes: "" }
      ],
      retreats: [
        { id: "r1", slug: "spring-retreat-in-kakheti", status: "open", name: "Spring retreat in Kakheti", location: "Kakheti, Georgia", dates: "10–13 May 2027", start_date: "2027-05-10", price: "", summary: "Three days among the vineyards.", description: "", programme: "", included: "", not_included: "", cover: "", gallery: "" },
        { id: "r2", slug: "autumn-by-the-sea", status: "draft", name: "Autumn by the sea", location: "", dates: "", start_date: "", price: "", summary: "", description: "", programme: "", included: "", not_included: "", cover: "", gallery: "" }
      ],
      stats: { days: 30, total: total, byDay: byDay,
        sources: [["Instagram", Math.round(total * .52)], ["Direct", Math.round(total * .24)], ["Google", Math.round(total * .14)], ["WhatsApp", Math.round(total * .1)]],
        pages: [["/", Math.round(total * .45)], ["/retreats/", Math.round(total * .25)], ["/about/", Math.round(total * .17)], ["/online/", Math.round(total * .08)], ["/corporate/", Math.round(total * .05)]],
        devices: [["Mobile", Math.round(total * .78)], ["Desktop", Math.round(total * .19)], ["Tablet", Math.round(total * .03)]],
        zones: [["Asia/Tbilisi", Math.round(total * .8)], ["Europe/Berlin", Math.round(total * .1)], ["Europe/Moscow", Math.round(total * .1)]] }
    };
  };

  // ---------- API ----------
  var api = {
    load: function () {
      if (demo) return Promise.resolve(Object.assign({ ok: true }, sample()));
      return fetch(endpoint + "?key=" + encodeURIComponent(key) + "&days=" + days).then(function (r) { return r.json(); });
    },
    post: function (body) {
      if (demo) {
        if (body.action === "uploadPhoto") return Promise.resolve({ ok: true, url: "data:" + body.mime + ";base64," + body.data });
        if (body.action === "saveRetreat") {
          var r = body.retreat; r.id = r.id || "d" + Date.now(); r.slug = r.slug || String(r.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
          return Promise.resolve({ ok: true, retreat: r });
        }
        return Promise.resolve({ ok: true });
      }
      body.key = key;
      return fetch(endpoint, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
    }
  };

  // ---------- Tabs ----------
  var tabs = $$("[data-tab]");
  var showTab = function (name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      $("#panel-" + t.getAttribute("data-tab")).hidden = !on;
    });
    try { history.replaceState(null, "", (demo ? "?demo" : location.pathname) + "#" + name); } catch (e) {}
  };
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { showTab(t.getAttribute("data-tab")); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); showTab(n.getAttribute("data-tab"));
    });
  });

  // ---------- Sign-ups ----------
  var statCards = function (el, cards) {
    el.innerHTML = cards.map(function (c) { return '<div class="stat"><span class="stat-num">' + c[1] + '</span><span class="stat-label">' + esc(c[0]) + "</span></div>"; }).join("");
  };
  var renderSignupStats = function () {
    var weekAgo = Date.now() - 7 * 864e5;
    var count = function (fn) { return rows.filter(fn).length; };
    statCards($("[data-stats]"), [
      ["Total sign-ups", rows.length],
      ["New this week", count(function (r) { return new Date(r.date) > weekAgo; })],
      ["Not contacted yet", count(function (r) { return (r.status || "New") === "New"; })],
      ["Retreat interest", count(function (r) { return (r.type || "retreat interest") === "retreat interest"; })],
      ["Online sessions", count(function (r) { return r.type === "online session"; })],
      ["Corporate", count(function (r) { return r.type === "corporate"; })]
    ]);
    $("[data-count-signups]").textContent = rows.length;
  };
  var filteredRows = function () {
    var q = $("[data-search]").value.trim().toLowerCase();
    var st = $("[data-filter-status]").value, ty = $("[data-filter-type]").value;
    return rows.filter(function (r) {
      if (st && (r.status || "New") !== st) return false;
      if (ty && (r.type || "retreat interest") !== ty) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone, r.company, r.motivation, r.health, r.retreat, r.message].join(" ").toLowerCase().indexOf(q) > -1;
    });
  };
  var detail = function (label, value, flag) {
    return value ? '<p class="' + (flag ? "health-flag" : "") + '"><span class="cell-label">' + label + "</span>" + esc(value) + "</p>" : "";
  };
  var renderRows = function () {
    var list = filteredRows();
    $("[data-empty]").hidden = list.length > 0;
    $("[data-rows]").innerHTML = list.map(function (r) {
      var wa = waLink(r.phone), status = r.status || "New", type = r.type || "retreat interest";
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td class="nowrap" data-label="Date">' + esc(fmtDate(r.date)) + "</td>" +
        '<td data-label="Person"><strong>' + esc(r.name) + "</strong>" + (r.company ? "<br>" + esc(r.company) : "") + "<br>" +
          '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a>" +
          (r.phone ? '<br><a href="tel:' + esc(String(r.phone).replace(/[^\d+]/g, "")) + '">' + esc(r.phone) + "</a>" + (wa ? ' <a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : "") : "") + "</td>" +
        '<td data-label="Type"><span class="type-tag type-' + esc(type.split(" ")[0]) + '">' + esc(TYPE_LABEL[type] || type) + "</span>" + (r.level ? '<br><span class="muted small-text">' + esc(r.level) + "</span>" : "") + "</td>" +
        '<td data-label="Details" class="about-cell">' +
          detail("Retreat", r.retreat) + detail("Team size", r.team_size) + detail("Interested in", r.interest) +
          detail(type === "online session" ? "Wants to work on" : "Wants", r.motivation) +
          (type !== "corporate" ? detail("Health", r.health || "–", !isNone(r.health)) : "") + detail("Message", r.message) + "</td>" +
        '<td data-label="Status"><select class="status status-' + esc(status.toLowerCase().replace(/\s+/g, "-")) + '" data-field="status" aria-label="Status for ' + esc(r.name) + '">' +
          STATUSES.map(function (s) { return "<option" + (s === status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></td>" +
        '<td data-label="Notes"><textarea rows="2" data-field="notes" placeholder="Add a note" aria-label="Notes for ' + esc(r.name) + '">' + esc(r.notes) + "</textarea></td>" +
        "</tr>";
    }).join("");
  };
  $("[data-search]").addEventListener("input", renderRows);
  $("[data-filter-status]").addEventListener("change", renderRows);
  $("[data-filter-type]").addEventListener("change", renderRows);
  $("[data-rows]").addEventListener("change", function (e) {
    var el = e.target, field = el.getAttribute("data-field");
    if (!field) return;
    var id = el.closest("tr").getAttribute("data-id");
    var row = rows.filter(function (r) { return String(r.id) === id; })[0];
    if (!row) return;
    row[field] = el.value;
    el.classList.add("saving");
    api.post({ action: "update", id: id, status: field === "status" ? el.value : undefined, notes: field === "notes" ? el.value : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error();
        el.classList.remove("saving"); el.classList.add("saved");
        setTimeout(function () { el.classList.remove("saved"); }, 1200);
        if (field === "status") { el.className = "status status-" + el.value.toLowerCase().replace(/\s+/g, "-"); renderSignupStats(); }
      }).catch(function () { el.classList.remove("saving"); alert("Couldn't save. Please try again."); });
  });
  $("[data-export]").addEventListener("click", function () {
    var cols = ["date", "type", "name", "email", "phone", "company", "team_size", "interest", "retreat", "level", "motivation", "health", "message", "status", "notes"];
    var csv = [cols.join(",")].concat(filteredRows().map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c] == null ? "" : r[c]).replace(/"/g, '""') + '"'; }).join(",");
    })).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "retreats-signups-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  });
  $("[data-copy-emails]").addEventListener("click", function (e) {
    var b = e.currentTarget, list = filteredRows().map(function (r) { return r.email; }).filter(Boolean);
    var uniq = list.filter(function (x, i) { return list.indexOf(x) === i; }).join(", ");
    var ok = function () { b.textContent = "Copied " + uniq.split(", ").filter(Boolean).length + " emails"; setTimeout(function () { b.textContent = "Copy emails"; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(uniq).then(ok, function () { window.prompt("Copy these emails:", uniq); });
    else window.prompt("Copy these emails:", uniq);
  });

  // ---------- Retreats ----------
  var regCount = function (r) {
    var label = r.name + (r.dates ? " (" + r.dates + ")" : "");
    return rows.filter(function (x) { return x.retreat && (x.retreat === label || x.retreat.indexOf(r.name) === 0); }).length;
  };
  var renderRetreats = function () {
    $("[data-count-retreats]").textContent = retreats.length;
    var el = $("[data-retreat-list]");
    if (!retreats.length) { el.innerHTML = '<p class="muted admin-empty">No retreats yet. Click "New retreat" to add the first one.</p>'; return; }
    var order = { open: 0, soon: 1, draft: 2, closed: 3 };
    el.innerHTML = retreats.slice().sort(function (a, b) { return (order[a.status] - order[b.status]) || String(a.start_date).localeCompare(String(b.start_date)); }).map(function (r) {
      var live = r.status === "open" || r.status === "soon";
      return '<div class="retreat-row">' +
        '<div class="retreat-thumb">' + (r.cover ? '<img src="' + esc(r.cover) + '" alt="">' : "") + "</div>" +
        '<div class="retreat-info"><strong>' + esc(r.name) + '</strong><span class="muted">' + esc([r.location, r.dates].filter(Boolean).join(", ") || "No dates yet") + "</span></div>" +
        '<span class="r-status r-' + esc(r.status) + '">' + esc(R_STATUS[r.status] || r.status) + "</span>" +
        '<span class="muted nowrap">' + regCount(r) + " registered</span>" +
        '<div class="retreat-row-actions">' + (live ? '<a class="btn btn-line btn-small" href="' + siteUrl + "/retreats/" + esc(r.slug) + '/" target="_blank" rel="noopener">View</a>' : "") +
        '<button class="btn btn-small" type="button" data-edit="' + esc(r.id) + '">Edit</button></div></div>';
    }).join("");
  };

  var editor = $("[data-editor]"), gallery = [];
  var setCover = function (url) {
    editor.elements.cover.value = url || "";
    var img = $("[data-cover-preview]"); img.hidden = !url; if (url) img.src = url;
    $("[data-cover-remove]").hidden = !url;
  };
  var renderGallery = function () {
    editor.elements.gallery.value = gallery.join("\n");
    $("[data-gallery]").innerHTML = gallery.map(function (u, i) {
      return '<div class="g-item"><img src="' + esc(u) + '" alt=""><button type="button" class="g-remove" data-g="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button></div>';
    }).join("");
  };
  var editorMsg = function (ok, err) {
    var o = $("[data-editor-ok]"), e = $("[data-editor-error]");
    o.textContent = ok || ""; o.hidden = !ok; e.textContent = err || ""; e.hidden = !err;
  };
  var openEditor = function (r) {
    r = r || { status: "draft" };
    editor.reset(); editorMsg();
    ["id", "name", "status", "location", "dates", "start_date", "price", "summary", "description", "programme", "included", "not_included"].forEach(function (f) {
      var el = editor.elements[f]; if (el) el.value = r[f] == null ? "" : String(r[f]).slice(0, f === "start_date" ? 10 : undefined);
    });
    if (!r.status) editor.elements.status.value = "draft";
    setCover(r.cover);
    gallery = String(r.gallery || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    renderGallery();
    $("[data-editor-title]").textContent = r.id ? "Edit retreat" : "New retreat";
    $("[data-delete]").hidden = !r.id;
    var live = r.id && (r.status === "open" || r.status === "soon");
    var view = $("[data-view-link]"); view.hidden = !live; if (live) view.href = siteUrl + "/retreats/" + r.slug + "/";
    editor.hidden = false;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.elements.name.focus({ preventScroll: true });
  };
  $("[data-new-retreat]").addEventListener("click", function () { openEditor(); });
  $("[data-editor-close]").addEventListener("click", function () { editor.hidden = true; });
  $("[data-retreat-list]").addEventListener("click", function (e) {
    var b = e.target.closest("[data-edit]"); if (!b) return;
    openEditor(retreats.filter(function (r) { return String(r.id) === b.getAttribute("data-edit"); })[0]);
  });

  // Photo upload: shrink in the browser first, then store in Google Drive
  var resize = function (file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 2000, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = function () { reject(new Error("Couldn't read that image")); };
      img.src = url;
    });
  };
  var upload = function (file) {
    return resize(file).then(function (data) {
      return api.post({ action: "uploadPhoto", name: file.name, mime: "image/jpeg", data: data });
    }).then(function (res) { if (!res.ok) throw new Error(res.error || "Upload failed"); return res.url; });
  };
  $("[data-cover-input]").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    editorMsg("Uploading cover photo…");
    upload(f).then(function (url) { setCover(url); editorMsg("Cover photo uploaded. Remember to save."); })
      .catch(function (err) { editorMsg(null, err.message); }).then(function () { e.target.value = ""; });
  });
  $("[data-cover-remove]").addEventListener("click", function () { setCover(""); });
  $("[data-gallery-input]").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files); if (!files.length) return;
    var n = 0;
    editorMsg("Uploading " + files.length + " photo(s)…");
    files.reduce(function (p, f) {
      return p.then(function () { return upload(f).then(function (url) { gallery.push(url); n++; renderGallery(); editorMsg("Uploaded " + n + " of " + files.length + "…"); }); });
    }, Promise.resolve()).then(function () { editorMsg("Photos uploaded. Remember to save."); })
      .catch(function (err) { editorMsg(null, err.message); }).then(function () { e.target.value = ""; });
  });
  $("[data-gallery]").addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]"); if (!b) return;
    gallery.splice(+b.getAttribute("data-g"), 1); renderGallery();
  });

  editor.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!editor.elements.name.value.trim()) { editorMsg(null, "Please give the retreat a name."); editor.elements.name.focus(); return; }
    var r = {};
    ["id", "name", "status", "location", "dates", "start_date", "price", "summary", "description", "programme", "included", "not_included", "cover", "gallery"].forEach(function (f) { r[f] = editor.elements[f].value; });
    var existing = retreats.filter(function (x) { return String(x.id) === r.id; })[0];
    if (existing) r.slug = existing.slug;
    var btn = $("[data-save]"); btn.disabled = true; btn.textContent = "Saving…"; editorMsg();
    api.post({ action: "saveRetreat", retreat: r }).then(function (res) {
      if (!res.ok) throw new Error(res.error || "Couldn't save");
      var saved = res.retreat;
      var i = retreats.findIndex(function (x) { return String(x.id) === String(saved.id); });
      if (i > -1) retreats[i] = saved; else retreats.push(saved);
      editor.elements.id.value = saved.id;
      renderRetreats(); openEditor(saved);
      var live = saved.status === "open" || saved.status === "soon";
      editorMsg(live ? "Saved. It will appear on the website within about 15 minutes." : "Saved. It's hidden from the website (" + R_STATUS[saved.status] + ").");
    }).catch(function (err) { editorMsg(null, err.message); })
      .then(function () { btn.disabled = false; btn.textContent = "Save retreat"; });
  });
  $("[data-delete]").addEventListener("click", function () {
    var id = editor.elements.id.value;
    if (!id || !window.confirm("Delete this retreat? This can't be undone.")) return;
    api.post({ action: "deleteRetreat", id: id }).then(function (res) {
      if (!res.ok) throw new Error(res.error || "Couldn't delete");
      retreats = retreats.filter(function (x) { return String(x.id) !== id; });
      editor.hidden = true; renderRetreats();
    }).catch(function (err) { editorMsg(null, err.message); });
  });

  // ---------- Visitors ----------
  var zoneName = function (z) { return z && z.indexOf("/") > -1 ? z.split("/").pop().replace(/_/g, " ") : (z || "Unknown"); };
  var pageName = function (p) { return { "/": "Home", "/retreats/": "Retreats", "/about/": "About Anastasia", "/online/": "Online sessions", "/corporate/": "Corporate", "/contact/": "Contact", "/privacy/": "Privacy" }[p] || p; };
  var barList = function (el, items, fmt) {
    var max = Math.max.apply(null, items.map(function (x) { return x[1]; }).concat([1]));
    el.innerHTML = items.length ? items.slice(0, 8).map(function (x) {
      return '<div class="bar-row"><span class="bar-label">' + esc(fmt ? fmt(x[0]) : x[0]) + '</span><span class="bar-track"><span class="bar" style="width:' + Math.max(2, x[1] / max * 100) + '%"></span></span><span class="bar-num">' + x[1] + "</span></div>";
    }).join("") : '<p class="muted">No visits yet.</p>';
  };
  var renderVisitors = function () {
    var s = stats || { total: 0, byDay: {}, sources: [], pages: [], devices: [], zones: [] };
    var dayKeys = [], i, now = new Date();
    for (i = days - 1; i >= 0; i--) dayKeys.push(new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10));
    var vals = dayKeys.map(function (k) { return s.byDay[k] || 0; });
    var today = vals[vals.length - 1] || 0, week = vals.slice(-7).reduce(function (a, b) { return a + b; }, 0);
    var mobile = (s.devices.filter(function (d) { return d[0] === "Mobile"; })[0] || [0, 0])[1];
    statCards($("[data-visit-stats]"), [
      ["Page views (" + days + " days)", s.total], ["Last 7 days", week], ["Today", today],
      ["Top source", (s.sources[0] || ["–"])[0]], ["On mobile", s.total ? Math.round(mobile / s.total * 100) + "%" : "–"]
    ]);
    var max = Math.max.apply(null, vals.concat([1])), w = 100 / vals.length;
    $("[data-chart]").innerHTML = '<svg class="chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Page views per day, last ' + days + ' days">' +
      vals.map(function (v, i) { var h = v / max * 36; return '<rect x="' + (i * w + w * .12) + '" y="' + (40 - h) + '" width="' + (w * .76) + '" height="' + h + '"><title>' + dayKeys[i] + ": " + v + "</title></rect>"; }).join("") +
      '</svg><div class="chart-axis"><span>' + fmtDate(dayKeys[0]) + "</span><span>" + fmtDate(dayKeys[dayKeys.length - 1]) + "</span></div>";
    barList($("[data-list-sources]"), s.sources);
    barList($("[data-list-pages]"), s.pages, pageName);
    barList($("[data-list-devices]"), s.devices);
    barList($("[data-list-zones]"), s.zones, zoneName);
  };
  $("[data-days]").addEventListener("change", function (e) { days = +e.target.value; load(); });

  // ---------- Load / login ----------
  var load = function () {
    $("[data-updated]").textContent = "Loading…";
    return api.load().then(function (res) {
      if (!res.ok) throw new Error(res.error || "error");
      rows = res.rows || []; retreats = res.retreats || []; stats = res.stats || null;
      if (demo && stats) stats.days = days;
      if (res.sheet) { var a = $("[data-sheet-link]"); a.href = res.sheet; a.hidden = false; }
      $("[data-updated]").textContent = (demo ? "Sample data. " : "") + "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      renderSignupStats(); renderRows(); renderRetreats(); renderVisitors();
      return true;
    });
  };
  var showApp = function () {
    $("[data-login]").hidden = true; $("[data-app]").hidden = false;
    var h = location.hash.slice(1); showTab(["signups", "retreats", "visitors"].indexOf(h) > -1 ? h : "signups");
  };
  var showLogin = function (msg) {
    $("[data-app]").hidden = true; $("[data-login]").hidden = false;
    var err = $("[data-login-error]"); err.textContent = msg || ""; err.hidden = !msg;
  };
  $("[data-login-form]").addEventListener("submit", function (e) {
    e.preventDefault();
    key = $("#a-key").value;
    var btn = e.target.querySelector("button"); btn.disabled = true;
    load().then(function () { store.set(key, $("[data-remember]").checked); showApp(); })
      .catch(function () { showLogin("That password didn't work, or the sheet couldn't be reached."); })
      .then(function () { btn.disabled = false; });
  });
  $("[data-logout]").addEventListener("click", function () { store.clear(); key = null; rows = []; $("#a-key").value = ""; showLogin(); });
  $("[data-refresh]").addEventListener("click", function () { load().catch(function () { showLogin("Please log in again."); }); });

  if (demo) { key = "demo"; load().then(showApp); return; }
  key = store.get();
  if (key) load().then(showApp).catch(function () { store.clear(); showLogin(); });
})();
