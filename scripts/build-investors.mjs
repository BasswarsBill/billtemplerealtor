// Builds the Investor Corner from data/investors.json:
//   investors.html             the investor page (sections, deal calculator, rents by town, Ask Bill form)
//   data/investors-posts.json  every section's ready-made Facebook post, with a link to that section
//
// Edit the words in data/investors.json, not the page. Two numbers come from the other data files:
// this week's mortgage rate (data/market.json) and rents and home values by town (data/neighborhoods.json).
// Runs automatically from GitHub (.github/workflows/build-investors.yml) whenever data/investors.json
// changes, and every Thursday after the market and neighborhood updates.
// Run by hand with:  node scripts/build-investors.mjs

import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const file = (p) => new URL(p, ROOT);
const SITE_URL = "https://www.billtemplerealtor.com";
const PAGE = "investors.html";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const isExternal = (href) => /^https?:/.test(href);
const linkTag = (l) =>
  `<a href="${esc(l.href)}"${isExternal(l.href) ? ' rel="noopener" target="_blank"' : ""}>${esc(l.label)}${isExternal(l.href) ? ' <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>' : ""}</a>`;
const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

async function readJson(p, fallback) {
  try { return JSON.parse(await readFile(file(p), "utf8")); } catch { return fallback; }
}

function sectionHtml(s, i) {
  const parts = [`          <p class="guide-summary">${esc(s.summary)}</p>`];
  for (const p of s.body) parts.push(`          <p>${esc(p)}</p>`);
  if (s.terms?.length) {
    parts.push(`          <dl class="inv-terms">
${s.terms.map((t) => `            <div>
              <dt>${esc(t.term)}</dt>
              <dd><span class="inv-formula">${esc(t.formula)}</span><span class="inv-example">${esc(t.example)}</span></dd>
            </div>`).join("\n")}
          </dl>`);
  }
  if (s.checklist?.length) parts.push(`          <ul class="guide-check">\n${s.checklist.map((c) => `            <li>${esc(c)}</li>`).join("\n")}\n          </ul>`);
  if (s.local) parts.push(`          <aside class="guide-local"><p class="eyebrow">On the Coast</p><p>${esc(s.local)}</p></aside>`);
  if (s.links?.length) parts.push(`          <p class="guide-links">${s.links.map(linkTag).join("")}</p>`);
  return `        <article class="guide-step" id="${esc(s.id)}">
          <span class="guide-num" aria-hidden="true">${pad(i + 1)}</span>
          <h2>${esc(s.title)}</h2>
${parts.join("\n")}
        </article>`;
}

// One number input. `unit` shows before ($) or after (%, mo) the box.
function input(id, label, value, { pre = "", post = "", step = "any", help = "" } = {}) {
  return `<label class="calc-field" for="${id}"><span>${esc(label)}</span><span class="calc-box">${pre ? `<i>${pre}</i>` : ""}<input type="number" inputmode="decimal" min="0" step="${step}" id="${id}" name="${id}" value="${value}">${post ? `<i>${post}</i>` : ""}</span>${help ? `<small>${esc(help)}</small>` : ""}</label>`;
}

function calculatorHtml(c, rate) {
  return `
    <section class="alt calc-section" id="calculator">
      <div class="container">
        <p class="eyebrow">Run the numbers</p>
        <h2>${esc(c.heading)}</h2>
        <p class="town-text">${esc(c.lede)}</p>

        <div class="calc" id="deal-calc">
          <div class="calc-tabs" role="tablist" aria-label="Type of investment">
            <button type="button" role="tab" id="tab-ltr" aria-selected="true" aria-controls="calc-panel" data-mode="ltr">Long-term rental</button>
            <button type="button" role="tab" id="tab-str" aria-selected="false" aria-controls="calc-panel" data-mode="str" tabindex="-1">Vacation rental</button>
            <button type="button" role="tab" id="tab-flip" aria-selected="false" aria-controls="calc-panel" data-mode="flip" tabindex="-1">Fix and flip</button>
          </div>

          <form class="calc-body" id="calc-panel" role="tabpanel" aria-labelledby="tab-ltr" novalidate>
            <div class="calc-inputs">
              <fieldset data-show="ltr str">
                <legend>The property</legend>
                ${input("c-price", "Purchase price", 150000, { pre: "$", step: "1000" })}
                ${input("c-rehab", "Repairs and updates", 3000, { pre: "$", step: "500" })}
                ${input("c-closing", "Closing costs to buy", 3, { post: "%", step: "0.5", help: "Of the price. Often 2% to 4%." })}
              </fieldset>

              <fieldset data-show="flip">
                <legend>The flip</legend>
                ${input("f-arv", "After-repair value (ARV)", 240000, { pre: "$", step: "1000", help: "What it should sell for once fixed, from recent sales." })}
                ${input("f-price", "Purchase price", 125000, { pre: "$", step: "1000" })}
                ${input("f-rehab", "Repairs", 40000, { pre: "$", step: "500", help: "Add a cushion. Repairs usually run over." })}
                ${input("f-closing", "Closing costs to buy", 3, { post: "%", step: "0.5", help: "Of the price." })}
              </fieldset>

              <fieldset data-show="ltr str">
                <legend>The loan</legend>
                ${input("c-down", "Down payment", 25, { post: "%", step: "1" })}
                ${input("c-rate", "Interest rate", rate, { post: "%", step: "0.125" })}
                ${input("c-term", "Loan length", 30, { post: "years", step: "1" })}
              </fieldset>

              <fieldset data-show="ltr">
                <legend>Rent</legend>
                ${input("c-rent", "Monthly rent", 1650, { pre: "$", step: "25" })}
                ${input("c-vacancy", "Vacancy", 6, { post: "%", step: "1", help: "Share of the year it sits empty." })}
                ${input("c-mgmt", "Property management", 8, { post: "%", step: "1", help: "Of rent collected. Use 0 if you'll manage it." })}
              </fieldset>

              <fieldset data-show="str">
                <legend>Bookings</legend>
                ${input("c-nightly", "Average nightly rate", 175, { pre: "$", step: "5" })}
                ${input("c-occ", "Occupancy over the year", 55, { post: "%", step: "1", help: "Average across busy and slow months." })}
                ${input("c-strmgmt", "Management and platform fees", 25, { post: "%", step: "1", help: "Of booking income." })}
                ${input("c-strmonthly", "Cleaning, utilities, internet, supplies", 650, { pre: "$", post: "/mo", step: "25" })}
                ${input("c-furnish", "Furniture and setup", 15000, { pre: "$", step: "500" })}
              </fieldset>

              <fieldset data-show="ltr str">
                <legend>Yearly costs</legend>
                ${input("c-tax", "Property taxes", 2400, { pre: "$", post: "/yr", step: "50", help: "At the rental (non-homestead) rate." })}
                ${input("c-ins", "Homeowners and wind insurance", 3000, { pre: "$", post: "/yr", step: "50" })}
                ${input("c-flood", "Flood insurance", 0, { pre: "$", post: "/yr", step: "50", help: "Required in high-risk zones with most loans." })}
                ${input("c-hoa", "HOA dues", 0, { pre: "$", post: "/mo", step: "10" })}
                ${input("c-maint", "Repairs and maintenance", 5, { post: "%", step: "1", help: "Of rent, for everyday repairs." })}
                ${input("c-capex", "Big-ticket savings (roof, AC)", 5, { post: "%", step: "1", help: "Of rent, set aside each month." })}
              </fieldset>

              <fieldset data-show="flip">
                <legend>Holding and selling</legend>
                ${input("c-months", "Months from purchase to sale", 6, { post: "months", step: "1" })}
                ${input("c-hold", "Holding costs per month", 1500, { pre: "$", post: "/mo", step: "50", help: "Loan interest, taxes, insurance, utilities." })}
                ${input("c-sell", "Costs to sell", 8, { post: "%", step: "0.5", help: "Of the sale price: commission and closing costs." })}
              </fieldset>
            </div>

            <div class="calc-results" aria-live="polite">
              <div class="calc-headline">
                <span id="r-head-label">Monthly cash flow</span>
                <strong id="r-head">$0</strong>
                <em id="r-head-note"></em>
              </div>
              <dl class="calc-list" id="r-list"></dl>
              <ul class="calc-flags" id="r-flags"></ul>
              <div class="calc-actions">
                <a class="btn" href="${PAGE}#ask" id="calc-send">Send these numbers to Bill</a>
                <button class="btn secondary" type="reset">Start over</button>
              </div>
              <p class="calc-note"><span data-show="ltr str">${esc(c.rateNote)} </span>These are estimates for comparing properties, not a promise of any return.</p>
            </div>
          </form>
        </div>
      </div>
    </section>`;
}

function townsHtml(t, hoods) {
  const census = hoods?.census?.towns || {};
  const rows = (hoods?.towns || [])
    .map((town) => ({ town, c: census[town.slug] }))
    .filter(({ c }) => c?.medianRent && c?.medianHomeValue);
  if (!rows.length) return "";
  const body = rows.map(({ town, c }) => {
    const ratio = (c.medianRent / c.medianHomeValue) * 100;
    return `              <tr><th scope="row"><a href="neighborhoods/${esc(town.slug)}.html">${esc(town.name)}</a></th><td>${money(c.medianHomeValue)}</td><td>${money(c.medianRent)}</td><td>${ratio.toFixed(2)}%</td><td>${c.ownerShare != null ? `${100 - c.ownerShare}%` : "–"}</td></tr>`;
  }).join("\n");
  const survey = hoods.census.survey ? `Source: U.S. Census Bureau, ${esc(hoods.census.survey)}.` : "Source: U.S. Census Bureau.";
  return `
    <section id="rents-by-town">
      <div class="container">
        <p class="eyebrow">By town</p>
        <h2>${esc(t.heading)}</h2>
        <p class="town-text">${esc(t.lede)}</p>
        <div class="table-wrap">
          <table class="mk-table inv-towns">
            <caption class="sr-only">Typical home value, typical rent, monthly rent as a share of value, and share of homes rented, by town</caption>
            <thead><tr><th scope="col">Town</th><th scope="col">Typical home value</th><th scope="col">Typical rent</th><th scope="col">Rent ÷ value (monthly)</th><th scope="col">Homes rented</th></tr></thead>
            <tbody>
${body}
            </tbody>
          </table>
        </div>
        <p class="market-updated">${survey} Typical means the median. The 1% rule looks for 1.00% or more on a specific property.</p>
      </div>
    </section>`;
}

function related() {
  const cards = [
    ["market.html", "Updated weekly", "Gulf Coast market update", "Prices, homes for sale, days on market and mortgage rates, by county."],
    ["neighborhoods.html", "Seven towns", "Neighborhood guides", "Typical prices, rents, schools and commutes from Bay St. Louis to Ocean Springs."],
    ["listings.html", "Search", "Homes for sale", "Browse homes for sale on the Mississippi Gulf Coast."],
    ["guides/buying.html", "Buyer guide", "Buying on the Gulf Coast", "Budget, insurance quotes, offers, inspections and closing."],
  ];
  return `
    <section class="alt">
      <div class="container">
        <p class="eyebrow">Keep going</p>
        <h2>More tools for investors</h2>
        <div class="form-links guide-related">
${cards.map(([href, tag, title, text]) => `          <a href="${href}"><b>${esc(tag)}</b><strong>${esc(title)}</strong><span>${esc(text)}</span></a>`).join("\n")}
        </div>
      </div>
    </section>`;
}

const select = (id, label, options) =>
  `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" name="${id}" data-ask-label="${esc(label)}"><option value="">Choose one</option>${options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></div>`;

function contact() {
  return `
    <section id="ask">
      <div class="container connect">
        <div>
          <p class="eyebrow">Have a deal in mind?</p>
          <h2>Ask Bill about an investment</h2>
          <p class="town-text">Send me a property you're looking at, numbers from the calculator, or just what you're hoping to buy. I'll get back to you, usually the same day.</p>
          <ul class="ask-ways">
            <li><span>Call or text</span><a data-site-link="phone" href="tel:6019536504">(601) 953-6504</a></li>
            <li><span>Email</span><a data-site-link="email" href="mailto:bill@billtemplerealtor.com">bill@billtemplerealtor.com</a></li>
          </ul>
        </div>
        <div>
          <form id="ask-form" class="ask-form" novalidate data-topic="Investor corner" data-form-id="investor-question" data-form-title="Investment question">
            <div class="field"><label for="ask-name">Name <span class="req">*</span></label><input type="text" id="ask-name" name="name" autocomplete="name" required></div>
            <div class="hv-row">
              <div class="field"><label for="ask-email">Email <span class="req">*</span></label><input type="email" id="ask-email" name="email" autocomplete="email" required></div>
              <div class="field"><label for="ask-phone">Phone</label><input type="tel" id="ask-phone" name="phone" autocomplete="tel"></div>
            </div>
            <div class="hv-row">
              ${select("ask-type", "What kind of investment", ["Long-term rental", "Vacation or short-term rental", "Fix and flip", "Duplex or small multifamily", "Not sure yet"])}
              ${select("ask-budget", "Budget", ["Under $150,000", "$150,000 to $250,000", "$250,000 to $400,000", "Over $400,000", "Not sure yet"])}
            </div>
            <div class="field"><label for="ask-message">Your question or the property address <span class="req">*</span></label><textarea id="ask-message" name="message" rows="5" required></textarea></div>
            <input type="hidden" name="deal" id="ask-deal" data-ask-label="Deal calculator numbers">
            <p id="ask-deal-note" class="ask-deal-note" hidden>Your calculator numbers will be sent along with your question.</p>
            <div class="hp" aria-hidden="true"><input type="text" name="hp_check" tabindex="-1" autocomplete="off"></div>
            <p id="ask-error" class="form-error" role="alert" hidden></p>
            <div class="form-actions"><button class="btn" type="submit">Send to Bill</button></div>
          </form>
          <div id="ask-done" class="ask-done" role="status" hidden>
            <h3>Thanks, it's on its way.</h3>
            <p>I'll get back to you soon. If it's time-sensitive, call or text me at <a data-site-link="phone" href="tel:6019536504">(601) 953-6504</a>.</p>
          </div>
        </div>
      </div>
    </section>`;
}

function page(data, rate, hoods) {
  const p = data.page;
  const toc = [
    ...data.sections.map((s, i) => [s.id, pad(i + 1), s.title]),
    ["calculator", "→", data.calculator.heading],
    ...(hoods ? [["rents-by-town", "→", data.towns.heading]] : []),
    ["ask", "→", "Ask Bill about an investment"],
  ].map(([id, n, t]) => `            <li><a href="${PAGE}#${esc(id)}"><span>${n}</span>${esc(t)}</a></li>`).join("\n");
  return `<!doctype html>
<!-- Built by scripts/build-investors.mjs. Do not edit this file: change data/investors.json instead. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="/">
  <title>${esc(p.title)} | Bill Temple, REALTOR®</title>
  <meta name="description" content="${esc(p.description)}">
  <link rel="canonical" href="${SITE_URL}/${PAGE}">
  <meta property="og:title" content="${esc(p.title)} | Bill Temple, REALTOR®">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${SITE_URL}/${PAGE}">
  <meta property="og:site_name" content="Bill Temple, REALTOR®">
  <meta property="og:image" content="${SITE_URL}/media/hero-poster.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="forms/forms.css">
</head>
<body>
  <div id="site-header"></div>

  <main class="market guide investors">
    <section class="market-top">
      <div class="container">
        <p class="eyebrow">${esc(p.eyebrow)}</p>
        <h1>${esc(p.heading)}</h1>
        <p class="market-lede">${esc(p.lede)}</p>
        <blockquote class="guide-take"><p>${esc(p.billsTake)}</p><footer>Bill Temple, REALTOR® and investor</footer></blockquote>
        <div class="actions"><a class="btn" href="${PAGE}#calculator">Run the numbers</a><a class="btn secondary" href="${PAGE}#ask">Ask Bill about a deal</a></div>
      </div>
    </section>

    <div class="container guide-layout">
      <nav class="guide-toc" aria-label="On this page">
        <p class="eyebrow">On this page</p>
        <ol>
${toc}
        </ol>
      </nav>
      <div class="guide-steps">
${data.sections.map(sectionHtml).join("\n")}
      </div>
    </div>
${calculatorHtml(data.calculator, rate)}
${townsHtml(data.towns, hoods)}
${related()}
${contact()}
    <section>
      <div class="container">
        <div class="market-sources guide-fine">
          <p class="hv-fine">This page is general education about real estate investing on the Mississippi Gulf Coast, last reviewed ${longDate(data.reviewed)}. It is not investment, legal, tax, lending or insurance advice, and nothing here is a promise or prediction of any return. Every property and every investor's situation is different, and real estate can lose money. Rules on short-term rentals, flood zones, taxes and insurance change, so confirm them with the city or county, a licensed insurance agent, a lender, a tax professional or an attorney before you buy.</p>
          <p class="fair-housing"><span data-site="agentName">Bill Temple</span> and <span data-site="brokerage">his brokerage</span> are committed to equal housing opportunity. Every buyer is welcome to look at homes anywhere, and rental owners must follow fair housing laws when choosing tenants.</p>
        </div>
      </div>
    </section>
  </main>

  <div id="site-footer"></div>
  <script src="js/site.js"></script>
  <script src="js/guide-question.js"></script>
  <script src="js/deal-calculator.js"></script>
</body>
</html>
`;
}

function posts(data) {
  return {
    _readme: "Built by scripts/build-investors.mjs from data/investors.json. One ready-made Facebook post per Investor Corner section.",
    reviewed: data.reviewed,
    posts: data.sections.map((s, i) => ({
      id: `investors-${s.id}`,
      section: i + 1,
      title: s.title,
      url: `${SITE_URL}/${PAGE}#${s.id}`,
      socialPost: `${s.socialPost}\n\nMore in my Investor Corner: ${SITE_URL}/${PAGE}#${s.id}`,
    })),
  };
}

const data = JSON.parse(await readFile(file("data/investors.json"), "utf8"));
for (const s of data.sections) {
  if (!s.id || !s.title || !s.summary || !Array.isArray(s.body) || !s.socialPost) {
    throw new Error(`Section "${s.id || s.title}" needs id, title, summary, body and socialPost`);
  }
}
const market = await readJson("data/market.json", null);
const hoods = await readJson("data/neighborhoods.json", null);
// Investor loans usually run a bit above the average owner-occupied rate. Round to the nearest 1/8 point.
const base = market?.rates?.thirtyYear;
const rate = base ? Math.round((base + 0.75) * 8) / 8 : 7.75;

await writeFile(file(PAGE), page(data, rate, hoods));
await writeFile(file("data/investors-posts.json"), JSON.stringify(posts(data), null, 2) + "\n");
console.log(`Built ${PAGE} (starting rate ${rate}%) and data/investors-posts.json`);
