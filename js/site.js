// Shared header and footer for every page.
// Usage: put <div id="site-header"></div> and <div id="site-footer"></div> in a page,
// then load this script. Edit agent details in SITE below.
const SITE = {
  agentName: "Bill Temple",
  brokerage: "Your Brokerage Name",
  phone: "(555) 555-5555",
  email: "bill@example.com",
};

(function () {
  const path = location.pathname.split("/").pop() || "index.html";
  const links = [
    ["index.html", "Home"],
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
          <div>${SITE.agentName}, ${SITE.brokerage} · <a href="tel:${SITE.phone.replace(/[^0-9+]/g, "")}">${SITE.phone}</a> · <a href="mailto:${SITE.email}">${SITE.email}</a></div>
          <p class="mls-disclaimer">Listing information is deemed reliable but not guaranteed. Listings shown are currently sample data until the MLS feed is connected. The final MLS disclaimer and logo required by your MLS will go here.</p>
          <div>© ${new Date().getFullYear()} ${SITE.agentName}</div>
        </div>
      </footer>`;
  }
})();
