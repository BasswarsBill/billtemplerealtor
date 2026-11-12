# Bill Temple, Realtor website

Plain static site (HTML, CSS, vanilla JavaScript). No build step. Deploys to Vercel as-is.

## Pages
- `index.html` home page with newest listings
- `listings.html` search and filter homes for sale
- `listing.html?id=...` one home's details
- `forms.html` client forms (built separately in `forms/`)

## Listings
All pages load houses through `js/listings-data.js`. Right now it reads sample data from
`data/listings.json`. When MLS/IDX feed access is approved, a Vercel function at
`api/listings.js` will fetch from the MLS and return the same shape, and `LISTINGS_SOURCE`
switches to `/api/listings`.

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
- `media/hood-*.jpg` are the neighborhood tiles on the home page.
- Home page: bio in `index.html` is a DRAFT for Bill to edit; neighborhood names are placeholders.

## Changing brokerages
Edit the brokerage lines in `SITE` at the top of `js/site.js` (name, address, office phone) and
replace `media/brokerage-logo.png` with the new brokerage's logo. Every page and the signed form PDFs update from there.

## Publishing
The Vercel project `bill-temple-realtor` is linked to this repo. Any change merged into the
default branch (`claude/project-thread-r7mqe8`) goes live automatically within a minute or two.
No more uploads from a PC are needed.
