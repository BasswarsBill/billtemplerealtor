#!/usr/bin/env python3
"""Posts to Bill's Facebook Page automatically.

Each run picks ONE post that hasn't gone out yet, draws a picture for it in the
site's look (true black, Cormorant + Jost, white type, small ocean-blue accent),
and posts the picture with its caption to the Page through Facebook's Graph API.

Where the posts come from (all already written elsewhere on the site):
  data/market.json            monthly market numbers + weekly mortgage rates
  data/neighborhoods.json     one spotlight per town
  data/guides-posts.json      one tip per buyer/seller guide step
  data/investors-posts.json   one tip per Investor Corner section
  data/social-extra.json      reminders about what Bill offers (edit freely)
  listings                    hook for later, once the MLS feed is on

What has been posted is kept in data/social-log.json, so nothing repeats until
everything in a group has had its turn (and then not sooner than REPEAT_AFTER_DAYS).

Settings live in data/social-settings.json ("mode": "preview" or "live").
In preview mode nothing is posted: the run only saves the picture and caption.

Usage:
  python3 scripts/social/facebook.py next      # pick the next post; post it if live
  python3 scripts/social/facebook.py preview N # save the next N posts to social-preview/ (never posts)
  python3 scripts/social/facebook.py check     # test the Facebook key: prints the Page name
  python3 scripts/social/facebook.py post ID   # post one specific post now (live mode only)
  python3 scripts/social/facebook.py repost    # delete the most recent post on Facebook and post it again

Needs: pip install pillow requests. Secret: FB_PAGE_TOKEN (a Page access token).
"""
import datetime as dt
import json
import math
import os
import re
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(__file__).resolve().parent / "fonts"
GRAPH = "https://graph.facebook.com/v24.0"
REPEAT_AFTER_DAYS = 120  # an evergreen post can come back after this many days
RATES_EVERY_DAYS = 13    # mortgage-rate post at most every other week

W, H = 1080, 1350        # 4:5, the tallest shape Facebook shows in full in the feed
BLACK = (0, 0, 0)
WHITE = (245, 245, 243)
DIM = (190, 190, 186)
FAINT = (120, 120, 118)
BLUE = (156, 201, 226)   # the site's ocean-blue accent (#9cc9e2)
LINE = (58, 58, 58)


def load(rel, default=None):
    p = ROOT / rel
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def save(rel, data):
    (ROOT / rel).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------- Bill's details: read from js/site.js so they live in one place ----------

def site_details():
    js = (ROOT / "js/site.js").read_text(encoding="utf-8")
    def val(key):
        m = re.search(rf'\b{key}:\s*"([^"]*)"', js)
        return m.group(1) if m else ""
    site = {k: val(k) for k in ["agentName", "brokerage", "phone", "siteUrl", "brokerageLogo"]}
    site["showListings"] = bool(re.search(r"\bshowListings:\s*true", js))
    site["domain"] = re.sub(r"^https?://(www\.)?", "", site["siteUrl"]).rstrip("/")
    return site


SITE = site_details()


def sign_off():
    return f"\n\n{SITE['agentName']}, Realtor | {SITE['brokerage']}\n{SITE['phone']} | {SITE['domain']}"


# ---------- Collect every post the site can make ----------

def market_posts():
    m = load("data/market.json", {})
    out = []
    L = m.get("listings") or {}
    if L.get("month"):
        def pct(v):
            return f"{'+' if v > 0 else ''}{v:.1f}% vs last year"
        stats = [
            (f"${L['medianListPrice']:,.0f}", "Typical list price", pct(L["medianListPriceYoY"])),
            (f"{L['activeListings']:,}", "Homes for sale", pct(L["activeListingsYoY"])),
            (f"{L['daysOnMarket']}", "Typical days on market", f"{L['daysOnMarketYearAgo']} a year ago"),
            (f"{round(L['priceReducedShare'])}%", "Listings with a price cut", "during the month"),
        ]
        out.append({
            "id": f"market-{L['month']}",
            "kind": "market",
            "eyebrow": f"GULF COAST MARKET  ·  {L['monthLabel'].upper()}",
            "title": "The market this month",
            "stats": stats,
            "url": "https://www.billtemplerealtor.com/market.html",
            "text": m["socialPost"].rstrip() + "\n\nAll the numbers: https://www.billtemplerealtor.com/market.html",
        })
    r = m.get("rates") or {}
    if r.get("date"):
        d = dt.date.fromisoformat(r["date"])
        when = d.strftime("%B %-d, %Y")
        diff = r["thirtyYear"] - r["thirtyYearYearAgo"]
        trend = "up" if diff > 0.05 else "down" if diff < -0.05 else "about the same as"
        compare = (f"{trend} from {r['thirtyYearYearAgo']:.2f}% a year ago" if trend != "about the same as"
                   else f"about the same as a year ago ({r['thirtyYearYearAgo']:.2f}%)")
        out.append({
            "id": f"rates-{r['date']}",
            "kind": "rates",
            "eyebrow": f"MORTGAGE RATES  ·  WEEK OF {d.strftime('%b %-d').upper()}",
            "rate": r["thirtyYear"],
            "rate15": r.get("fifteenYear"),
            "yearAgo": r["thirtyYearYearAgo"],
            "history": [h["thirtyYear"] for h in r.get("history", [])][-52:],
            "url": "https://www.billtemplerealtor.com/market.html",
            "text": (
                f"Mortgage rates this week: the average 30-year fixed rate was {r['thirtyYear']:.2f}% "
                f"(week of {when}), {compare}. The 15-year averaged {r['fifteenYear']:.2f}%.\n\n"
                "Your own rate depends on your credit, down payment and loan type, so a quick call with a "
                "lender is the best way to know your number. Thinking about buying on the Coast? I'm happy to help "
                "you figure out the next step.\n\n"
                "Rates and Coast market numbers, updated every week: https://www.billtemplerealtor.com/market.html\n"
                "Source: Freddie Mac Primary Mortgage Market Survey."
            ),
        })
    return out


def town_posts():
    n = load("data/neighborhoods.json", {})
    out = []
    for t in n.get("towns", []):
        out.append({
            "id": f"town-{t['slug']}",
            "kind": "town",
            "eyebrow": "NEIGHBORHOOD SPOTLIGHT",
            "title": t["name"],
            "line": t.get("tagline", ""),
            "lat": t.get("lat"), "lon": t.get("lon"),
            "url": t["url"],
            "text": t["socialPost"],
        })
    return out


def guide_posts():
    g = load("data/guides-posts.json", {})
    return [{
        "id": f"guide-{p['id']}",
        "kind": "guide",
        "eyebrow": f"{p['guide'].upper()}  ·  STEP {p['step']}",
        "title": p["title"],
        "url": p["url"],
        "text": p["socialPost"],
    } for p in g.get("posts", [])]


def investor_posts():
    g = load("data/investors-posts.json", {})
    return [{
        "id": p["id"],
        "kind": "investor",
        "eyebrow": "INVESTOR CORNER",
        "title": p["title"],
        "url": p["url"],
        "text": p["socialPost"],
    } for p in g.get("posts", [])]


def extra_posts():
    g = load("data/social-extra.json", {})
    return [{
        "id": p["id"],
        "kind": "promo",
        "eyebrow": p.get("eyebrow", ""),
        "title": p["title"],
        "line": p.get("line", ""),
        "url": p["url"],
        "text": p["socialPost"],
    } for p in g.get("posts", [])]


def listing_posts():
    # Later: once the MLS feed is connected (SITE.showListings = true), new listings
    # become posts here. Fair-housing and MLS display rules apply (listing brokerage
    # credit on every listing post), so this stays off until that work is done.
    return []


def all_posts():
    return market_posts() + town_posts() + guide_posts() + investor_posts() + extra_posts() + listing_posts()


# ---------- Pick the next post ----------

ROTATION = ["town", "guide", "promo", "investor", "guide"]  # evergreen mix, repeats in this order


def pick(posts, log, today, skip=()):
    sent = {e["id"]: e["date"] for e in log["posts"]}
    def days_since(date):
        return (today - dt.date.fromisoformat(date)).days
    fresh = [p for p in posts if p["id"] not in sent and p["id"] not in skip]

    # 1. A new month of market numbers goes first.
    for p in fresh:
        if p["kind"] == "market":
            return p
    # 2. New listings, when that's turned on.
    for p in fresh:
        if p["kind"] == "listing":
            return p
    # 3. Mortgage rates, at most every other week.
    last_rates = max((e["date"] for e in log["posts"] if e["kind"] == "rates"), default=None)
    if last_rates is None or days_since(last_rates) >= RATES_EVERY_DAYS:
        for p in fresh:
            if p["kind"] == "rates":
                return p
    # 4. Evergreen posts, taking turns by kind.
    evergreen = [e for e in log["posts"] if e["kind"] in ROTATION]
    step = log.get("rotation", 0)
    for i in range(len(ROTATION)):
        kind = ROTATION[(step + i) % len(ROTATION)]
        unsent = [p for p in fresh if p["kind"] == kind]
        if unsent:
            return unsent[0]
        # everything of this kind went out: repeat the oldest, if it's been long enough
        again = sorted((p for p in posts if p["kind"] == kind and p["id"] in sent and p["id"] not in skip),
                       key=lambda p: sent[p["id"]])
        if again and days_since(sent[again[0]["id"]]) >= REPEAT_AFTER_DAYS:
            return again[0]
    return None


# ---------- Draw the picture ----------

def font(name, size):
    files = {
        "serif": "cormorant-garamond-latin-500-normal.woff",
        "serif-italic": "cormorant-garamond-latin-500-italic.woff",
        "light": "jost-latin-300-normal.woff",
        "regular": "jost-latin-400-normal.woff",
        "medium": "jost-latin-500-normal.woff",
    }
    return ImageFont.truetype(str(FONTS / files[name]), size)


def spaced(d, xy, text, f, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + track
    return x


def spaced_width(d, text, f, track):
    return sum(d.textlength(c, font=f) + track for c in text) - track


def wrap(d, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title(d, text, width, max_lines, sizes=(112, 100, 90, 80, 72, 64)):
    for s in sizes:
        f = font("serif", s)
        lines = wrap(d, text, f, width)
        if len(lines) <= max_lines:
            return f, lines, s
    return f, lines, s


def draw_coast(img, box, dot=None):
    coast = load("data/coast-outline.json")
    if not coast:
        return
    x0, y0, x1, y1 = box
    lon0, lat0, lon1, lat1 = coast["bbox"]
    kx = math.cos(math.radians((lat0 + lat1) / 2))
    sx = (x1 - x0) / ((lon1 - lon0) * kx)
    sy = (y1 - y0) / (lat1 - lat0)
    s = min(sx, sy)
    ox = x0 + ((x1 - x0) - (lon1 - lon0) * kx * s) / 2
    oy = y0 + ((y1 - y0) - (lat1 - lat0) * s) / 2
    def P(lon, lat):
        return (ox + (lon - lon0) * kx * s, oy + (lat1 - lat) * s)
    d = ImageDraw.Draw(img)
    def on_edge(a, b):  # skip the straight edges of the map's frame, draw only the shoreline
        return any(abs(a[i] - v) < 1e-6 and abs(b[i] - v) < 1e-6 for i, v in
                   ((0, lon0), (0, lon1), (1, lat0), (1, lat1)))
    for ring in coast["rings"]:
        for a, b in zip(ring, ring[1:] + ring[:1]):
            if not on_edge(a, b):
                d.line((P(*a), P(*b)), fill=(92, 92, 90), width=3)
    if dot and dot[0] is not None:
        cx, cy = P(dot[1], dot[0])
        for r, col in ((34, (40, 60, 72)), (20, (70, 105, 125))):
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col, width=3)
        d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=BLUE)


def footer(img, d):
    M = 84
    y = H - 170
    d.line((M, y, W - M, y), fill=LINE, width=2)
    # Bill's photo in a small circle
    try:
        pic = Image.open(ROOT / "media/bill.jpg").convert("RGB")
        side = min(pic.size)
        pic = pic.crop(((pic.width - side) // 2, 0, (pic.width - side) // 2 + side, side)).resize((96, 96), Image.LANCZOS)
        mask = Image.new("L", (96 * 4, 96 * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 96 * 4 - 1, 96 * 4 - 1), fill=255)
        img.paste(pic, (M, y + 36), mask.resize((96, 96), Image.LANCZOS))
        tx = M + 124
    except OSError:
        tx = M
    spaced(d, (tx, y + 40), SITE["agentName"].upper(), font("serif", 34), WHITE, 6)
    spaced(d, (tx, y + 88), f"REALTOR  ·  {SITE['brokerage'].upper()}", font("regular", 19), DIM, 3.5)
    f = font("regular", 22)
    dom = SITE["domain"]
    d.text((W - M - d.textlength(dom, font=f), y + 46), dom, font=f, fill=BLUE)
    ph = SITE["phone"]
    d.text((W - M - d.textlength(ph, font=f), y + 84), ph, font=f, fill=DIM)


def render(post, path):
    img = Image.new("RGB", (W, H), BLACK)
    d = ImageDraw.Draw(img)
    M = 84
    kind = post["kind"]

    if kind == "town":
        draw_coast(img, (-260, 360, W + 260, 360 + int((W + 520) / 1.78)), dot=(post.get("lat"), post.get("lon")))
        # fade the map into black above the footer
        fade = Image.new("L", (W, H), 0)
        fd = ImageDraw.Draw(fade)
        for i in range(140):
            fd.line((0, H - 330 + i, W, H - 330 + i), fill=int(255 * i / 140))
        fd.rectangle((0, H - 190, W, H), fill=255)
        img.paste(Image.new("RGB", (W, H), BLACK), (0, 0), fade)
        d = ImageDraw.Draw(img)
    y = 130
    spaced(d, (M, y), post["eyebrow"], font("medium", 24), BLUE, 5)
    y += 74

    if kind == "rates":
        f = font("serif", 300)
        big = f"{post['rate']:.2f}%"
        d.text((M - 10, y - 40), big, font=f, fill=WHITE)
        y += 370
        spaced(d, (M, y), "30-YEAR FIXED, NATIONAL AVERAGE", font("regular", 24), DIM, 4)
        y += 70
        d.line((M, y, M + 70, y), fill=BLUE, width=3)
        y += 40
        f2 = font("light", 34)
        d.text((M, y), f"15-year fixed: {post['rate15']:.2f}%", font=f2, fill=WHITE)
        d.text((M, y + 52), f"A year ago: {post['yearAgo']:.2f}%", font=f2, fill=DIM)
        hist = post.get("history") or []
        if len(hist) > 2:
            gx0, gx1, gy0, gy1 = M, W - M, y + 160, H - 260
            lo, hi = min(hist) - 0.1, max(hist) + 0.1
            pts = [(gx0 + (gx1 - gx0) * i / (len(hist) - 1), gy1 - (gy1 - gy0) * (v - lo) / (hi - lo)) for i, v in enumerate(hist)]
            d.line(pts, fill=BLUE, width=4, joint="curve")
            d.ellipse((pts[-1][0] - 9, pts[-1][1] - 9, pts[-1][0] + 9, pts[-1][1] + 9), fill=BLUE)
            fl = font("regular", 20)
            d.text((gx0, gy1 + 14), "A year ago", font=fl, fill=FAINT)
            d.text((gx1 - d.textlength("This week", font=fl), gy1 + 14), "This week", font=fl, fill=FAINT)
    elif kind == "market":
        f, lines, s = fit_title(d, post["title"], W - 2 * M, 2)
        for ln in lines:
            d.text((M - 4, y), ln, font=f, fill=WHITE)
            y += int(s * 1.05)
        y += 40
        d.line((M, y, M + 70, y), fill=BLUE, width=3)
        y += 60
        colw = (W - 2 * M) // 2
        for i, (num, label, sub) in enumerate(post["stats"]):
            cx = M + (i % 2) * colw
            cy = y + (i // 2) * 300
            d.text((cx - 3, cy), num, font=font("serif", 104), fill=WHITE)
            d.text((cx, cy + 128), label, font=font("regular", 27), fill=WHITE)
            d.text((cx, cy + 168), sub, font=font("light", 25), fill=DIM)
    else:
        max_lines = 3 if kind == "town" else 4
        f, lines, s = fit_title(d, post["title"], W - 2 * M, max_lines)
        line = post.get("line")
        if not line:
            # the opening of the caption makes the sub-line (one or two sentences)
            parts = re.split(r"(?<=[.?!])\s+", post["text"].strip())
            line = parts[0]
            if len(parts) > 1 and len(line) + len(parts[1]) < 190 and "http" not in parts[1]:
                line += " " + parts[1]
            if len(line) > 200:
                line = ""
        fl = font("serif-italic", 46)
        sub = wrap(d, line, fl, W - 2 * M)[:5] if line else []
        if kind != "town":
            block = len(lines) * int(s * 1.06) + 94 + len(sub) * 60
            y = max(y, 204 + (H - 300 - 204 - block) // 2)
        for ln in lines:
            d.text((M - 4, y), ln, font=f, fill=WHITE)
            y += int(s * 1.06)
        y += 44
        d.line((M, y, M + 70, y), fill=BLUE, width=3)
        y += 50
        for ln in sub:
            d.text((M, y), ln, font=fl, fill=DIM)
            y += 60
        if kind != "town":
            # a quiet nod to where it comes from on the site
            path_txt = re.sub(r"^https?://(www\.)?", "", post["url"]).split("#")[0]
            fr = font("regular", 22)
            spaced(d, (M, H - 230), "READ MORE  ·  " + path_txt.upper(), fr, FAINT, 2.5)
    footer(img, d)
    img.save(path, "JPEG", quality=92, optimize=True)
    return path


# ---------- Facebook ----------

def token():
    t = os.environ.get("FB_PAGE_TOKEN", "").strip()
    if not t:
        sys.exit("No Facebook key yet: add the FB_PAGE_TOKEN secret in GitHub (Settings > Secrets and variables > Actions).")
    return t


def fb_check():
    import requests
    r = requests.get(f"{GRAPH}/me", params={"fields": "id,name,link", "access_token": token()}, timeout=30)
    data = r.json()
    if "error" in data:
        sys.exit(f"Facebook said no: {data['error'].get('message')}")
    print(f"Connected to the Facebook Page: {data.get('name')} (id {data.get('id')})")
    page = requests.get(f"{GRAPH}/me", params={"fields": "is_published,is_permanently_closed,link,fan_count,followers_count",
                                                 "access_token": token()}, timeout=30).json()
    print(f"Page details: {json.dumps(page)}")
    last = (get_log().get("posts") or [None])[-1]
    if last and last.get("facebookId"):
        info = requests.get(f"{GRAPH}/{last['facebookId']}", params={
            "fields": "is_published,is_hidden,privacy,permalink_url,status_type,created_time",
            "access_token": token()}, timeout=30).json()
        print(f"Latest post: {json.dumps(info)}")
    return data


def fb_post(post, image_path):
    import requests
    with open(image_path, "rb") as fh:
        r = requests.post(
            f"{GRAPH}/me/photos",
            data={"message": caption(post), "access_token": token()},
            files={"source": (Path(image_path).name, fh, "image/jpeg")},
            timeout=120,
        )
    data = r.json()
    if "error" in data:
        sys.exit(f"Facebook said no: {data['error'].get('message')}")
    return data.get("post_id") or data.get("id")


def fb_delete(fb_id):
    import requests
    r = requests.delete(f"{GRAPH}/{fb_id}", params={"access_token": token()}, timeout=30)
    data = r.json()
    if isinstance(data, dict) and "error" in data:
        print(f"Couldn't delete the old post ({data['error'].get('message')}). Posting again anyway.")
    else:
        print(f"Deleted the old post {fb_id}.")


def caption(post):
    return post["text"].strip() + sign_off()


# ---------- Commands ----------

def settings():
    return load("data/social-settings.json", {"mode": "preview"})


def get_log():
    return load("data/social-log.json", None) or {"posts": [], "rotation": 0}


def record(log, post, fb_id, today):
    log["posts"].append({"id": post["id"], "kind": post["kind"], "date": today.isoformat(), "facebookId": fb_id})
    if post["kind"] in ROTATION:
        log["rotation"] = (log.get("rotation", 0) + 1) % len(ROTATION)


def out_dir():
    d = ROOT / "social-preview"
    d.mkdir(exist_ok=True)
    return d


def write_preview(post, n):
    img = render(post, out_dir() / f"{n:02d}-{post['id']}.jpg")
    (out_dir() / f"{n:02d}-{post['id']}.txt").write_text(caption(post) + "\n", encoding="utf-8")
    return img


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "next"
    today = dt.date.fromisoformat(os.environ["TODAY"]) if os.environ.get("TODAY") else dt.date.today()
    posts = all_posts()
    log = get_log()
    live = settings().get("mode") == "live"

    if cmd == "check":
        fb_check()
        return

    if cmd == "preview":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 6
        sim = json.loads(json.dumps(log))
        day = today
        for i in range(1, n + 1):
            p = pick(posts, sim, day)
            if not p:
                break
            write_preview(p, i)
            print(f"{i:02d}  {day}  {p['kind']:9s} {p['id']}")
            record(sim, p, None, day)
            day += dt.timedelta(days=2 if day.weekday() != 4 else 3)  # Mon / Wed / Fri
        return

    if cmd == "repost":
        if not live:
            sys.exit("Preview mode: nothing to repost.")
        if not log["posts"]:
            sys.exit("Nothing has been posted yet.")
        last = log["posts"].pop()
        if last.get("facebookId"):
            fb_delete(last["facebookId"])
        if last["kind"] in ROTATION:
            log["rotation"] = (log.get("rotation", 0) - 1) % len(ROTATION)
        cmd, want = "post", last["id"]
    elif cmd == "post":
        want = sys.argv[2]
    if cmd == "post":
        p = next((p for p in posts if p["id"] == want), None)
        if not p:
            sys.exit(f"No post with id {want}")
        if not live:
            sys.exit("Preview mode: not posting.")
    else:
        p = pick(posts, log, today)
        if not p:
            print("Nothing new to post today.")
            return

    img = write_preview(p, 0)
    print(f"Picked: {p['id']} ({p['kind']})\n\n{caption(p)}\n")
    if not live:
        print("Preview mode (data/social-settings.json): not posted. The picture and caption are saved with this run.")
        return
    fb_id = fb_post(p, img)
    record(log, p, fb_id, today)
    save("data/social-log.json", log)
    print(f"Posted to Facebook: {fb_id}")


if __name__ == "__main__":
    main()
