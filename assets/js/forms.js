/* Sends enquiry forms to Anastasia by WhatsApp (if a number is set) or email.
   Replace with a form service or booking backend later. */
(function () {
  "use strict";
  window.sendToAnastasia = function (subject, lines) {
    var text = subject + "\n\n" + lines.filter(Boolean).join("\n");
    var wa = window.waUrl && window.waUrl(text);
    if (wa) { window.open(wa, "_blank", "noopener"); return; }
    var email = (window.SITE && window.SITE.email) || "";
    window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.filter(Boolean).join("\n"));
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-enquiry]"), function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var lines = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || !el.value) return;
        var label = form.querySelector('label[for="' + el.id + '"]');
        lines.push((label ? label.textContent : el.name) + ": " + el.value);
      });
      window.sendToAnastasia("Enquiry from retreats.ge", lines);
      var done = form.querySelector(".signup-done");
      if (done) done.hidden = false;
      form.reset();
    });
  });
})();
