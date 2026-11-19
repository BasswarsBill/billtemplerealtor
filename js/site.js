// Shared header and footer for every page.
// Usage: put <div id="site-header"></div> and <div id="site-footer"></div> in a page,
// then load this script. Edit agent details in SITE below.
const SITE = {
  agentName: "Bill Temple",
  // Brokerage: if Bill changes brokerages, update these lines and replace media/brokerage-logo.png
  // (a white or light logo on a transparent background works best on the black footer).
  brokerage: "Epique Realty",
  brokerageLogo: "media/brokerage-logo.png",
  brokerageStreet: "520 Pass Rd, Ste L",
  brokerageCity: "Gulfport",
  brokerageState: "MS",
  brokerageZip: "39507",
  officePhone: "(888) 893-3537",
  phone: "(601) 953-6504", // Bill's cell
  email: "bill@billtemplerealtor.com",
  license: "61942", // Mississippi license number

  // For Google: the site's main address and the towns Bill serves.
  siteUrl: "https://www.billtemplerealtor.com",
  photo: "media/bill.jpg",
  areaServed: ["Gulfport", "Biloxi", "Long Beach", "Pass Christian", "Bay St. Louis", "Ocean Springs", "D'Iberville"],

  // Homes for sale. Leave this false until the MLS feed (Flexmls / Spark API) is connected.
  // While false, the site shows no homes at all: "Homes for Sale" pages send visitors to the
  // "Tell me what you're looking for" form (find-a-home.html) and the home page says new
  // listings are coming soon. Once SPARK_ACCESS_TOKEN is set in Vercel, change this to true.
  showListings: false,
  // Only for testing the listing pages: true shows the made-up homes in data/listings.json
  // when the live feed isn't answering. Never turn this on for the public site.
  sampleListings: false,
};

SITE.brokerageAddress = `${SITE.brokerageStreet}, ${SITE.brokerageCity}, ${SITE.brokerageState} ${SITE.brokerageZip}`;

(function () {
  let path = location.pathname.split("/").pop() || "index.html";
  if (location.pathname.includes("/neighborhoods/")) path = "neighborhoods.html";
  if (location.pathname.includes("/guides/")) path = "guides.html";
  path = path.replace(/^([^.]+)$/, "$1.html"); // pages served without ".html"
  const links = [
    ["index.html", "Home"],
    ["index.html#about", "Meet Bill"],
    SITE.showListings ? ["listings.html", "Homes for Sale"] : ["find-a-home.html", "Find a Home"],
    ["neighborhoods.html", "Neighborhoods"],
    ["guides.html", "Guides"],
    ["investors.html", "Investors"],
    ["home-value.html", "Home Value"],
    ["market.html", "Market"],
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

  // Fill in agent and brokerage details anywhere a page asks for them, so a brokerage change
  // only needs the SITE lines above. <span data-site="brokerage"></span> shows the text;
  // <a data-site-link="phone"> or "email" becomes a tap-to-call or email link.
  document.querySelectorAll("[data-site]").forEach((el) => {
    if (SITE[el.dataset.site]) el.textContent = SITE[el.dataset.site];
  });
  document.querySelectorAll("[data-site-link]").forEach((el) => {
    const v = SITE[el.dataset.siteLink];
    if (!v) return;
    el.textContent = v;
    el.href = el.dataset.siteLink === "email" ? `mailto:${v}` : `tel:${v.replace(/[^0-9+]/g, "")}`;
  });

  // Business details for Google (schema.org RealEstateAgent), built from SITE so a brokerage
  // change only needs the lines at the top. Added on the home page only.
  if (path === "index.html") {
    const ld = {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      "@id": `${SITE.siteUrl}/#bill-temple`,
      name: `${SITE.agentName}, Realtor`,
      url: `${SITE.siteUrl}/`,
      image: `${SITE.siteUrl}/${SITE.photo}`,
      telephone: SITE.phone,
      email: SITE.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: SITE.brokerageStreet,
        addressLocality: SITE.brokerageCity,
        addressRegion: SITE.brokerageState,
        postalCode: SITE.brokerageZip,
        addressCountry: "US",
      },
      areaServed: SITE.areaServed.map((name) => ({ "@type": "City", name: `${name}, ${SITE.brokerageState}` })),
      parentOrganization: {
        "@type": "RealEstateAgent",
        name: SITE.brokerage,
        telephone: SITE.officePhone,
      },
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Mississippi real estate license",
        identifier: SITE.license,
      },
    };
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.textContent = JSON.stringify(ld);
    document.head.appendChild(tag);
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer">
        <div class="container">
          ${SITE.brokerageLogo ? `<img class="brokerage-logo" src="${SITE.brokerageLogo}" alt="${SITE.brokerage}">` : ""}
          <div>${SITE.agentName}, Realtor · MS License #${SITE.license} · Cell <a href="tel:${SITE.phone.replace(/[^0-9+]/g, "")}">${SITE.phone}</a> · <a href="mailto:${SITE.email}">${SITE.email}</a></div>
          <div>${SITE.brokerage} · ${SITE.brokerageAddress} · Office <a href="tel:${SITE.officePhone.replace(/[^0-9+]/g, "")}">${SITE.officePhone}</a></div>
          <p class="mls-disclaimer">Listing information is deemed reliable but not guaranteed. Listing data provided courtesy of the Mississippi Gulf Coast MLS (final required disclaimer to be confirmed with the MLS).</p>
          <div>© ${new Date().getFullYear()} ${SITE.agentName}</div>
        </div>
      </footer>`;
  }
})();
