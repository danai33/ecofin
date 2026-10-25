/* =====================================================================
   FinCalc — every financial formula EcoFin shows. Pure functions, no DOM,
   no AI. Tested separately (tests/calc.test.mjs) and re-checked live in
   Credite → Ghid → "Verificarea calculelor".
   ===================================================================== */
const FinCalc = (() => {
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  /* ---- loans ---------------------------------------------------------- */
  // Fixed instalment (anuitate): A = P·i / (1 − (1+i)^−n), i = annual/12
  function annuityPayment(P, annualRatePct, n) {
    const i = num(annualRatePct) / 100 / 12;
    if (n <= 0) return 0;
    if (i === 0) return P / n;
    return P * i / (1 - Math.pow(1 + i, -n));
  }

  /**
   * Full repayment schedule and cost of one offer.
   * o = {rate (annual %), type 'ann'|'desc', fee (upfront), feeUnit '%'|'lei',
   *      monthly (admin fee lei/month), insurance (lei/month), term (months, optional)}
   */
  function loan(o, principal, months) {
    const P = Math.max(0, num(principal));
    const n = Math.max(1, Math.min(600, Math.round(num(o.term) || num(months) || 1)));
    const i = Math.max(0, num(o.rate)) / 100 / 12;
    const upfront = o.feeUnit === '%' ? P * Math.max(0, num(o.fee)) / 100 : Math.max(0, num(o.fee));
    const monthlyFee = Math.max(0, num(o.monthly));
    const insurance = Math.max(0, num(o.insurance));
    const rows = [];
    let bal = P, totI = 0;
    if (o.type === 'desc') {
      const pr = P / n;
      for (let k = 1; k <= n; k++) {
        const it = bal * i, p = k === n ? bal : pr;
        bal -= p; totI += it;
        rows.push({ k, interest: it, principal: p, payment: it + p, fees: monthlyFee + insurance, balance: Math.max(0, bal) });
      }
    } else {
      const A = annuityPayment(P, num(o.rate), n);
      for (let k = 1; k <= n; k++) {
        const it = bal * i; let p = A - it;
        if (k === n) p = bal;
        bal -= p; totI += it;
        rows.push({ k, interest: it, principal: p, payment: it + p, fees: monthlyFee + insurance, balance: Math.max(0, bal) });
      }
    }
    const totMonthlyFees = monthlyFee * n, totInsurance = insurance * n;
    const totalFees = upfront + totMonthlyFees + totInsurance;
    const cashflows = rows.map(r => r.payment + r.fees);
    const irr = solveIRR(P - upfront, cashflows);
    const dae = irr == null ? null : Math.pow(1 + irr, 12) - 1;
    return {
      principal: P, n, i, upfront, monthlyFee, insurance, rows,
      firstPayment: rows[0].payment + monthlyFee + insurance,
      lastPayment: rows[n - 1].payment + monthlyFee + insurance,
      totalInterest: totI, totalMonthlyFees: totMonthlyFees, totalInsurance: totInsurance,
      totalFees, totalCost: totI + totalFees, totalPaid: P + totI + totalFees,
      netReceived: P - upfront, dae
    };
  }

  // Monthly internal rate of return: net = Σ cf_k / (1+r)^k. Bisection, robust for all normal offers.
  function solveIRR(net, cfs) {
    if (!(net > 0) || !cfs.length) return null;
    const f = r => { let s = -net, d = 1; for (let k = 0; k < cfs.length; k++) { d /= (1 + r); s += cfs[k] * d; } return s; };
    let lo = -0.0099, hi = 0.05;
    if (f(lo) < 0) return lo;
    let guard = 0;
    while (f(hi) > 0 && guard++ < 60) hi *= 2;
    if (f(hi) > 0) return null;
    for (let k = 0; k < 220; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; if (hi - lo < 1e-13) break; }
    return (lo + hi) / 2;
  }

  /**
   * Compares offers on the same amount. Returns each result, the cheapest, and
   * an exact explanation of why the cheapest costs less than a reference offer:
   * the difference split into interest, upfront fee, monthly fees and insurance.
   */
  function compare(offers, principal, months) {
    const res = offers.map(o => loan(o, principal, months));
    if (!offers.length) return { res, best: -1 };
    let best = 0;
    res.forEach((r, k) => { if (r.totalCost < res[best].totalCost - 1e-9) best = k; });
    const terms = new Set(res.map(r => r.n));
    return { res, best, sameTerm: terms.size === 1 };
  }

  function whyCheaper(offers, res, bestIdx, refIdx) {
    const a = res[bestIdx], b = res[refIdx], oa = offers[bestIdx], ob = offers[refIdx];
    const parts = [
      { key: 'interest', label: 'dobândă', a: a.totalInterest, b: b.totalInterest },
      { key: 'upfront', label: 'comision de acordare', a: a.upfront, b: b.upfront },
      { key: 'monthly', label: 'comisioane lunare', a: a.totalMonthlyFees, b: b.totalMonthlyFees },
      { key: 'insurance', label: 'asigurare', a: a.totalInsurance, b: b.totalInsurance },
    ].map(p => ({ ...p, diff: p.b - p.a }));
    const total = b.totalCost - a.totalCost;
    const reasons = [];
    for (const p of parts.slice().sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))) {
      if (Math.abs(p.diff) < 0.5) continue;
      reasons.push(p);
    }
    const warnings = [];
    if (a.n !== b.n) warnings.push({ key: 'term', text: 'Perioadele sunt diferite, deci costurile totale nu se compară direct.' });
    for (const [o, r] of [[oa, a], [ob, b]]) {
      if (o.rateType === 'variabila') warnings.push({ key: 'var-' + (o.lender || ''), text: `${o.lender || 'O ofertă'} are dobândă variabilă: rata poate crește pe parcurs.` });
      if (o.type === 'desc') warnings.push({ key: 'desc-' + (o.lender || ''), text: `${o.lender || 'O ofertă'} are rate descrescătoare: prima rată e cea mai mare.` });
    }
    return { total, parts, reasons, warnings, monthlyDiff: b.firstPayment - a.firstPayment };
  }

  /* ---- savings --------------------------------------------------------- */
  // Future value of equal end-of-month deposits plus an initial amount, interest compounded monthly.
  function savings(monthly, months, annualRatePct = 0, initial = 0) {
    const i = num(annualRatePct) / 100 / 12; let b = num(initial);
    for (let k = 0; k < months; k++) b = b * (1 + i) + num(monthly);
    const deposited = num(initial) + num(monthly) * months;
    return { final: b, deposited, interest: b - deposited };
  }

  const DAY = 864e5;
  const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / DAY);
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const MONTH_DAYS = 30.4375;

  /**
   * Is the goal realistic? capacityPerMonth = what the user actually manages to save
   * (from the monthly plan or the last deposits). Options are exact for that capacity.
   */
  function goalCheck({ target, saved, deadline, today, capacityPerMonth }) {
    const left = Math.max(0, num(target) - num(saved));
    if (left <= 0) return { status: 'done', left: 0 };
    const days = deadline ? dayDiff(today, deadline) + 1 : null;
    const cap = Math.max(0, num(capacityPerMonth));
    const out = { left, days, capacity: cap };
    if (days != null && days > 0) {
      out.perDay = left / days;
      out.perMonth = left / (days / MONTH_DAYS);
    }
    if (days != null && days <= 0) { out.status = 'expired'; }
    else if (days == null) { out.status = cap > 0 ? 'nodeadline' : 'unknown'; }
    else if (cap <= 0) { out.status = 'unknown'; }
    else out.status = out.perMonth > cap * 1.0001 ? 'hard' : out.perMonth > cap * 0.8 ? 'tight' : 'ok';
    if (cap > 0) {
      const monthsNeeded = left / cap;
      out.monthsNeeded = monthsNeeded;
      out.reachDate = addDays(today, Math.ceil(monthsNeeded * MONTH_DAYS) - 1);
      if (days != null && days > 0) out.reachableByDeadline = num(saved) + cap * (days / MONTH_DAYS);
    }
    return out;
  }

  /* ---- monthly plan ----------------------------------------------------- */
  const sum = a => (a || []).reduce((s, x) => s + Math.max(0, num(x.amount)), 0);
  function plan(p) {
    const income = sum(p.income), essentials = sum(p.essentials), credits = sum(p.credits), other = sum(p.other);
    const afterEssentials = income - essentials - credits;
    const canSave = afterEssentials - other;
    const base = essentials + credits;
    return {
      income, essentials, credits, other, afterEssentials, canSave,
      savingsRate: income > 0 ? canSave / income : null,
      creditShare: income > 0 ? credits / income : null,
      emergencyMin: base * 3, emergencyMax: base * 6
    };
  }

  /** An unexpected expense: what the emergency fund covers and how long the rest takes to rebuild. */
  function unexpected({ amount, fund, monthlySavings }) {
    const A = Math.max(0, num(amount)), F = Math.max(0, num(fund)), S = num(monthlySavings);
    const fromFund = Math.min(A, F), rest = A - fromFund;
    const out = { amount: A, fromFund, rest, fundLeft: F - fromFund };
    if (rest <= 0) { out.months = 0; out.covered = true; }
    else if (S > 0) { out.months = Math.ceil(rest / S - 1e-9); out.covered = true; out.perMonth = S; out.lastMonth = rest - S * (out.months - 1); }
    else { out.months = null; out.covered = false; }
    // rebuilding the fund afterwards
    out.rebuildMonths = S > 0 ? Math.ceil((fromFund) / S - 1e-9) : null;
    return out;
  }

  function budgetState(planned, actual) {
    const p = num(planned), a = num(actual);
    if (!(p > 0)) return { ratio: null, state: a > 0 ? 'unplanned' : 'none', over: 0 };
    const ratio = a / p;
    return { ratio, state: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok', over: Math.max(0, a - p), left: Math.max(0, p - a) };
  }

  /* ---- challenges --------------------------------------------------------- */
  function challengeAmounts(type, days, step, fixed, seed) {
    if (type === 'fix' || type === 'fara') return Array.from({ length: days }, () => r2(fixed));
    const a = Array.from({ length: days }, (_, k) => r2(step * (k + 1)));
    if (type === 'plicuri') {
      let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
    }
    return a;
  }
  // done: {dayIndex: …}; today: index of today (0-based). Returns current streak, best streak, missed days so far.
  function streaks(done, todayIdx, days) {
    const last = Math.min(todayIdx, days - 1);
    let best = 0, run = 0, missed = 0;
    for (let k = 0; k <= last; k++) {
      if (done[k]) { run++; best = Math.max(best, run); }
      else { if (k < todayIdx) missed++; run = k === todayIdx ? run : 0; }
    }
    let cur = 0;
    for (let k = last; k >= 0; k--) { if (done[k]) cur++; else if (k === todayIdx) continue; else break; }
    return { current: cur, best, missed };
  }

  return { r2, annuityPayment, loan, solveIRR, compare, whyCheaper, savings, goalCheck, plan, unexpected, budgetState, challengeAmounts, streaks, dayDiff, addDays, MONTH_DAYS };
})();
if (typeof module !== 'undefined') module.exports = FinCalc;
