# Bill Temple, Realtor website

Plain static site (HTML, CSS, vanilla JavaScript). No build step. Deploys to Vercel as-is.

## Pages
- `index.html` home page (newest listings once the MLS feed is on; "coming soon" until then)
- `find-a-home.html` "Tell me what you're looking for" buyer wish list. Emails Bill as a lead through `api/submit-form.js`.
- `listings.html` search and filter homes for sale
- `listing.html?id=...` one home's details
- `forms.html` client forms (built separately in `forms/`)
- `home-value.html` "What's my home worth?" form. Emails Bill through `api/submit-form.js` (same Resend setup as the forms).
- `market.html` Gulf Coast market update (prices, homes for sale, days on market, mortgage rates, by county)
- `guides.html`, `guides/buying.html`, `guides/selling.html` buyer and seller guides (see below)
- `investors.html` Investor Corner with a deal calculator (see below)

## Listings
Homes are switched off until the MLS feed is connected: `SITE.showListings` is `false` in
`js/site.js`. While off, no homes appear anywhere, `listings.html` and `listing.html` send
visitors to `find-a-home.html` (keeping any town, price or beds they searched), the nav says
"Find a Home", and the home page shows "New listings coming soon".

To turn homes on: set `SPARK_ACCESS_TOKEN` in Vercel (see `api/listings.js`), then change
`showListings` to `true`. All pages load houses through `js/listings-data.js`, which asks
`/api/listings`. The made-up houses in `data/listings.json` are only used when
`SITE.sampleListings` is also `true`, for testing; never on the public site.

## Editing contact details
Agent name, brokerage, phone and email are in `js/site.js` (`SITE`).

## Run locally
`npx serve .` (or any static server), then open http://localhost:3000.

## Look and media
Black and white with a soft ocean-blue accent; headings in Cormorant Garamond, text in Jost.
Colors and fonts are the variables at the top of `css/styles.css`.
- `media/hero.mp4` plays silently behind the home page header (20-second loop, about 8 MB).
  `media/hero-poster.jpg` is a still from it that shows while it loads. To change the video,
  replace both files with the same names. Keep new clips short (15 to 30 seconds) and under ~10 MB.
- `media/hood-1.jpg` is the Long Beach tile on the home page; the other home page tiles are town maps (see Neighborhood guides).
- Home page: bio in `index.html` is a DRAFT for Bill to edit.

## Changing brokerages
Edit the brokerage lines in `SITE` at the top of `js/site.js` (name, address, office phone) and
replace `media/brokerage-logo.png` with the new brokerage's logo. Every page and the signed form PDFs update from there.

## Publishing
The Vercel project `bill-temple-realtor` is linked to this repo. Any change merged into the
default branch (`claude/project-thread-r7mqe8`) goes live automatically within a minute or two.
No more uploads from a PC are needed.

## Market update (updates itself)
`market.html` and the home page snapshot read `data/market.json`. Every Thursday a GitHub Action
(`.github/workflows/update-market.yml`) runs `scripts/update-market.mjs`, which pulls free public data
(Realtor.com Economic Research listing data for the Gulfport-Biloxi metro and its counties, and Freddie Mac
mortgage rates from FRED), and commits the file if the numbers changed. Vercel then republishes the site.
To refresh right away: GitHub > Actions > Update market data > Run workflow.
`data/market.json` also holds ready-made plain-English `headlines` and a `socialPost`, for reuse in Facebook posts later.
To add a personal comment on the market page, type it inside `<p class="market-take" id="mk-take"></p>` in `market.html`.

## Neighborhood guides (update themselves)
`neighborhoods.html` lists the town guides, and each town has its own page in `neighborhoods/` (Gulfport, Biloxi,
Long Beach, Pass Christian, Bay St. Louis, Ocean Springs, D'Iberville). These pages are built by
`scripts/update-neighborhoods.mjs`, so don't edit them by hand:
- The words (intro, places to know, schools, roads) are in `data/towns.json`. Edit them there.
- The numbers fill in automatically every Thursday (`.github/workflows/update-neighborhoods.yml`) from the U.S. Census
  Bureau (home values, rents, commute) and Realtor.com (homes for sale by ZIP code). Saving `data/towns.json` on GitHub
  also rebuilds the pages within a couple of minutes.
- `data/neighborhoods.json` holds everything in one place, including a ready-made `socialPost` for each town, for
  Facebook posts later.
- Photos and video: until a town has its own, its page shows a map. To use Bill's drone footage, put the file in
  `media/towns/` (videos 15 to 30 seconds, under ~10 MB) and fill in that town's `media` in `data/towns.json`:
  `"video": "media/towns/biloxi.mp4", "poster": "media/towns/biloxi.jpg", "photo": "media/towns/biloxi.jpg"`.
- Fair housing: describe places, homes and amenities. Don't describe the people who live somewhere or who an area is "good for".
- To add a town, copy one town's block in `data/towns.json` and change it (`censusName` must match the Census name,
  for example "Waveland city, Mississippi").

## Buyer and seller guides
`guides.html` is the guides hub, and `guides/buying.html` and `guides/selling.html` are the step-by-step guides.
They are built by `scripts/build-guides.mjs`, so don't edit them by hand:
- All the words are in `data/guides.json`: each guide's intro, "Bill's take" quote, and each step (title, summary,
  paragraphs, an optional "On the Coast" note, checklist and links). Saving that file on GitHub rebuilds the pages
  within a couple of minutes (`.github/workflows/build-guides.yml`).
- Each step has a `socialPost`. `data/guides-posts.json` collects them all, with a link to the exact step, ready for
  Facebook posts later.
- The "Ask Bill" form at the bottom of each guide emails Bill through `api/submit-form.js` (subject "Question from the buyer guide" and so on).
- Keep it general information, not legal, tax or insurance advice, and update `reviewed` in `data/guides.json` when you check the facts again
  (Mississippi disclosure law and form, FEMA/NFIP rules, homestead exemption, wind pool).

## Investor Corner
`investors.html` covers long-term and vacation rentals, flips, deal math (cap rate, cash-on-cash, the 1% and 70% rules,
DSCR) and Coast costs like flood and wind insurance, with a deal calculator (`js/deal-calculator.js`) and an
"Ask Bill about an investment" form that emails Bill as a lead (same `api/submit-form.js`). The calculator's
"Send these numbers to Bill" button copies the visitor's numbers into that form.
- The words are in `data/investors.json`. Edit them there; the page is built by `scripts/build-investors.mjs`.
  "Bill's take" at the top is a draft for Bill to edit. Don't add sales numbers or promised returns.
- The starting interest rate (this week's 30-year average plus 0.75%) comes from `data/market.json`, and the
  rents-by-town table from `data/neighborhoods.json`. `.github/workflows/build-investors.yml` rebuilds the page
  when `data/investors.json` changes and every Thursday after the market and neighborhood updates.
- `data/investors-posts.json` has one ready-made Facebook post per section, for auto-posting later.
