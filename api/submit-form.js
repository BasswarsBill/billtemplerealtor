// Vercel serverless function: receives a client form from forms.html and
// emails it to Bill, with the signed PDF attached.
//
// Settings (add in Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY     API key from https://resend.com (free plan is plenty)
//   FORMS_TO_EMAIL     where submissions go, e.g. bill@example.com
//   FORMS_FROM_EMAIL   sender on a domain verified in Resend,
//                      e.g. "Website Forms <forms@yourdomain.com>"

const MAX_ANSWERS = 150;
const MAX_TEXT = 5000;
const MAX_PDF_BASE64 = 3 * 1024 * 1024; // about 2.2 MB of PDF

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { RESEND_API_KEY, FORMS_TO_EMAIL, FORMS_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !FORMS_TO_EMAIL || !FORMS_FROM_EMAIL) {
    console.error("submit-form: email settings are missing");
    return res.status(500).json({ error: "The form isn't set up to send yet." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "We couldn't read your form." });
  }

  // Spam bots fill in the hidden field. Pretend it worked and drop it.
  // (The field has a nonsense name so browser autofill leaves it alone.)
  if (body._hp) {
    console.warn("submit-form: hidden spam-trap field was filled; dropped");
    return res.status(200).json({ ok: true });
  }

  const kind = body.kind === "request" ? "request" : body.kind === "signed" ? "signed" : null;
  const formTitle = clean(body.formTitle, 200);
  const formId = clean(body.formId, 100).replace(/[^a-z0-9-]/gi, "");
  if (!kind || !formTitle || !formId || !Array.isArray(body.answers)) {
    return res.status(400).json({ error: "Your form was missing some information." });
  }
  if (body.answers.length > MAX_ANSWERS) {
    return res.status(400).json({ error: "Your form has too many answers." });
  }
  const answers = body.answers.map((a) => ({
    section: clean(a && a.section, 200),
    label: clean(a && a.label, 300),
    value: clean(a && a.value, MAX_TEXT),
  }));

  let signerName = "";
  let attachments = [];
  if (kind === "signed") {
    signerName = clean(body.signerName, 200);
    if (!signerName || body.esignConsent !== true) {
      return res.status(400).json({ error: "Please type your name and agree to sign electronically." });
    }
    const pdf = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
    if (pdf) {
      if (pdf.length > MAX_PDF_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) {
        return res.status(400).json({ error: "The signed copy was too large." });
      }
      const date = new Date().toISOString().slice(0, 10);
      attachments.push({ filename: `${formId}-${slug(signerName)}-${date}.pdf`, content: pdf });
    }
  }

  const replyTo = isEmail(body.replyTo) ? body.replyTo.trim() : undefined;
  const audit = [
    ["Received", new Date().toISOString() + " (UTC)"],
    ["Signed at (client clock)", clean(body.signedAt, 50)],
    ["Client time zone", clean(body.timezone, 80)],
    ["IP address", clean(String(req.headers["x-forwarded-for"] || "").split(",")[0], 60)],
    ["Browser", clean(req.headers["user-agent"], 300)],
  ];

  const who = signerName || (answers.find((a) => /name/i.test(a.label)) || {}).value || "a client";
  const subject = (kind === "request" ? `Form request: ${formTitle} from ${who}` : `Signed form: ${formTitle} from ${who}`)
    .replace(/[\r\n]+/g, " ")
    .slice(0, 250);

  const html = renderEmail({ kind, formTitle, answers, signerName, audit });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FORMS_FROM_EMAIL,
        to: FORMS_TO_EMAIL.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: replyTo,
        subject,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    });
    if (!r.ok) {
      console.error("submit-form: Resend error", r.status, await r.text());
      return res.status(502).json({ error: "We couldn't send your form right now." });
    }
  } catch (err) {
    console.error("submit-form: send failed", err);
    return res.status(502).json({ error: "We couldn't send your form right now." });
  }

  return res.status(200).json({ ok: true });
};

function clean(v, max) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function isEmail(v) {
  return typeof v === "string" && v.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(v.trim());
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderEmail({ kind, formTitle, answers, signerName, audit }) {
  const rows = [];
  let lastSection = null;
  for (const a of answers) {
    if (a.section && a.section !== lastSection) {
      rows.push(`<tr><td colspan="2" style="padding:14px 0 4px;font-weight:bold;font-size:15px;border-bottom:1px solid #ddd">${esc(a.section)}</td></tr>`);
      lastSection = a.section;
    }
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555;width:40%">${esc(a.label)}</td>` +
        `<td style="padding:6px 0;vertical-align:top;white-space:pre-wrap">${esc(a.value || "—")}</td></tr>`
    );
  }
  const auditRows = audit
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#777">${esc(k)}</td><td style="padding:2px 0;color:#777">${esc(v)}</td></tr>`)
    .join("");

  const intro =
    kind === "request"
      ? `<p>Someone asked you to send them the <b>${esc(formTitle)}</b> to sign. Reply to this email to reach them.</p>`
      : `<p><b>${esc(signerName)}</b> filled out and signed the <b>${esc(formTitle)}</b>. The signed PDF is attached. Reply to this email to reach them.</p>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px">
<h2 style="margin:0 0 8px">${esc(formTitle)}</h2>
${intro}
<table style="border-collapse:collapse;width:100%">${rows.join("")}</table>
${kind === "signed" ? `<p style="margin-top:18px">Signed electronically by <b>${esc(signerName)}</b>, who agreed to sign electronically.</p>` : ""}
<h3 style="margin:24px 0 4px;font-size:13px;color:#777">Record details</h3>
<table style="border-collapse:collapse;font-size:12px">${auditRows}</table>
</div>`;
}
