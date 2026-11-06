(function () {
  "use strict";

  var SUBMIT_URL = "/api/submit-form";
  var FORMS = window.CLIENT_FORMS || [];

  // Agent details come from SITE in js/site.js.
  var AGENT = typeof SITE !== "undefined" ? SITE : { agentName: "Bill Temple" };
  var AGENT_LINE = AGENT.agentName + ", Realtor" + (AGENT.brokerage ? " \u00b7 " + AGENT.brokerage : "");

  var $ = function (id) { return document.getElementById(id); };
  document.title = "Client Forms | " + AGENT.agentName + ", Realtor";

  var sig = { canvas: null, ctx: null, drawing: false, hasInk: false, last: null };

  var params = new URLSearchParams(window.location.search);
  var formId = params.get("form");
  var current = FORMS.filter(function (f) { return f.id === formId; })[0];

  if (!current) {
    renderList();
    return;
  }
  renderForm(current);

  // ---------- List of forms ----------

  function renderList() {
    var wrap = $("form-cards");
    FORMS.forEach(function (f) {
      var a = document.createElement("a");
      a.className = "form-card";
      a.href = "forms.html?form=" + encodeURIComponent(f.id);
      var h = document.createElement("h2");
      h.textContent = f.title;
      var p = document.createElement("p");
      p.textContent = f.summary || "";
      var tag = document.createElement("span");
      tag.className = "form-card-cta";
      tag.textContent = f.requestOnly ? "Request by email →" : "Fill out and sign →";
      a.appendChild(h);
      a.appendChild(p);
      a.appendChild(tag);
      wrap.appendChild(a);
    });
  }

  // ---------- A single form ----------

  function renderForm(def) {
    document.title = def.title + " | " + AGENT.agentName + ", Realtor";
    $("form-list").hidden = true;
    $("form-view").hidden = false;
    $("form-title").textContent = def.title;
    $("form-summary").textContent = def.summary || "";

    if (def.requestOnly) {
      $("client-form").hidden = true;
      $("request-form").hidden = false;
      $("request-form").addEventListener("submit", onRequestSubmit);
      return;
    }

    var container = $("form-fields");
    (def.sections || []).forEach(function (section) {
      var fs = document.createElement("fieldset");
      fs.className = "form-section";
      var lg = document.createElement("legend");
      lg.textContent = section.heading;
      fs.appendChild(lg);
      section.fields.forEach(function (field) { fs.appendChild(buildField(field)); });
      container.appendChild(fs);
    });

    $("sig-date").textContent = new Date().toLocaleDateString();
    setupSignaturePad();
    $("client-form").addEventListener("submit", onFormSubmit);
  }

  function buildField(field) {
    var id = "f-" + field.name;
    var wrap = document.createElement("div");
    wrap.className = "field";

    if (field.type === "checkbox") {
      var lab = document.createElement("label");
      lab.className = "check";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = field.name;
      cb.id = id;
      var span = document.createElement("span");
      span.textContent = field.label;
      lab.appendChild(cb);
      lab.appendChild(span);
      wrap.appendChild(lab);
      return wrap;
    }

    if (field.type === "radio") {
      var group = document.createElement("fieldset");
      group.className = "radio-group";
      var lg = document.createElement("legend");
      lg.innerHTML = escapeHtml(field.label) + (field.required ? ' <span class="req">*</span>' : "");
      group.appendChild(lg);
      field.options.forEach(function (opt, i) {
        var l = document.createElement("label");
        l.className = "check";
        var r = document.createElement("input");
        r.type = "radio";
        r.name = field.name;
        r.value = opt;
        if (field.required && i === 0) r.required = true;
        var s = document.createElement("span");
        s.textContent = opt;
        l.appendChild(r);
        l.appendChild(s);
        group.appendChild(l);
      });
      wrap.appendChild(group);
      return wrap;
    }

    var label = document.createElement("label");
    label.htmlFor = id;
    label.innerHTML = escapeHtml(field.label) + (field.required ? ' <span class="req">*</span>' : "");
    wrap.appendChild(label);

    var input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 4;
    } else if (field.type === "select") {
      input = document.createElement("select");
      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Choose one";
      input.appendChild(blank);
      field.options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      if (field.type === "number") { input.min = "0"; input.inputMode = "numeric"; }
    }
    input.id = id;
    input.name = field.name;
    if (field.required) input.required = true;
    if (field.autocomplete) input.autocomplete = field.autocomplete;
    wrap.appendChild(input);
    return wrap;
  }

  // Collect answers as [{label, value}] in the same order as the form.
  function collectAnswers(def, formEl) {
    var answers = [];
    def.sections.forEach(function (section) {
      section.fields.forEach(function (field) {
        var value;
        if (field.type === "checkbox") {
          value = formEl.elements[field.name].checked ? "Yes" : "No";
        } else if (field.type === "radio") {
          var checked = formEl.querySelector('input[name="' + field.name + '"]:checked');
          value = checked ? checked.value : "";
        } else {
          value = formEl.elements[field.name].value.trim();
        }
        answers.push({ section: section.heading, label: field.label, value: value });
      });
    });
    return answers;
  }

  // ---------- Signature pad ----------

  function setupSignaturePad() {
    var canvas = $("sig-pad");
    sig.canvas = canvas;
    sig.ctx = canvas.getContext("2d");

    function resize() {
      // Resizing clears the canvas, so keep what was drawn.
      var saved = sig.hasInk ? canvas.toDataURL() : null;
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      sig.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      sig.ctx.lineWidth = 2.2;
      sig.ctx.lineCap = "round";
      sig.ctx.lineJoin = "round";
      sig.ctx.strokeStyle = "#111";
      if (saved) {
        var img = new Image();
        img.onload = function () { sig.ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = saved;
      }
    }
    resize();
    window.addEventListener("resize", resize);

    function point(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      sig.drawing = true;
      sig.last = point(e);
      sig.ctx.beginPath();
      sig.ctx.arc(sig.last.x, sig.last.y, 1, 0, Math.PI * 2);
      sig.ctx.fillStyle = "#111";
      sig.ctx.fill();
      sig.hasInk = true;
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!sig.drawing) return;
      e.preventDefault();
      var p = point(e);
      sig.ctx.beginPath();
      sig.ctx.moveTo(sig.last.x, sig.last.y);
      sig.ctx.lineTo(p.x, p.y);
      sig.ctx.stroke();
      sig.last = p;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      canvas.addEventListener(ev, function () { sig.drawing = false; });
    });
    $("sig-clear").addEventListener("click", function () {
      sig.ctx.clearRect(0, 0, canvas.width, canvas.height);
      sig.hasInk = false;
    });
  }

  // Signature as a PNG on a white background (so it shows up in the PDF).
  function signaturePng() {
    var c = document.createElement("canvas");
    c.width = sig.canvas.width;
    c.height = sig.canvas.height;
    var x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(sig.canvas, 0, 0);
    return c.toDataURL("image/png");
  }

  // ---------- PDF ----------

  function buildPdf(def, answers, signerName, signedAt, sigPng) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) return null;
    var doc = new jsPDF({ unit: "pt", format: "letter" });
    var margin = 54, width = doc.internal.pageSize.getWidth() - margin * 2;
    var pageH = doc.internal.pageSize.getHeight();
    var y = margin;

    function ensure(h) { if (y + h > pageH - margin) { doc.addPage(); y = margin; } }

    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text(def.title, margin, y); y += 22;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
    doc.text(AGENT_LINE, margin, y); y += 24;
    doc.setTextColor(0);

    var lastSection = null;
    answers.forEach(function (a) {
      if (a.section !== lastSection) {
        ensure(30);
        y += 6;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(a.section, margin, y); y += 16;
        lastSection = a.section;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      var labelLines = doc.splitTextToSize(a.label, width);
      doc.setFont("helvetica", "normal");
      var valLines = doc.splitTextToSize(a.value || "—", width - 12);
      ensure(labelLines.length * 12 + valLines.length * 13 + 8);
      doc.setFont("helvetica", "bold"); doc.text(labelLines, margin, y); y += labelLines.length * 12;
      doc.setFont("helvetica", "normal"); doc.text(valLines, margin + 12, y); y += valLines.length * 13 + 8;
    });

    ensure(170);
    y += 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Signature", margin, y); y += 10;
    var sigW = 240, sigH = sigW * (sig.canvas.height / sig.canvas.width);
    doc.addImage(sigPng, "PNG", margin, y, sigW, sigH); y += sigH + 4;
    doc.setDrawColor(150); doc.line(margin, y, margin + sigW, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("Signed by: " + signerName, margin, y); y += 13;
    doc.text("Date and time: " + signedAt.toLocaleString(), margin, y); y += 13;
    var consent = doc.splitTextToSize("The signer agreed to sign electronically and that their electronic signature has the same effect as a handwritten one.", width);
    doc.setTextColor(90); doc.text(consent, margin, y);
    return doc;
  }

  // ---------- Submitting ----------

  function showError(el, msg) { el.textContent = msg; el.hidden = !msg; }

  function onFormSubmit(e) {
    e.preventDefault();
    var formEl = e.target;
    var errEl = $("form-error");
    showError(errEl, "");

    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      showError(errEl, "Please fill in the required fields marked with *.");
      return;
    }
    if (!sig.hasInk) {
      showError(errEl, "Please draw your signature in the box.");
      sig.canvas.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    var answers = collectAnswers(current, formEl);
    var signerName = $("signer-name").value.trim();
    var signedAt = new Date();
    var sigPng = signaturePng();
    var pdf = buildPdf(current, answers, signerName, signedAt, sigPng);
    var pdfBase64 = pdf ? pdf.output("datauristring").split(",")[1] : null;
    var emailField = formEl.elements.email;

    var payload = {
      kind: "signed",
      formId: current.id,
      formTitle: current.title,
      answers: answers,
      replyTo: emailField ? emailField.value.trim() : "",
      signerName: signerName,
      signedAt: signedAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      esignConsent: $("esign-consent").checked,
      pdfBase64: pdfBase64,
      _company: formEl.elements._company.value,
    };

    send(payload, $("submit-btn"), errEl, function () {
      if (pdf) {
        var btn = $("download-copy");
        btn.hidden = false;
        btn.addEventListener("click", function () {
          pdf.save(current.id + "-signed-" + signedAt.toISOString().slice(0, 10) + ".pdf");
        });
      }
    });
  }

  function onRequestSubmit(e) {
    e.preventDefault();
    var formEl = e.target;
    var errEl = $("request-error");
    showError(errEl, "");
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      showError(errEl, "Please fill in your name and email.");
      return;
    }
    var payload = {
      kind: "request",
      formId: current.id,
      formTitle: current.title,
      answers: [
        { section: "Request", label: "Full name", value: formEl.elements.full_name.value.trim() },
        { section: "Request", label: "Email", value: formEl.elements.email.value.trim() },
        { section: "Request", label: "Phone", value: formEl.elements.phone.value.trim() },
        { section: "Request", label: "Notes", value: formEl.elements.notes.value.trim() },
      ],
      replyTo: formEl.elements.email.value.trim(),
      _company: formEl.elements._company.value,
    };
    $("done-message").textContent = "Thanks! I'll email you the " + current.title + " to sign electronically.";
    send(payload, formEl.querySelector("button[type=submit]"), errEl);
  }

  function send(payload, button, errEl, onDone) {
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";
    fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Something went wrong sending your form.");
        });
      })
      .then(function () {
        $("client-form").hidden = true;
        $("request-form").hidden = true;
        $("form-done").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (onDone) onDone();
      })
      .catch(function (err) {
        showError(errEl, err.message + " Please try again, or call or email me directly.");
        button.disabled = false;
        button.textContent = label;
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
