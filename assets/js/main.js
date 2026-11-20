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

  // Booking request: opens the guest's email app with everything filled in
  document.querySelectorAll("[data-book]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var lines = ["Retreat: " + form.getAttribute("data-retreat")];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name && el.value) lines.push(el.name + ": " + el.value);
      });
      var subject = "Booking request: " + form.getAttribute("data-retreat");
      window.location.href = "mailto:" + SITE.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      form.querySelector(".form-done").hidden = false;
    });
  });

  // Interest registration: saved to the sign-ups sheet (falls back to email until it is connected)
  document.querySelectorAll("[data-waitlist]").forEach(function (form) {
    var success = form.parentNode.querySelector("[data-success]");
    var error = form.querySelector(".form-error");
    var showError = function (msg) { error.textContent = msg; error.hidden = !msg; };

    var validate = function () {
      var first = null;
      form.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
      form.querySelectorAll("input[required], textarea[required]").forEach(function (el) {
        var ok = el.type === "radio" ? !!form.querySelector('input[name="' + el.name + '"]:checked')
          : el.type === "checkbox" ? el.checked : el.checkValidity() && el.value.trim() !== "";
        if (!ok) {
          (el.closest(".field") || el.closest(".check-row")).classList.add("invalid");
          if (!first) first = el;
        }
      });
      if (first) {
        showError(first.name === "consent" ? "Please tick the box to agree." : first.type === "email" && first.value ? "Please check your email address." : "Please fill in the highlighted fields.");
        first.focus();
        return false;
      }
      showError(""); return true;
    };
    form.addEventListener("input", function (e) {
      var w = e.target.closest(".invalid"); if (w) w.classList.remove("invalid");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var f = form.elements;
      var data = {
        type: "retreat interest", name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
        level: (form.querySelector("input[name=level]:checked") || {}).value || "",
        motivation: f.motivation.value.trim(), health: f.health.value.trim(),
        retreat: f.retreat ? f.retreat.value : "Any upcoming retreat", page: location.pathname, website: f.website.value
      };
      var done = function () {
        success.querySelector("[data-first-name]").textContent = data.name.split(" ")[0];
        form.hidden = true; success.hidden = false; success.focus();
      };
      if (!SITE.forms_endpoint) {
        var body = ["Name: " + data.name, "Email: " + data.email, "Phone: " + data.phone, "Level: " + data.level,
          "Motivation: " + data.motivation, "Health: " + data.health, "Retreat: " + data.retreat].join("\n");
        window.location.href = "mailto:" + SITE.email + "?subject=" + encodeURIComponent("Retreat interest: " + data.name) + "&body=" + encodeURIComponent(body);
        done();
        return;
      }
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…"; showError("");
      fetch(SITE.forms_endpoint, { method: "POST", body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) { if (!res.ok) throw new Error(res.error); done(); })
        .catch(function () {
          showError("Something went wrong. Please try again, or email " + SITE.email + ".");
          btn.disabled = false; btn.textContent = "Register my interest";
        });
    });
  });

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
