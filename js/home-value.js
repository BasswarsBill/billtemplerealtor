// "What's my home worth?" form (home-value.html).
// Sends the answers to Bill through the same email function as the client forms (api/submit-form.js).
(function () {
  var form = document.getElementById("hv-form");
  var errEl = document.getElementById("hv-error");

  var phoneLink = document.getElementById("hv-phone-link");
  phoneLink.textContent = SITE.phone;
  phoneLink.href = "tel:" + SITE.phone.replace(/[^0-9+]/g, "");

  // One line of local market context above the form, from data/market.json.
  fetch("data/market.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      var l = m && m.listings;
      if (!l) return;
      var el = document.getElementById("hv-market");
      el.textContent = "Right now on the Gulf Coast: the typical home is listed at $" +
        Math.round(l.medianListPrice).toLocaleString("en-US") + " and sits on the market about " +
        l.daysOnMarket + " days (" + l.monthLabel + ").";
      el.hidden = false;
    })
    .catch(function () {});

  // Label shown in Bill's email for each answer, grouped by section.
  var FIELDS = [
    ["Your home", "address", "Street address"],
    ["Your home", "city", "City"],
    ["Your home", "zip", "ZIP"],
    ["Your home", "type", "Type of home"],
    ["Your home", "beds", "Bedrooms"],
    ["Your home", "baths", "Bathrooms"],
    ["Your home", "sqft", "Square feet (about)"],
    ["Your home", "year", "Year built (about)"],
    ["Your home", "condition", "Condition"],
    ["Your home", "updates", "Updates or features"],
    ["Plans", "timeline", "When they might sell"],
    ["Plans", "notes", "Anything else"],
    ["Contact", "name", "Name"],
    ["Contact", "email", "Email"],
    ["Contact", "phone", "Phone"],
    ["Contact", "contact", "Best way to reach them"],
  ];

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var missing = ["address", "city", "zip", "name", "email"].filter(function (n) {
      return !form.elements[n].value.trim();
    });
    if (missing.length) {
      return showError("Please fill in your address, city, ZIP, name and email.", form.elements[missing[0]]);
    }
    if (!form.elements.email.checkValidity()) {
      return showError("Please check your email address.", form.elements.email);
    }

    var answers = FIELDS.map(function (f) {
      var el = form.elements[f[1]];
      return { section: f[0], label: f[2], value: el ? String(el.value || "").trim() : "" };
    });

    var button = form.querySelector("button[type=submit]");
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    fetch("/api/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lead",
        formId: "home-value",
        formTitle: "Home value request",
        answers: answers,
        replyTo: form.elements.email.value.trim(),
        _hp: form.elements.hp_check.value,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Something went wrong sending your request.");
        });
      })
      .then(function () {
        form.hidden = true;
        document.getElementById("hv-intro").hidden = true;
        document.getElementById("hv-done").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(function (err) {
        showError(err.message + " Please try again, or call or text me at " + SITE.phone + ".");
        button.disabled = false;
        button.textContent = label;
      });
  });

  function showError(msg, focusEl) {
    errEl.textContent = msg;
    errEl.hidden = false;
    if (focusEl) focusEl.focus();
  }
})();
