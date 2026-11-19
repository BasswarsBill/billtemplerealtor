// "Sell with Bill" page (sell.html): 3D tour embed, market line and the seller form.
// The form goes to Bill through the same email function as the other forms (api/submit-form.js).
(function () {
  var form = document.getElementById("sell-form");
  var errEl = document.getElementById("sell-error");

  var phoneLink = document.getElementById("sell-phone-link");
  phoneLink.textContent = SITE.phone;
  phoneLink.href = "tel:" + SITE.phone.replace(/[^0-9+]/g, "");

  // 3D walkthrough: shows only when SITE.tour3d (js/site.js) has a link.
  if (SITE.tour3d && /^https:\/\//.test(SITE.tour3d)) {
    document.getElementById("tour3d-frame").src = SITE.tour3d;
    document.getElementById("tour3d").hidden = false;
  }

  // One line of local market context, from data/market.json (refreshed weekly).
  fetch("data/market.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      var l = m && m.listings;
      if (!l) return;
      var el = document.getElementById("sell-market");
      el.textContent = "Right now on the Gulf Coast (" + l.monthLabel + "): about " +
        l.activeListings.toLocaleString("en-US") + " homes for sale, a typical list price of $" +
        Math.round(l.medianListPrice).toLocaleString("en-US") + ", and about " + l.daysOnMarket +
        " days on the market. Standing out online is how a home beats those numbers.";
      el.hidden = false;
    })
    .catch(function () {});

  var FIELDS = [
    ["Their home", "address", "Street address"],
    ["Their home", "city", "City"],
    ["Their home", "zip", "ZIP"],
    ["Their home", "type", "Type of home"],
    ["Their home", "timeline", "When they'd like to sell"],
    ["Their home", "occupied", "Who lives there now"],
    ["Their home", "priority", "What matters most"],
    ["Their home", "notes", "Anything else"],
    ["Contact", "name", "Name"],
    ["Contact", "email", "Email"],
    ["Contact", "phone", "Phone"],
    ["Contact", "contact", "Best way to reach them"],
  ];

  function valueOf(name) {
    if (name === "priority") {
      return Array.prototype.filter.call(form.querySelectorAll("input[name=priority]"), function (c) { return c.checked; })
        .map(function (c) { return c.value; }).join(", ");
    }
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var missing = ["address", "city", "name", "email"].filter(function (n) { return !form.elements[n].value.trim(); });
    if (missing.length) return showError("Please fill in your address, city, name and email.", form.elements[missing[0]]);
    if (!form.elements.email.checkValidity()) return showError("Please check your email address.", form.elements.email);

    var answers = FIELDS.map(function (f) { return { section: f[0], label: f[2], value: valueOf(f[1]) }; });

    var button = form.querySelector("button[type=submit]");
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    fetch("/api/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lead",
        formId: "sell-with-bill",
        formTitle: "Seller consultation request",
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
        document.getElementById("sell-intro").hidden = true;
        document.getElementById("sell-done").hidden = false;
        document.getElementById("talk").scrollIntoView({ behavior: "smooth" });
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
