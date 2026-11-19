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
    var set = function (open) { btn.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); };
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") set(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
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
