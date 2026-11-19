// "Ask Bill" question form at the end of the buyer and seller guides (built by scripts/build-guides.mjs)
// and the Investor Corner (scripts/build-investors.mjs). The form can set data-form-id and data-form-title,
// and any extra field with a data-ask-label attribute is sent along too.
// Sends the question to Bill through the same email function as the other forms (api/submit-form.js).
(function () {
  var form = document.getElementById("ask-form");
  if (!form) return;
  var errEl = document.getElementById("ask-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var missing = ["name", "email", "message"].filter(function (n) { return !form.elements[n].value.trim(); });
    if (missing.length) return showError("Please fill in your name, email and question.", form.elements[missing[0]]);
    if (!form.elements.email.checkValidity()) return showError("Please check your email address.", form.elements.email);

    var topic = form.getAttribute("data-topic") || "Guides";
    var answers = [
      ["Question", "Page they were reading", topic + " (" + location.pathname + ")"],
      ["Question", "Their question", form.elements.message.value],
      ["Contact", "Name", form.elements.name.value],
      ["Contact", "Email", form.elements.email.value],
      ["Contact", "Phone", form.elements.phone.value],
    ];
    Array.prototype.forEach.call(form.querySelectorAll("[data-ask-label]"), function (el) {
      if (el.value.trim()) answers.splice(answers.length - 3, 0, ["Question", el.getAttribute("data-ask-label"), el.value]);
    });
    answers = answers.map(function (a) { return { section: a[0], label: a[1], value: String(a[2] || "").trim() }; });

    var button = form.querySelector("button[type=submit]");
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    fetch("/api/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lead",
        formId: form.getAttribute("data-form-id") || "guide-question",
        formTitle: form.getAttribute("data-form-title") || "Question from the " + topic.toLowerCase(),
        answers: answers,
        replyTo: form.elements.email.value.trim(),
        _hp: form.elements.hp_check.value,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Something went wrong sending your question.");
        });
      })
      .then(function () {
        form.hidden = true;
        var done = document.getElementById("ask-done");
        done.hidden = false;
        done.setAttribute("tabindex", "-1");
        done.focus();
      })
      .catch(function (err) {
        var phone = (typeof SITE !== "undefined" && SITE.phone) || "(601) 953-6504";
        showError(err.message + " Please try again, or call or text me at " + phone + ".");
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
