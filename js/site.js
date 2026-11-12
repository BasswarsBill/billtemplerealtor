// Shared header and footer for every page.
// Usage: put <div id="site-header"></div> and <div id="site-footer"></div> in a page,
// then load this script. Edit agent details in SITE below.
const SITE = {
  agentName: "Bill Temple",
  // Brokerage: if Bill changes brokerages, update these lines and replace media/brokerage-logo.png
  // (a white or light logo on a transparent background works best on the black footer).
  brokerage: "Epique Realty",
  brokerageLogo: "media/brokerage-logo.png",
  brokerageAddress: "520 Pass Rd, Ste L, Gulfport, MS 39507",
  officePhone: "(888) 893-3537",
  phone: "(601) 953-6504", // Bill's cell
  email: "billtemplerealtor@gmail.com",
  license: "61942", // Mississippi license number
};

(function () {
  const path = location.pathname.split("/").pop() || "index.html";
  const links = [
    ["index.html", "Home"],
    ["index.html#about", "Meet Bill"],
    ["listings.html", "Homes for Sale"],
    ["forms.html", "Forms"],
    ["index.html#contact", "Contact"],
  ];
  const nav = links
    .map(([href, label]) => {
      const current = href === path ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    })
    .join("");

  const header = document.getElementById("site-header");
  if (header) {
    header.outerHTML = `
      <header class="site-header">
        <div class="container">
          <a class="logo" href="index.html">${SITE.agentName} <span>Realtor</span></a>
          <nav class="nav">${nav}</nav>
        </div>
      </header>`;
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer">
        <div class="container">
          ${SITE.brokerageLogo ? `<img class="brokerage-logo" src="${SITE.brokerageLogo}" alt="${SITE.brokerage}">` : ""}
          <div>${SITE.agentName}, Realtor · MS License #${SITE.license} · Cell <a href="tel:${SITE.phone.replace(/[^0-9+]/g, "")}">${SITE.phone}</a> · <a href="mailto:${SITE.email}">${SITE.email}</a></div>
          <div>${SITE.brokerage} · ${SITE.brokerageAddress} · Office <a href="tel:${SITE.officePhone.replace(/[^0-9+]/g, "")}">${SITE.officePhone}</a></div>
          <p class="mls-disclaimer">Listing information is deemed reliable but not guaranteed. <span class="sample-only">Listings shown are currently sample data until the MLS feed is connected.</span> Listing data provided courtesy of the Mississippi Gulf Coast MLS (final required disclaimer to be confirmed with the MLS).</p>
          <div>© ${new Date().getFullYear()} ${SITE.agentName}</div>
        </div>
      </footer>`;
  }
})();
