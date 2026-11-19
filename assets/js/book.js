/* Booking flow: 4 steps with a live summary. */
(function () {
  "use strict";
  var form = document.querySelector("[data-booking]");
  if (!form) return;
  var SITE = window.SITE || {};
  var cur = SITE.currency || "₾", dep = (SITE.deposit_percent || 30) / 100;
  var retreats = JSON.parse(form.getAttribute("data-retreats") || "[]");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fill = function (t) {
    var d = document.createElement("div"); d.textContent = t || "";
    return d.innerHTML.replace(/\[([^\]]+)\]/g, '<span class="fill">[$1]</span>');
  };
  var fmt = function (n) { return cur + Math.round(n).toLocaleString("en-US").replace(/,/g, " "); };

  var params = new URLSearchParams(location.search);
  var step = 1, guests = Math.max(1, Math.min(4, +params.get("guests") || 1));
  var steps = $$("[data-step]", form), progress = $$(".book-progress li", form);
  var btnNext = $("[data-next]", form), btnBack = $("[data-back]", form), btnSubmit = $("[data-submit]", form);
  var errorEl = $("[data-error]", form);

  if (params.get("retreat")) {
    var pre = $('input[name=retreat][value="' + params.get("retreat") + '"]', form);
    if (pre) pre.checked = true;
  }

  var currentRetreat = function () {
    var slug = ($("input[name=retreat]:checked", form) || {}).value;
    return retreats.filter(function (r) { return r.slug === slug; })[0] || retreats[0];
  };
  var currentRoom = function () {
    var r = currentRetreat(), id = ($("input[name=room]:checked", form) || {}).value;
    return r && r.rooms.filter(function (x) { return x.id === id; })[0];
  };

  var renderRooms = function (preferId) {
    var r = currentRetreat(), wrap = $("[data-room-options]", form);
    if (!r) return;
    wrap.innerHTML = r.rooms.map(function (room, i) {
      var checked = preferId ? room.id === preferId : i === 1;
      return '<label class="choice"><input type="radio" name="room" value="' + room.id + '"' + (checked ? " checked" : "") + '>' +
        '<span class="choice-body"><b>' + fill(room.name) + '</b><small>' + fill(room.detail) + '</small>' +
        '<span class="choice-price">' + (room.price == null ? '<span class="fill">[Price]</span>' : fmt(room.price)) + '</span></span></label>';
    }).join("");
    if (!$("input[name=room]:checked", wrap) && $("input[name=room]", wrap)) $("input[name=room]", wrap).checked = true;
    $$("input[name=room]", wrap).forEach(function (el) { el.addEventListener("change", summary); });
  };

  var summary = function () {
    var r = currentRetreat(), room = currentRoom();
    if (!r) return;
    $("[data-s-meta]").innerHTML = fill(r.location) + " · " + fill(r.dates);
    $("[data-s-name]").innerHTML = fill(r.name);
    $("[data-s-room]").innerHTML = room ? fill(room.name) : "—";
    $("[data-s-guests]").textContent = guests;
    $("[data-guests]", form).textContent = guests;
    if (room && room.price != null) {
      $("[data-s-per]").textContent = fmt(room.price);
      $("[data-s-total]").textContent = fmt(room.price * guests);
      $("[data-s-deposit]").textContent = fmt(room.price * guests * dep);
    } else {
      $("[data-s-per]").innerHTML = '<span class="fill">[Price]</span>';
      $("[data-s-total]").innerHTML = '<span class="fill">[Price]</span>';
      $("[data-s-deposit]").textContent = "—";
    }
  };

  var showError = function (msg) { errorEl.textContent = msg; errorEl.hidden = !msg; };

  var validate = function (n) {
    var panel = $('[data-step="' + n + '"]', form), bad = null;
    $$("input[required], textarea[required], select[required]", panel).forEach(function (el) {
      if (bad) return;
      if (el.type === "radio") { if (!$('input[name="' + el.name + '"]:checked', form)) bad = el; }
      else if (el.type === "checkbox") { if (!el.checked) bad = el; }
      else if (!el.checkValidity()) bad = el;
    });
    if (bad) {
      var msg = bad.name === "terms" ? "Please agree to the terms to continue." :
        bad.type === "radio" ? "Please choose one option." :
        bad.type === "email" && bad.value ? "Please check your email address." : "Please fill in the highlighted field.";
      showError(msg); bad.focus(); return false;
    }
    showError(""); return true;
  };

  var go = function (n) {
    step = n;
    steps.forEach(function (s) {
      var on = s.getAttribute("data-step") === String(n);
      s.hidden = !on;
      if (on) { s.classList.remove("is-in"); void s.offsetWidth; s.classList.add("is-in"); }
    });
    progress.forEach(function (li, i) {
      li.classList.toggle("is-done", i + 1 < n);
      li.classList.toggle("is-current", i + 1 === n);
      if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    btnBack.hidden = n === 1;
    btnNext.hidden = n === 4;
    btnSubmit.hidden = n !== 4;
    if (n === 4) review();
    var top = form.getBoundingClientRect().top + window.scrollY - 120;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
  };

  var data = function () {
    var r = currentRetreat(), room = currentRoom(), f = form.elements;
    return [
      ["Retreat", r ? r.name + " (" + r.dates + ")" : ""],
      ["Room", room ? room.name : ""],
      ["Guests", String(guests)],
      ["Name", f.name.value], ["Email", f.email.value], ["Phone", f.phone.value], ["Country", f.country.value],
      ["Heard about us", f.source.value],
      ["Experience", (($("input[name=experience]:checked", form)) || {}).value || ""],
      ["Health", f.health.value], ["Diet", f.diet.value], ["Emergency contact", f.emergency.value],
      ["Pregnant / postnatal", f.pregnant.checked ? "Yes" : ""],
      ["Note", f.note.value]
    ];
  };

  var review = function () {
    $("[data-review]", form).innerHTML = data().filter(function (p) { return p[1]; }).map(function (p) {
      return '<dt class="muted">' + p[0] + '</dt><dd style="margin:0">' + fill(p[1]) + "</dd>";
    }).join("");
  };

  btnNext.addEventListener("click", function () { if (validate(step)) go(step + 1); });
  btnBack.addEventListener("click", function () { showError(""); go(step - 1); });
  $("[data-minus]", form).addEventListener("click", function () { guests = Math.max(1, guests - 1); summary(); });
  $("[data-plus]", form).addEventListener("click", function () { guests = Math.min(4, guests + 1); summary(); });
  $$("input[name=retreat]", form).forEach(function (el) { el.addEventListener("change", function () { renderRooms(); summary(); }); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate(4)) return;
    var lines = data().filter(function (p) { return p[1]; }).map(function (p) { return p[0] + ": " + p[1]; });
    if (window.sendToAnastasia) window.sendToAnastasia("Booking request — retreats.ge", lines);
    $("[data-first-name]", form).textContent = (form.elements.name.value.split(" ")[0] || "dear");
    $(".book-progress", form).hidden = true;
    $("[data-nav]", form).hidden = true;
    steps.forEach(function (s) { s.hidden = s.getAttribute("data-step") !== "done"; });
  });

  renderRooms(params.get("room"));
  summary();
  go(1);
  window.scrollTo(0, 0);
})();
