// Market update page (market.html). Everything comes from data/market.json,
// which scripts/update-market.mjs refreshes every week.
(function () {
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var moneyK = function (n) { return "$" + Math.round(n / 1000) + "k"; };
  var count = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var monthShort = function (key) { return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(2, 4); };
  var dayShort = function (iso) { return MONTHS[Number(iso.slice(5, 7)) - 1] + " " + Number(iso.slice(8, 10)); };
  var dayLong = function (iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  var $ = function (id) { return document.getElementById(id); };

  fetch("data/market.json")
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(render)
    .catch(function () {
      $("mk-stats").innerHTML = '<div style="grid-column:1/-1"><span>Market numbers are being updated. Please check back soon.</span></div>';
    });

  function change(p, unit) {
    if (p === null || p === undefined) return "";
    if (p === 0) return "same as last year";
    return (p > 0 ? "up " : "down ") + Math.abs(p) + (unit || "%") + " from last year";
  }

  function render(m) {
    var l = m.listings, r = m.rates;
    if (l) $("mk-eyebrow").textContent = "Market update · " + l.monthLabel;
    if (m.updated) $("mk-updated").textContent = "Last updated " + dayLong(m.updated) + ".";

    var tiles = [];
    if (l) {
      tiles.push([money(l.medianListPrice), "Typical list price", change(l.medianListPriceYoY)]);
      tiles.push([count(l.activeListings), "Homes for sale", change(l.activeListingsYoY)]);
      tiles.push([String(l.daysOnMarket), "Days on market",
        l.daysOnMarketYearAgo ? l.daysOnMarketYearAgo + " days a year ago" : ""]);
    }
    if (r) tiles.push([r.thirtyYear.toFixed(2) + "%", "30-year mortgage rate",
      r.thirtyYearYearAgo ? r.thirtyYearYearAgo.toFixed(2) + "% a year ago" : ""]);
    $("mk-stats").className = "stats" + (tiles.length === 3 ? " stats-3" : "");
    $("mk-stats").innerHTML = "";
    tiles.forEach(function (t) {
      var d = document.createElement("div");
      var s = document.createElement("strong"); s.textContent = t[0];
      var lab = document.createElement("span"); lab.textContent = t[1];
      d.appendChild(s); d.appendChild(lab);
      if (t[2]) { var c = document.createElement("em"); c.textContent = t[2]; d.appendChild(c); }
      $("mk-stats").appendChild(d);
    });

    var ul = $("mk-headlines");
    (m.headlines || []).forEach(function (h) {
      var li = document.createElement("li"); li.textContent = h; ul.appendChild(li);
    });

    if (l && l.history && l.history.length > 1) {
      var pts = l.history.map(function (h) { return { x: monthShort(h.month), y: h.medianListPrice }; });
      lineChart($("ch-price"), "Typical list price", "Monthly median asking price, Gulfport-Biloxi metro", pts, money, moneyK);
      var ap = l.history.map(function (h) { return { x: monthShort(h.month), y: h.activeListings }; });
      lineChart($("ch-active"), "Homes for sale", "Active listings each month, Gulfport-Biloxi metro", ap, count, count);
    }
    if (r && r.history && r.history.length > 1) {
      var rp = r.history.map(function (h) { return { x: dayShort(h.date), y: h.thirtyYear }; });
      var pctFmt = function (v) { return v.toFixed(2) + "%"; };
      lineChart($("ch-rate"), "30-year mortgage rate", "Weekly national average, Freddie Mac", rp, pctFmt, function (v) { return v.toFixed(1) + "%"; });
    } else {
      $("ch-rate").remove();
    }

    var tb = document.querySelector("#mk-counties tbody");
    ((l && l.counties) || []).forEach(function (c) {
      var tr = document.createElement("tr");
      [c.name, c.medianListPrice ? money(c.medianListPrice) : "—",
        c.medianListPriceYoY === null ? "—" : (c.medianListPriceYoY > 0 ? "+" : "") + c.medianListPriceYoY + "%",
        c.activeListings ? count(c.activeListings) : "—",
        c.daysOnMarket || "—",
        c.pricePerSqft ? money(c.pricePerSqft) : "—"].forEach(function (v, i) {
        var td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) td.scope = "row";
        td.textContent = v;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });

    var src = $("mk-sources");
    (m.sources || []).forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = s.url; a.textContent = s.name; a.rel = "noopener"; a.target = "_blank";
      li.appendChild(a);
      src.appendChild(li);
    });
  }

  // A single-series line chart in SVG, with a hover/keyboard readout and a table view.
  function lineChart(fig, title, sub, pts, fmt, tickFmt) {
    var W = 560, H = 260, L = 58, R = 18, T = 16, B = 34;
    var ys = pts.map(function (p) { return p.y; });
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    var pad = (hi - lo) * 0.15 || hi * 0.05 || 1;
    var ticks = niceTicks(lo - pad, hi + pad, 4);
    var y0 = ticks[0], y1 = ticks[ticks.length - 1];
    var X = function (i) { return L + (i * (W - L - R)) / (pts.length - 1); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - y0) / (y1 - y0)); };
    var NS = "http://www.w3.org/2000/svg";
    var el = function (tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    };

    var cap = document.createElement("figcaption");
    var h = document.createElement("h3"); h.textContent = title;
    var p = document.createElement("p"); p.textContent = sub;
    cap.appendChild(h); cap.appendChild(p);
    fig.appendChild(cap);

    var wrap = document.createElement("div");
    wrap.className = "chart-plot";
    fig.appendChild(wrap);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", tabindex: "0",
      "aria-label": title + ". Latest " + fmt(ys[ys.length - 1]) + ". Use arrow keys to read each point." }, wrap);

    ticks.forEach(function (t) {
      el("line", { x1: L, x2: W - R, y1: Y(t), y2: Y(t), class: "grid" }, svg);
      var tx = el("text", { x: L - 8, y: Y(t) + 4, "text-anchor": "end", class: "tick" }, svg);
      tx.textContent = tickFmt(t);
    });
    var step = Math.ceil(pts.length / 6);
    pts.forEach(function (pt, i) {
      if (i % step && i !== pts.length - 1) return;
      if (i !== pts.length - 1 && pts.length - 1 - i < step) return;
      var tx = el("text", { x: X(i), y: H - 10, "text-anchor": i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle", class: "tick" }, svg);
      tx.textContent = pt.x;
    });

    var d = pts.map(function (pt, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(pt.y).toFixed(1); }).join(" ");
    el("path", { d: d, class: "line" }, svg);
    var last = pts.length - 1;
    el("circle", { cx: X(last), cy: Y(ys[last]), r: 4, class: "dot" }, svg);

    var hair = el("line", { y1: T, y2: H - B, class: "hair", visibility: "hidden" }, svg);
    var hot = el("circle", { r: 5, class: "dot hot", visibility: "hidden" }, svg);
    var tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.hidden = true;
    wrap.appendChild(tip);

    function show(i) {
      var cx = X(i), cy = Y(pts[i].y);
      hair.setAttribute("x1", cx); hair.setAttribute("x2", cx); hair.setAttribute("visibility", "visible");
      hot.setAttribute("cx", cx); hot.setAttribute("cy", cy); hot.setAttribute("visibility", "visible");
      tip.innerHTML = "";
      var v = document.createElement("strong"); v.textContent = fmt(pts[i].y);
      var lb = document.createElement("span"); lb.textContent = pts[i].x;
      tip.appendChild(v); tip.appendChild(lb);
      tip.hidden = false;
      var left = (cx / W) * 100;
      tip.style.left = left + "%";
      tip.style.top = (cy / H) * 100 + "%";
      tip.style.transform = "translate(" + (left > 70 ? "calc(-100% - 12px)" : "12px") + ", -50%)";
      current = i;
    }
    function hide() {
      hair.setAttribute("visibility", "hidden"); hot.setAttribute("visibility", "hidden"); tip.hidden = true;
    }
    var current = last;
    svg.addEventListener("pointermove", function (e) {
      var box = svg.getBoundingClientRect();
      var x = ((e.clientX - box.left) / box.width) * W;
      var i = Math.round(((x - L) / (W - L - R)) * (pts.length - 1));
      show(Math.max(0, Math.min(last, i)));
    });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", function () { show(current); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(Math.max(0, current - 1)); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(Math.min(last, current + 1)); e.preventDefault(); }
    });

    var det = document.createElement("details");
    var sum = document.createElement("summary"); sum.textContent = "Show the numbers";
    det.appendChild(sum);
    var tbl = document.createElement("table");
    tbl.className = "mk-table small";
    pts.slice().reverse().forEach(function (pt) {
      var tr = document.createElement("tr");
      var a = document.createElement("th"); a.scope = "row"; a.textContent = pt.x;
      var b = document.createElement("td"); b.textContent = fmt(pt.y);
      tr.appendChild(a); tr.appendChild(b); tbl.appendChild(tr);
    });
    det.appendChild(tbl);
    fig.appendChild(det);
  }

  function niceTicks(lo, hi, n) {
    var raw = (hi - lo) / n;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (s) { return s * mag; }).find(function (s) { return s >= raw; });
    var start = Math.floor(lo / step) * step, out = [];
    for (var v = start; v <= hi + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
    if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
    return out;
  }
})();
