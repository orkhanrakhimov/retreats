/* retreats.ge — shared interactions */
(function () {
  "use strict";
  var SITE = window.SITE || {};
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* WhatsApp: builds a wa.me link once a number is set in site.json */
  window.waUrl = function (text) {
    var n = String(SITE.whatsapp || "").replace(/\D/g, "");
    if (!n) return null;
    return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
  };
  var wa = window.waUrl("Hello Anastasia, I have a question about your retreats.");
  if (wa) $$("[data-whatsapp-link]").forEach(function (a) { a.href = wa; a.target = "_blank"; a.rel = "noopener"; });

  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* Header: transparent over hero, solid after scrolling */
  var header = $("[data-header]");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Mobile menu */
  var toggle = $("[data-menu-toggle]"), menu = $("[data-menu]");
  if (toggle && menu) {
    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      document.body.classList.toggle("menu-open", open);
    };
    toggle.addEventListener("click", function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 1060) setMenu(false); });
  }

  /* Scroll reveal */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Spots-left bars */
  $$("[data-spots]").forEach(function (el) {
    var cap = +el.getAttribute("data-capacity"), left = el.getAttribute("data-spots");
    var bar = $(".spots-bar span", el);
    if (!bar || left === "" || !cap) return;
    var pct = Math.max(4, Math.min(100, ((cap - +left) / cap) * 100));
    setTimeout(function () { bar.style.width = pct + "%"; }, 300);
  });

  /* Countdown to a retreat's start date */
  $$("[data-countdown]").forEach(function (el) {
    var target = new Date(el.getAttribute("data-countdown"));
    if (isNaN(target)) { el.hidden = true; return; }
    var d = $("[data-d]", el), h = $("[data-h]", el), m = $("[data-m]", el);
    var tick = function () {
      var ms = Math.max(0, target - new Date());
      d.textContent = Math.floor(ms / 864e5);
      h.textContent = Math.floor(ms / 36e5) % 24;
      m.textContent = Math.floor(ms / 6e4) % 60;
    };
    tick(); setInterval(tick, 30000);
  });

  /* Tabs: "a day at the retreat" */
  $$("[data-tabs]").forEach(function (root) {
    var tabs = $$("[role=tab]", root), panels = $$("[role=tabpanel]", root);
    var select = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
        if (on) { panels[j].classList.remove("is-in"); void panels[j].offsetWidth; panels[j].classList.add("is-in"); }
      });
      if (focus) tabs[i].focus();
      if (tabs[i].scrollIntoView && window.innerWidth < 860) tabs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: reduce ? "auto" : "smooth" });
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = tabs.length;
        if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); select((i + 1) % n, true); }
        if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); select((i - 1 + n) % n, true); }
      });
    });
  });

  /* Testimonial slider */
  $$("[data-slider]").forEach(function (root) {
    var slides = $$(".slide", root), dotsWrap = $(".dots", root), i = 0, timer;
    if (slides.length < 2) return;
    var dots = slides.map(function (_, j) {
      var b = document.createElement("button");
      b.className = "dot"; b.type = "button";
      b.setAttribute("aria-label", "Show story " + (j + 1));
      b.addEventListener("click", function () { go(j); restart(); });
      dotsWrap.appendChild(b);
      return b;
    });
    var go = function (j) {
      i = (j + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); s.setAttribute("aria-hidden", String(k !== i)); });
      dots.forEach(function (d, k) { d.setAttribute("aria-current", String(k === i)); });
    };
    var restart = function () { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(i + 1); }, 8000); };
    $("[data-prev]", root).addEventListener("click", function () { go(i - 1); restart(); });
    $("[data-next]", root).addEventListener("click", function () { go(i + 1); restart(); });
    root.addEventListener("mouseenter", function () { clearInterval(timer); });
    root.addEventListener("mouseleave", restart);
    go(0); restart();
  });

  /* Email sign-up (connect to a mailing service later) */
  $$("[data-signup]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var done = $(".signup-done", form);
      $$("input, button", form).forEach(function (el) { el.disabled = true; });
      if (done) done.hidden = false;
    });
  });

  /* Retreat page: section sub-nav highlight + mobile booking bar */
  var subLinks = $$("[data-subnav] a");
  if (subLinks.length && "IntersectionObserver" in window) {
    var map = {};
    subLinks.forEach(function (a) { var s = $(a.getAttribute("href")); if (s) map[s.id] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          subLinks.forEach(function (a) { a.classList.remove("is-active"); });
          map[e.target.id].classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }
  var mBook = $("[data-mobile-book]"), rHero = $("[data-retreat-hero]");
  if (mBook && rHero && "IntersectionObserver" in window) {
    document.body.classList.add("has-mobile-book");
    new IntersectionObserver(function (entries) {
      mBook.classList.toggle("is-visible", !entries[0].isIntersecting);
    }).observe(rHero);
  }

  /* Price calculator on the retreat page */
  $$("[data-calc]").forEach(function (root) {
    var rooms = JSON.parse(root.getAttribute("data-rooms") || "[]");
    var dep = (SITE.deposit_percent || 30) / 100, cur = SITE.currency || "₾";
    var guests = 1, out = $("[data-guests]", root);
    var fmt = function (n) { return cur + Math.round(n).toLocaleString("en-US").replace(/,/g, " "); };
    var update = function () {
      var id = ($("input[name=calc-room]:checked", root) || {}).value;
      var room = rooms.filter(function (r) { return r.id === id; })[0];
      out.textContent = guests;
      var total = $("[data-total]", root), deposit = $("[data-deposit]", root), per = $("[data-per]", root);
      if (!room || room.price == null) {
        total.innerHTML = '<span class="fill">[Price]</span>';
        deposit.textContent = "—"; per.textContent = "—";
      } else {
        total.textContent = fmt(room.price * guests);
        per.textContent = fmt(room.price);
        deposit.textContent = fmt(room.price * guests * dep);
      }
      var link = $("[data-calc-book]", root);
      if (link) link.href = link.getAttribute("data-base") + "&room=" + encodeURIComponent(id || "") + "&guests=" + guests;
    };
    $$("input[name=calc-room]", root).forEach(function (r) { r.addEventListener("change", update); });
    $("[data-minus]", root).addEventListener("click", function () { guests = Math.max(1, guests - 1); update(); });
    $("[data-plus]", root).addEventListener("click", function () { guests = Math.min(4, guests + 1); update(); });
    update();
  });

  /* "Find your retreat" quiz */
  $$("[data-quiz]").forEach(function (form) {
    var retreats = JSON.parse(form.getAttribute("data-retreats") || "[]");
    var result = $("[data-quiz-result]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var goal = (($("input[name=goal]:checked", form)) || {}).value;
      var level = (($("input[name=level]:checked", form)) || {}).value;
      var room = (($("input[name=stay]:checked", form)) || {}).value;
      if (!goal || !level || !room) {
        result.hidden = false;
        result.innerHTML = '<p class="lead">Choose one answer for each question and we\'ll suggest a retreat.</p>';
        return;
      }
      var scored = retreats.map(function (r) {
        return { r: r, s: (r.focus.indexOf(goal) > -1 ? 2 : 0) + (r.status === "open" ? 1 : 0) };
      }).sort(function (a, b) { return b.s - a.s; });
      var best = scored[0] && scored[0].r;
      var levelNote = level === "new" ? "Every class has gentler options, so starting here is perfect." :
        level === "injury" ? "Anastasia is a doctor with expertise in rehabilitation. She'll adapt every practice to you, and you'll fill in a short health form before you arrive." :
        "Expect strong morning practices and space to go deeper.";
      var roomNote = room === "private" ? "We'll keep a private room for you." : room === "friend" ? "Book a shared twin room together with your friend." : "Many guests come alone and leave with friends.";
      result.hidden = false;
      if (!best) { result.innerHTML = '<p class="lead">New dates are coming soon. Join the list to hear first.</p>'; return; }
      var href = best.status === "open" ? "/retreats/" + best.slug + "/" : "/contact/";
      result.innerHTML =
        '<span class="eyebrow">Your retreat</span>' +
        '<h3 class="h3" style="color:var(--ivory)">' + best.name.replace(/\[([^\]]+)\]/g, '<span class="fill">[$1]</span>') + '</h3>' +
        '<p class="lead" style="margin-top:14px">' + levelNote + ' ' + roomNote + '</p>' +
        '<div style="margin-top:26px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-champagne" href="' + href + '">' + (best.status === "open" ? "See this retreat" : "Get notified") + '</a>' +
        '<a class="btn btn-ghost-light" href="/contact/">Ask Anastasia</a></div>';
      result.classList.remove("is-in"); void result.offsetWidth; result.classList.add("is-in");
    });
  });
})();
