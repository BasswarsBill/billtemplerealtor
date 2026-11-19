// Deal calculator on investors.html (markup built by scripts/build-investors.mjs).
// Three modes: long-term rental, vacation rental, fix and flip. Everything runs in the browser;
// nothing is sent anywhere unless the visitor presses "Send these numbers to Bill", which copies
// a summary into the Ask Bill form below.
(function () {
  var root = document.getElementById("deal-calc");
  if (!root) return;
  var form = document.getElementById("calc-panel");
  var tabs = Array.prototype.slice.call(root.querySelectorAll("[role=tab]"));
  var mode = "ltr";
  var last = null;

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat($(id).value); return isFinite(v) && v > 0 ? v : 0; };
  var money = function (n) {
    var s = "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
    return n < 0 ? "−" + s : s;
  };
  var pct = function (n, d) { return isFinite(n) ? (n < 0 ? "−" : "") + Math.abs(n).toFixed(d == null ? 1 : d) + "%" : "–"; };

  function payment(loan, ratePct, years) {
    if (!loan || !years) return 0;
    var r = ratePct / 100 / 12, n = years * 12;
    return r ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
  }

  function rental(str) {
    var price = num("c-price"), rehab = num("c-rehab");
    var basis = price + rehab;
    var closing = price * num("c-closing") / 100;
    var down = price * num("c-down") / 100;
    var loan = price - down;
    var debt = payment(loan, num("c-rate"), num("c-term")) * 12;

    var gross, collected, opex, cashIn, rentForRule;
    var fixed = num("c-tax") + num("c-ins") + num("c-flood") + num("c-hoa") * 12;
    if (str) {
      gross = num("c-nightly") * 365 * num("c-occ") / 100;
      collected = gross;
      opex = fixed + gross * (num("c-strmgmt") + num("c-maint") + num("c-capex")) / 100 + num("c-strmonthly") * 12;
      cashIn = down + closing + rehab + num("c-furnish");
      rentForRule = gross / 12;
    } else {
      gross = num("c-rent") * 12;
      collected = gross * (1 - num("c-vacancy") / 100);
      opex = fixed + collected * num("c-mgmt") / 100 + gross * (num("c-maint") + num("c-capex")) / 100;
      cashIn = down + closing + rehab;
      rentForRule = num("c-rent");
    }
    var noi = collected - opex;
    var flow = noi - debt;
    var r = {
      flow: flow, noi: noi, debt: debt, cashIn: cashIn, gross: gross, collected: collected, opex: opex,
      cap: basis ? (noi / basis) * 100 : NaN,
      coc: cashIn ? (flow / cashIn) * 100 : NaN,
      onePct: basis ? (rentForRule / basis) * 100 : NaN,
      dscr: debt ? noi / debt : NaN,
    };

    $("r-head-label").textContent = "Monthly cash flow";
    $("r-head").textContent = money(flow / 12);
    $("r-head").className = flow < 0 ? "neg" : "";
    $("r-head-note").textContent = money(flow) + " a year after the mortgage";

    var rows = [
      [str ? "Booking income (year)" : "Rent collected (year)", money(collected)],
      ["Operating costs (year)", money(opex)],
      ["Net operating income (NOI)", money(noi)],
      ["Mortgage payments (year)", money(debt)],
      ["Cash you put in", money(cashIn)],
      ["Cap rate", pct(r.cap)],
      ["Cash-on-cash return", pct(r.coc)],
      [str ? "Monthly income ÷ price (1% rule)" : "Rent ÷ price (1% rule)", pct(r.onePct, 2)],
      ["Debt coverage (DSCR)", isFinite(r.dscr) ? r.dscr.toFixed(2) : "No loan"],
    ];
    var flags = [];
    if (Math.abs(flow) < 600) flags.push(["info", "This property roughly breaks even with these numbers. The payoff would come from rent growth, loan paydown and value over time, not monthly cash."]);
    else if (flow < 0) flags.push(["warn", "This property loses money each month with these numbers. A bigger down payment, a lower price or higher rent would change that."]);
    else flags.push(["ok", "Cash flow is positive with these numbers. Double-check the insurance and tax figures with real quotes."]);
    if (isFinite(r.onePct)) flags.push(r.onePct >= 1 ? ["ok", "Meets the 1% rule."] : ["info", "Below the 1% rule. Not a deal-breaker on its own, but the other numbers need to carry it."]);
    if (isFinite(r.dscr)) flags.push(r.dscr >= 1.2 ? ["ok", "Debt coverage of 1.2 or more is what many investor (DSCR) lenders like to see."] : ["info", "Debt coverage under 1.2. Some investor loans may be harder to get."]);
    if (!num("c-flood")) flags.push(["info", "Flood insurance is set to $0. Check the FEMA flood zone and get a quote, even outside high-risk zones."]);
    render(rows, flags);
    return r;
  }

  function flip() {
    var price = num("f-price"), rehab = num("f-rehab"), arv = num("f-arv");
    var buy = price * num("f-closing") / 100;
    var hold = num("c-hold") * num("c-months");
    var sell = arv * num("c-sell") / 100;
    var cost = price + rehab + buy + hold + sell;
    var profit = arv - cost;
    var max70 = arv * 0.7 - rehab;
    var r = { profit: profit, cost: cost, max70: max70, roi: cost ? (profit / (cost - sell)) * 100 : NaN };

    $("r-head-label").textContent = "Estimated profit";
    $("r-head").textContent = money(profit);
    $("r-head").className = profit < 0 ? "neg" : "";
    $("r-head-note").textContent = pct(r.roi) + " on the money spent before the sale";

    var rows = [
      ["After-repair value", money(arv)],
      ["Purchase price", money(price)],
      ["Repairs", money(rehab)],
      ["Costs to buy", money(buy)],
      ["Holding costs (" + num("c-months") + " months)", money(hold)],
      ["Costs to sell", money(sell)],
      ["Total cost", money(cost)],
      ["70% rule maximum offer", money(max70)],
    ];
    var flags = [];
    flags.push(price <= max70
      ? ["ok", "The price is at or under the 70% rule maximum."]
      : ["warn", "The price is " + money(price - max70) + " over the 70% rule maximum. That leaves less room for surprises."]);
    if (profit < 0) flags.push(["warn", "This flip loses money with these numbers."]);
    else if (arv && profit / arv < 0.1) flags.push(["info", "Profit is under 10% of the sale price. A repair surprise or a slow sale could wipe it out."]);
    flags.push(["info", "In a high-risk flood zone, big repairs can trigger flood-rule upgrades. Ask the building department before you buy."]);
    render(rows, flags);
    return r;
  }

  function render(rows, flags) {
    $("r-list").innerHTML = rows.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("");
    $("r-flags").innerHTML = flags.map(function (f) { return '<li class="' + f[0] + '">' + f[1] + "</li>"; }).join("");
  }

  function update() {
    last = mode === "flip" ? flip() : rental(mode === "str");
  }

  function setMode(m, focus) {
    mode = m;
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-mode") === m;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on) { form.setAttribute("aria-labelledby", t.id); if (focus) t.focus(); }
    });
    root.querySelectorAll("[data-show]").forEach(function (el) {
      el.hidden = el.getAttribute("data-show").split(" ").indexOf(m) === -1;
    });
    update();
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { setMode(t.getAttribute("data-mode")); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      setMode(tabs[(i + d + tabs.length) % tabs.length].getAttribute("data-mode"), true);
    });
  });
  form.addEventListener("input", update);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  form.addEventListener("reset", function () { setTimeout(update, 0); });

  // Copy the numbers into the Ask Bill form.
  $("calc-send").addEventListener("click", function (e) {
    var deal = $("ask-deal"), msg = document.getElementById("ask-message");
    if (!deal || !msg) return;
    e.preventDefault();
    var label = { ltr: "Long-term rental", str: "Vacation rental", flip: "Fix and flip" }[mode];
    var ids = Array.prototype.slice.call(form.querySelectorAll("input[type=number]")).filter(function (el) {
      return !el.closest("[hidden]");
    });
    var inputs = ids.map(function (el) {
      var name = el.closest("label").querySelector("span").textContent;
      return name + ": " + el.value;
    });
    var results = Array.prototype.slice.call($("r-list").children).map(function (row) {
      return row.children[0].textContent + ": " + row.children[1].textContent;
    });
    deal.value = label + "\n" + $("r-head-label").textContent + ": " + $("r-head").textContent + "\n" + results.join("\n") + "\n\nWhat they entered:\n" + inputs.join("\n");
    $("ask-deal-note").hidden = false;
    var type = document.getElementById("ask-type");
    if (type && !type.value) type.value = mode === "flip" ? "Fix and flip" : mode === "str" ? "Vacation or short-term rental" : "Long-term rental";
    if (!msg.value.trim()) msg.value = "I ran the numbers on a " + label.toLowerCase() + " in your calculator. Can you take a look? The property is: ";
    document.getElementById("ask").scrollIntoView({ behavior: "smooth", block: "start" });
    msg.focus({ preventScroll: true });
    msg.setSelectionRange(msg.value.length, msg.value.length);
  });

  setMode("ltr");
})();
