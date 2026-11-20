// Georgian pages set window.I18N; English text is the key
function T(s) { return (window.I18N && window.I18N[s]) || s; }

(function () {
  "use strict";
  var SITE = window.SITE || {};

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Header border after scrolling
  var header = document.querySelector("[data-header]");
  var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  var btn = document.querySelector("[data-menu]"), nav = document.getElementById("nav");
  if (btn && nav) {
    var set = function (open) { btn.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); document.body.classList.toggle("menu-open", open); };
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 900) set(false); });
  }

  // Sign-up forms (retreat interest, online session, corporate): saved to the Google Sheet
  var TYPES = { retreat: "retreat interest", online: "online session", corporate: "corporate" };
  document.querySelectorAll("[data-signup-form]").forEach(function (form) {
    var success = form.parentNode.querySelector("[data-success]");
    var error = form.querySelector(".form-error");
    var btn = form.querySelector("button[type=submit]");
    var showError = function (msg) { error.textContent = msg; error.hidden = !msg; };

    var validate = function () {
      var first = null;
      form.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
      form.querySelectorAll("input[required], textarea[required], select[required]").forEach(function (el) {
        var ok = el.type === "radio" ? !!form.querySelector('input[name="' + el.name + '"]:checked')
          : el.type === "checkbox" ? el.checked : el.checkValidity() && el.value.trim() !== "";
        if (!ok) {
          (el.closest(".field") || el.closest(".check-row")).classList.add("invalid");
          if (!first) first = el;
        }
      });
      if (first) {
        showError(first.name === "consent" ? T("Please tick the box to agree.") : first.type === "email" && first.value ? T("Please check your email address.") : T("Please fill in the highlighted fields."));
        first.focus();
        return false;
      }
      showError(""); return true;
    };
    form.addEventListener("input", function (e) { var w = e.target.closest(".invalid"); if (w) w.classList.remove("invalid"); });
    form.addEventListener("change", function (e) { var w = e.target.closest(".invalid"); if (w) w.classList.remove("invalid"); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var data = { type: TYPES[form.getAttribute("data-kind")] || "retreat interest", page: location.pathname };
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.name === "consent") return;
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
        data[el.name] = el.value.trim();
      });
      var done = function () {
        success.querySelector("[data-first-name]").textContent = data.name.split(" ")[0];
        form.hidden = true; success.hidden = false; success.focus();
      };
      btn.disabled = true; btn.textContent = T("Sending…"); showError("");
      fetch(SITE.forms_endpoint, { method: "POST", body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) { if (!res.ok) throw new Error(res.error); done(); })
        .catch(function () {
          showError(T("Something went wrong. Please try again, or email {email}.").replace("{email}", SITE.email));
          btn.disabled = false; btn.textContent = btn.getAttribute("data-label");
        });
    });
  });

  // Share buttons: the phone's own share sheet where available, otherwise a small menu
  document.querySelectorAll("[data-share]").forEach(function (box) {
    var toggle = box.querySelector("[data-share-toggle]"), menu = box.querySelector("[data-share-menu]");
    var url = box.getAttribute("data-url"), title = box.getAttribute("data-title");
    var close = function () { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
    toggle.addEventListener("click", function () {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: title, text: title, url: url }).catch(function () {});
        return;
      }
      var open = menu.hidden;
      menu.hidden = !open; toggle.setAttribute("aria-expanded", String(open));
    });
    box.querySelector("[data-copy]").addEventListener("click", function (e) {
      var b = e.currentTarget;
      var ok = function () { b.textContent = T("Link copied"); setTimeout(function () { b.textContent = T("Copy link"); close(); }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, function () { window.prompt(T("Copy this link:"), url); });
      else window.prompt(T("Copy this link:"), url);
    });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  });

  // Visitor statistics: one anonymous count per page view (no cookies, nothing personal)
  (function () {
    if (!SITE.forms_endpoint || /^\/admin/.test(location.pathname) || navigator.webdriver) return;
    if (!/^(www\.)?retreats\.ge$/.test(location.hostname)) return;
    var ref = document.referrer, source = "Direct";
    try {
      var host = ref ? new URL(ref).hostname.replace(/^www\./, "") : "";
      if (host === location.hostname.replace(/^www\./, "")) source = "Internal";
      else if (/instagram/.test(host)) source = "Instagram";
      else if (/facebook|fb\./.test(host)) source = "Facebook";
      else if (/google\./.test(host)) source = "Google";
      else if (/t\.me|telegram/.test(host)) source = "Telegram";
      else if (/whatsapp|wa\.me/.test(host)) source = "WhatsApp";
      else if (/bing\.|yandex\.|duckduckgo/.test(host)) source = "Other search";
      else if (host) source = host;
      var p = new URLSearchParams(location.search).get("utm_source");
      if (p) source = p.charAt(0).toUpperCase() + p.slice(1);
    } catch (e) {}
    var zone = ""; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var payload = JSON.stringify({ action: "visit", path: location.pathname, source: source,
      device: window.innerWidth < 768 ? "Mobile" : window.innerWidth < 1100 ? "Tablet" : "Desktop",
      zone: zone, lang: (navigator.language || "").slice(0, 5) });
    if (navigator.sendBeacon) navigator.sendBeacon(SITE.forms_endpoint, new Blob([payload], { type: "text/plain" }));
    else fetch(SITE.forms_endpoint, { method: "POST", body: payload, keepalive: true }).catch(function () {});
  })();

  // Gentle fade-in as sections scroll into view
  var targets = document.querySelectorAll(".section .title, .section .lead, .retreat-card, .soon-card, .option, .pillar, .steps li, .includes li, .schedule li, .faq details, .creds li, .price-row, .certs li, .styles li, .facts p, .two-lists > div, .form, .contact .actions");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.transitionDelay = Math.min(sibs, 5) * 70 + "ms";
        el.classList.add("in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }

  // Certificate viewer
  var viewer = document.querySelector("[data-viewer]");
  if (viewer && viewer.showModal) {
    var img = viewer.querySelector("img"), cap = viewer.querySelector(".viewer-caption");
    document.querySelectorAll("[data-cert]").forEach(function (b) {
      b.addEventListener("click", function () {
        img.src = b.getAttribute("data-cert");
        img.alt = b.querySelector("img").alt;
        cap.textContent = b.getAttribute("data-caption");
        viewer.showModal();
      });
    });
    viewer.querySelector("[data-close]").addEventListener("click", function () { viewer.close(); });
    viewer.addEventListener("click", function (e) { if (e.target === viewer) viewer.close(); });
  } else {
    document.querySelectorAll("[data-cert]").forEach(function (b) {
      b.addEventListener("click", function () { window.open(b.getAttribute("data-cert"), "_blank"); });
    });
  }
})();

// Class video: pause button, and no autoplay for people who prefer less motion
(function () {
  document.querySelectorAll(".video-frame").forEach(function (frame) {
    var v = frame.querySelector("video"), b = frame.querySelector("[data-video-toggle]");
    if (!v || !b) return;
    function sync() { var p = v.paused; b.classList.toggle("paused", p); b.setAttribute("aria-label", p ? T("Play video") : T("Pause video")); }
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); }
    b.addEventListener("click", function () { v.paused ? v.play() : v.pause(); });
    v.addEventListener("play", sync); v.addEventListener("pause", sync); sync();
  });
})();
