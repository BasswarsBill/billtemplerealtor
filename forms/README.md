# Client forms

Clients open **forms.html**, pick a form, fill it in, sign with a finger or mouse, and send it.
Bill gets an email with every answer and the signed PDF attached, and the client can download
their own signed copy.

## Files

- `forms.html` – the page (list of forms, and each form when you open it).
- `forms/forms-data.js` – **the list of forms and their questions.** Edit this to add or change a form.
- `forms/forms.js` – draws the form, the signature pad, makes the PDF, and sends it.
- `forms/forms.css` – styles for the forms page.
- `forms/vendor/jspdf.umd.min.js` – the PDF library (jsPDF 2.5.1, MIT license), kept here so the page doesn't depend on another website.
- `api/submit-form.js` – runs on Vercel and emails the submission to Bill.

## Two kinds of forms

1. **Fill out and sign on the site** – questionnaires and intake forms.
2. **Request only** (`requestOnly: true`) – official association contracts such as the buyer
   representation agreement. The client asks for it, and Bill sends it from his e-signature tool
   (DocuSign, Dotloop, zipForm, etc.), which keeps the official form and its audit trail intact.

## Turning on email (one-time, in Vercel)

1. Make a free account at [resend.com](https://resend.com) and verify Bill's domain there
   (Resend shows the DNS records to add).
2. Create an API key in Resend.
3. In Vercel, open the project, then **Settings → Environment Variables**, and add:
   - `RESEND_API_KEY` – the key from step 2
   - `FORMS_TO_EMAIL` – where forms should go: `billtemplerealtor@gmail.com` (several addresses can be separated with commas)
   - `FORMS_FROM_EMAIL` – the sender, on the verified domain, e.g. `Website Forms <forms@yourdomain.com>`
4. Redeploy. Until these are set, the form shows the client a friendly "couldn't send" message.

## What's recorded with each signature

Typed legal name, drawn signature, the client's agreement to sign electronically, date and time,
time zone, IP address, and browser. These are listed at the bottom of each email.
