// "Tell me what you're looking for" buyer wish list (find-a-home.html).
// Sends the answers to Bill through the same email function as the other forms (api/submit-form.js).
// A search typed on the home page or a town guide (?q=Biloxi&max=300000&beds=3) fills it in.
(function () {
  var form = document.getElementById("fh-form");
  var errEl = document.getElementById("fh-error");
  var params = new URLSearchParams(location.search);

  var phoneLink = document.getElementById("fh-phone-link");
  phoneLink.textContent = SITE.phone;
  phoneLink.href = "tel:" + SITE.phone.replace(/[^0-9+]/g, "");

  // Towns come from the neighborhood guides, so a new guide shows up here too.
  var FALLBACK_TOWNS = ["Gulfport", "Biloxi", "Long Beach", "Pass Christian", "Bay St. Louis", "Ocean Springs", "D'Iberville"];
  fetch("data/towns.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var names = d && Array.isArray(d.towns) ? d.towns.map(function (t) { return t.name; }).filter(Boolean) : [];
      return names.length ? names : FALLBACK_TOWNS;
    })
    .catch(function () { return FALLBACK_TOWNS; })
    .then(function (names) {
      var box = document.getElementById("fh-towns");
      names.concat(["Somewhere else on the Coast", "Not sure yet"]).forEach(function (name) {
        var label = document.createElement("label");
        label.className = "check";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.name = "towns";
        input.value = name;
        label.append(input, " " + name);
        box.append(label);
      });
      prefill(names);
    });

  function prefill(towns) {
    var q = (params.get("q") || "").trim();
    if (q) {
      var match = towns.filter(function (t) { return t.toLowerCase() === q.toLowerCase(); })[0];
      if (match) {
        form.querySelector('input[name=towns][value="' + match.replace(/"/g, '\\"') + '"]').checked = true;
      } else {
        form.elements.area.value = q; // a ZIP or street typed in the home page search
      }
    }
    ["min", "max", "beds"].forEach(function (k) {
      var v = params.get(k);
      var sel = form.elements[k];
      if (v && sel && Array.prototype.some.call(sel.options, function (o) { return o.value === v; })) sel.value = v;
    });
  }

  function money(v) { return v ? "$" + Number(v).toLocaleString("en-US") : ""; }
  function checked(name) {
    return Array.prototype.filter.call(form.querySelectorAll("input[name=" + name + "]"), function (i) { return i.checked; })
      .map(function (i) { return i.value; }).join(", ");
  }
  function radio(name) { return checked(name); }
  function val(name) { return String(form.elements[name].value || "").trim(); }
  function optionText(name) {
    var sel = form.elements[name];
    return sel.value ? sel.options[sel.selectedIndex].text : "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var missing = ["name", "email"].filter(function (n) { return !val(n); });
    if (missing.length) return showError("Please fill in your name and email.", form.elements[missing[0]]);
    if (!form.elements.email.checkValidity()) return showError("Please check your email address.", form.elements.email);
    if (val("min") && val("max") && +val("min") > +val("max")) {
      return showError("Your lowest price is higher than your highest price.", form.elements.min);
    }

    var price = val("min") || val("max")
      ? (val("min") ? money(val("min")) : "Any") + " to " + (val("max") ? optionText("max") : "any")
      : "";
    var answers = [
      ["Where", "Towns", checked("towns")],
      ["Where", "Area in mind", val("area")],
      ["The home", "Price range", price],
      ["The home", "Bedrooms", optionText("beds")],
      ["The home", "Bathrooms", optionText("baths")],
      ["The home", "Type of home", checked("type")],
      ["The home", "Must-haves and deal-breakers", val("musts")],
      ["Timing", "When they'd like to move", val("timeline")],
      ["Timing", "Pre-approved for a mortgage", radio("preapproved")],
      ["Timing", "Needs to sell a home first", radio("sellfirst")],
      ["Contact", "Name", val("name")],
      ["Contact", "Email", val("email")],
      ["Contact", "Phone", val("phone")],
      ["Contact", "Best way to reach them", radio("contact")],
    ].map(function (a) { return { section: a[0], label: a[1], value: a[2] }; });

    var button = form.querySelector("button[type=submit]");
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    fetch("/api/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lead",
        formId: "buyer-wish-list",
        formTitle: "Buyer wish list",
        answers: answers,
        replyTo: val("email"),
        _hp: form.elements.hp_check.value,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Something went wrong sending your wish list.");
        });
      })
      .then(function () {
        form.hidden = true;
        document.getElementById("fh-intro").hidden = true;
        document.getElementById("fh-done").hidden = false;
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
