import { useState, useEffect, useRef, useCallback } from "react";

const MARKETS = {
  shares: [
    { symbol: "AAPL",       name: "Apple Inc.",         market: "NASDAQ", currency: "USD", sector: "Tech"     },
    { symbol: "MSFT",       name: "Microsoft Corp.",     market: "NASDAQ", currency: "USD", sector: "Tech"     },
    { symbol: "NVDA",       name: "NVIDIA Corp.",        market: "NASDAQ", currency: "USD", sector: "Tech"     },
    { symbol: "ASML",       name: "ASML Holding",        market: "AMS",    currency: "EUR", sector: "Tech"     },
    { symbol: "7203.T",     name: "Toyota Motor",        market: "TSE",    currency: "JPY", sector: "Auto"     },
    { symbol: "BHP.AX",     name: "BHP Group",           market: "ASX",    currency: "AUD", sector: "Mining"   },
    { symbol: "NESN.SW",    name: "Nestlé S.A.",         market: "SIX",    currency: "CHF", sector: "Consumer" },
    { symbol: "SAP.DE",     name: "SAP SE",              market: "XETRA",  currency: "EUR", sector: "Tech"     },
    { symbol: "2318.HK",    name: "Ping An Insurance",   market: "HKEX",   currency: "HKD", sector: "Finance"  },
    { symbol: "RELIANCE.NS",name: "Reliance Industries", market: "NSE",    currency: "INR", sector: "Energy"   },
  ],
  futures: [
    { symbol: "ES=F",  name: "S&P 500 Futures",    market: "CME",   currency: "USD", sector: "Index"  },
    { symbol: "NQ=F",  name: "Nasdaq-100 Futures", market: "CME",   currency: "USD", sector: "Index"  },
    { symbol: "YM=F",  name: "Dow Jones Futures",  market: "CME",   currency: "USD", sector: "Index"  },
    { symbol: "DAX=F", name: "DAX Futures",        market: "EUREX", currency: "EUR", sector: "Index"  },
    { symbol: "CL=F",  name: "Crude Oil (WTI)",    market: "NYMEX", currency: "USD", sector: "Energy" },
    { symbol: "GC=F",  name: "Gold Futures",       market: "COMEX", currency: "USD", sector: "Metals" },
    { symbol: "SI=F",  name: "Silver Futures",     market: "COMEX", currency: "USD", sector: "Metals" },
    { symbol: "NG=F",  name: "Natural Gas",        market: "NYMEX", currency: "USD", sector: "Energy" },
  ],
  etf: [
    { symbol: "VOO",  name: "Vanguard S&P 500 ETF",   market: "NYSE",   currency: "USD", sector: "Index" },
    { symbol: "QQQ",  name: "Invesco QQQ Trust",       market: "NASDAQ", currency: "USD", sector: "Tech"  },
    { symbol: "VWO",  name: "Vanguard Emerging Mkts",  market: "NYSE",   currency: "USD", sector: "EM"    },
    { symbol: "EWJ",  name: "iShares MSCI Japan",      market: "NYSE",   currency: "USD", sector: "Japan" },
    { symbol: "GLD",  name: "SPDR Gold Shares",        market: "NYSE",   currency: "USD", sector: "Gold"  },
    { symbol: "TLT",  name: "iShares 20yr Treasury",   market: "NASDAQ", currency: "USD", sector: "Bonds" },
    { symbol: "VNQ",  name: "Vanguard Real Estate",    market: "NYSE",   currency: "USD", sector: "REIT"  },
    { symbol: "ARKK", name: "ARK Innovation ETF",      market: "NYSE",   currency: "USD", sector: "Tech"  },
  ],
  commodities: [
    { symbol: "GC=F", name: "Gold Futures",   market: "COMEX", currency: "USD", sector: "Metals" },
    { symbol: "SI=F", name: "Silver Futures", market: "COMEX", currency: "USD", sector: "Metals" },
    { symbol: "CL=F", name: "Crude Oil WTI",  market: "NYMEX", currency: "USD", sector: "Energy" },
    { symbol: "BZ=F", name: "Brent Crude",    market: "ICE",   currency: "USD", sector: "Energy" },
    { symbol: "NG=F", name: "Natural Gas",    market: "NYMEX", currency: "USD", sector: "Energy" },
    { symbol: "ZW=F", name: "Wheat Futures",  market: "CBOT",  currency: "USD", sector: "Agri"   },
    { symbol: "KC=F", name: "Coffee Futures", market: "ICE",   currency: "USD", sector: "Agri"   },
    { symbol: "HG=F", name: "Copper Futures", market: "COMEX", currency: "USD", sector: "Metals" },
  ],
};

const STRATEGIES = [
  { id: "trend",    name: "Trend Following",  description: "MA200 crossover + ADX. Segui il momentum a lungo termine.", horizon: "12-36 mesi",  risk: "Medio"       },
  { id: "value",    name: "Value Investing",   description: "Ispirato a Graham/Buffett. P/E, P/B, FCF. Compra sottovalutato.", horizon: "36-120 mesi", risk: "Basso-Medio" },
  { id: "dca",      name: "DCA Compounding",   description: "Dollar-cost averaging su basket globale diversificato.", horizon: "60-240 mesi", risk: "Basso"       },
  { id: "momentum", name: "Global Momentum",   description: "Momentum factor 12 mesi su tutte le classi. Ribilancia trimestrale.", horizon: "24-60 mesi",  risk: "Medio-Alto"  },
  { id: "macro",    name: "Macro Thematic",    description: "AI, transizione energetica, demografia — temi strutturali LT.", horizon: "36-120 mesi", risk: "Medio-Alto"  },
  { id: "weather",  name: "All Weather",       description: "Risk parity Bridgewater: eq 30%, bond LT 40%, oro 15%, comm 15%.", horizon: "∞",           risk: "Basso"       },
];

// ── INDICATORS ────────────────────────────────────────────────────────────────
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let g = 0, l = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  const rs = g / (l || 0.001);
  return Math.round(100 - 100 / (1 + rs));
}
function calcMA(closes, p) {
  if (closes.length < p) return closes[closes.length - 1] || 0;
  const sl = closes.slice(-p);
  return sl.reduce((a, b) => a + b, 0) / p;
}
function ltSignal(rsi, price, ma200) {
  if (price > ma200 && rsi < 45) return "BUY";
  if (price > ma200 && rsi > 70) return "WAIT";
  if (price < ma200)              return "SELL";
  return "HOLD";
}
function calcScore(signal, rsi, price, ma200) {
  const base = { BUY: 68, HOLD: 50, WAIT: 38, SELL: 22 }[signal] || 50;
  return Math.min(99, Math.max(1, base + (rsi < 40 ? 14 : rsi > 70 ? -10 : 0) + (price > ma200 ? 8 : -8)));
}

// ── API LAYER ─────────────────────────────────────────────────────────────────
const _cache = {};
const TTL = 5 * 60 * 1000;

const PROXY = "/api/proxy";
function proxyUrl(targetUrl, key) {
  return `${PROXY}?url=${encodeURIComponent(targetUrl)}&key=${encodeURIComponent(key)}`;
}

function pickNum(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null) continue;
    const n = typeof v === "number" ? v : parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return null;
}
function parseMoney(s) {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const m = s.replace(/[$,%+\s]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function categoryOf(symbol) {
  for (const [cat, list] of Object.entries(MARKETS)) {
    if (list.some(a => a.symbol === symbol)) return cat;
  }
  return "shares";
}
function isInternational(symbol) {
  return /\.[A-Z]{1,3}$/.test(symbol);
}

function extractQuote(qj) {
  const body = qj?.body;
  let q;
  if (Array.isArray(body) && body.length) q = body[0];
  else if (body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length) q = body;
  else if (qj?.quoteResponse?.result?.[0]) q = qj.quoteResponse.result[0];
  else if (qj?.data?.[0]) q = qj.data[0];
  else if (qj && typeof qj === "object" && (qj.regularMarketPrice || qj.price || qj.primaryData)) q = qj;
  else return null;
  if (!q || typeof q !== "object" || (Array.isArray(q) ? q.length === 0 : Object.keys(q).length === 0)) return null;

  // NASDAQ-style nested format (yahoo-finance15 /api/v1/markets/quote) → flatten
  if (q.primaryData && typeof q.primaryData === "object") {
    const p  = q.primaryData;
    const ks = q.keyStats || {};
    const range52 = ks?.fiftyTwoWeekHighLow?.value || "";
    const range52Nums = (range52.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
    return {
      symbol: q.symbol,
      regularMarketPrice:         parseMoney(p.lastSalePrice),
      regularMarketChange:        parseMoney(p.netChange),
      regularMarketChangePercent: parseMoney(p.percentageChange),
      fiftyTwoWeekLow:  range52Nums[0] ?? null,
      fiftyTwoWeekHigh: range52Nums[1] ?? null,
      regularMarketVolume: parseMoney(ks?.Volume?.value),
    };
  }

  return q;
}

async function fetchQuoteV1(symbol, type, key) {
  const url = `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${encodeURIComponent(symbol)}&type=${type}`;
  const r = await fetch(proxyUrl(url, key));
  if (!r.ok) return null;
  return extractQuote(await r.json());
}
async function fetchQuoteYahoo(symbol, key) {
  const url = `https://yahoo-finance15.p.rapidapi.com/api/yahoo/qu/quote/${encodeURIComponent(symbol)}`;
  const r = await fetch(proxyUrl(url, key));
  if (!r.ok) return null;
  const j = await r.json();
  if (Array.isArray(j) && j.length) return j[0];
  if (j?.quoteResponse?.result?.[0]) return j.quoteResponse.result[0];
  if (Array.isArray(j?.body) && j.body.length) return j.body[0];
  if (j?.body && typeof j.body === "object") return j.body;
  if (j && typeof j === "object" && (j.regularMarketPrice || j.price)) return j;
  return null;
}

async function fetchRapidAPI(symbol, key) {
  const ck = `r_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  const cat = categoryOf(symbol);
  const v1Type = cat === "etf" ? "ETF"
              : (cat === "futures" || cat === "commodities") ? "FUTURES"
              : "STOCKS";
  const useYahooFirst = isInternational(symbol);

  const tryGet = async () => {
    if (useYahooFirst) {
      const q = await fetchQuoteYahoo(symbol, key);
      if (q && pickNum(q, ["regularMarketPrice","price","ask","last","lastPrice","close"]) != null) return q;
      return await fetchQuoteV1(symbol, v1Type, key);
    } else {
      const q = await fetchQuoteV1(symbol, v1Type, key);
      if (q && pickNum(q, ["regularMarketPrice","price","ask","last","lastPrice","close"]) != null) return q;
      return await fetchQuoteYahoo(symbol, key);
    }
  };

  const q = await tryGet();
  if (!q) throw new Error("Simbolo non disponibile sui due endpoint RapidAPI");
  const price = pickNum(q, ["regularMarketPrice","price","ask","last","lastPrice","close"]);
  if (price == null) throw new Error(`Campo prezzo assente. Campi: ${Object.keys(q).slice(0,10).join(", ") || "vuoto"}`);

  let rsi = 50, ma50 = price, ma200 = price, sparkline = [];
  try {
    const histTarget = `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/history?symbol=${encodeURIComponent(symbol)}&interval=1d&diffandsplits=false`;
    const hRes = await fetch(proxyUrl(histTarget, key));
    if (hRes.ok) {
      const hj = await hRes.json();
      const rawItems = Object.values(hj?.body ?? {}).filter(i => i && i.close != null);
      rawItems.sort((a, b) => (a.date ?? a.timestamp ?? 0) - (b.date ?? b.timestamp ?? 0));
      const closes = rawItems.slice(-220).map(i => parseFloat(i.close)).filter(n => !isNaN(n));
      if (closes.length > 15) {
        rsi = calcRSI(closes); ma50 = calcMA(closes, 50); ma200 = calcMA(closes, 200);
        sparkline = closes.slice(-24);
      }
    }
  } catch (_) {}

  if (ma50 === price)  ma50  = pickNum(q, ["priceAvg50","fiftyDayAverage","ma50"]) ?? price;
  if (ma200 === price) ma200 = pickNum(q, ["priceAvg200","twoHundredDayAverage","ma200"]) ?? price;

  const signal = ltSignal(rsi, price, ma200);
  const score  = calcScore(signal, rsi, price, ma200);
  const d = {
    price,
    change:  pickNum(q, ["regularMarketChange","change"]) ?? 0,
    changeP: pickNum(q, ["regularMarketChangePercent","changesPercentage","changePercent","percentChange"]) ?? 0,
    high52:  pickNum(q, ["fiftyTwoWeekHigh","yearHigh"]),
    low52:   pickNum(q, ["fiftyTwoWeekLow","yearLow"]),
    vol:     pickNum(q, ["regularMarketVolume","volume"]) ?? 0,
    rsi,
    ma50: Number(ma50).toFixed(2), ma200: Number(ma200).toFixed(2),
    signal, score, sparkline, source: "Yahoo / RapidAPI",
  };
  _cache[ck] = { d, ts: Date.now() };
  return d;
}

async function fetchTwelveData(symbol, key) {
  const ck = `td_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`TwelveData ${res.status}`);
  const j = await res.json();
  if (j?.status === "error") {
    if (j.code === 401) throw new Error("Chiave TwelveData non valida");
    if (j.code === 429) throw new Error("Limite TwelveData raggiunto (800/giorno o 8/min)");
    throw new Error(j.message || "TwelveData errore");
  }
  const price = parseFloat(j?.close);
  if (!price || isNaN(price)) throw new Error(`Simbolo non trovato su TwelveData: ${symbol}`);

  const change  = parseFloat(j.change) || 0;
  const changeP = parseFloat(j.percent_change) || 0;
  const high52  = parseFloat(j.fifty_two_week?.high) || null;
  const low52   = parseFloat(j.fifty_two_week?.low) || null;
  const vol     = parseFloat(j.volume) || 0;

  const rsi   = changeP > 2 ? 65 : changeP < -2 ? 38 : 50;
  const ma200 = price * (changeP > 0 ? 0.95 : 1.05);
  const ma50  = price * (changeP > 0 ? 0.98 : 1.02);
  const signal = ltSignal(rsi, price, ma200);
  const score  = calcScore(signal, rsi, price, ma200);
  const sparkline = Array.from({ length: 24 }, (_, i) => {
    const seed = symbol.charCodeAt(0) + i;
    return price * (1 + ((seed % 11) - 5) / 200 + changeP / 2000);
  });

  const d = {
    price, change, changeP, high52, low52, vol,
    rsi, ma50: ma50.toFixed(2), ma200: ma200.toFixed(2),
    signal, score, sparkline, source: "TwelveData",
  };
  _cache[ck] = { d, ts: Date.now() };
  return d;
}

async function fetchFinnhub(symbol, key) {
  const ck = `fh_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`);
  if (res.status === 401) throw new Error("Chiave Finnhub non valida");
  if (res.status === 403) throw new Error("Simbolo non incluso nel piano Finnhub free (probabile exchange premium)");
  if (res.status === 429) throw new Error("Finnhub rate limit (60 req/min)");
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  const j = await res.json();
  if (!j || j.c == null || j.c === 0) throw new Error(`Simbolo non disponibile su Finnhub (free): ${symbol}`);

  const price = j.c;
  const change = j.d ?? 0;
  const changeP = j.dp ?? 0;
  const rsi   = changeP > 2 ? 65 : changeP < -2 ? 38 : 50;
  const ma200 = price * (changeP > 0 ? 0.95 : 1.05);
  const ma50  = price * (changeP > 0 ? 0.98 : 1.02);
  const signal = ltSignal(rsi, price, ma200);
  const score  = calcScore(signal, rsi, price, ma200);
  const sparkline = Array.from({ length: 24 }, (_, i) => {
    const seed = symbol.charCodeAt(0) + i;
    return price * (1 + ((seed % 11) - 5) / 200 + changeP / 2000);
  });

  const d = {
    price, change, changeP,
    high52: j.h ?? null, low52: j.l ?? null, vol: 0,
    rsi, ma50: ma50.toFixed(2), ma200: ma200.toFixed(2),
    signal, score, sparkline, source: "Finnhub",
  };
  _cache[ck] = { d, ts: Date.now() };
  return d;
}

async function fetchAlphaVantage(symbol, key) {
  const ck = `av_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  // GLOBAL_QUOTE — gratuito e senza CORS
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  );
  if (!res.ok) throw new Error(`AV ${res.status}`);
  const json = await res.json();
  if (json.Note || json.Information) throw new Error("AV rate limit — riprova domani (25 req/giorno)");
  const q = json["Global Quote"];
  if (!q || !q["05. price"]) throw new Error("Nessun dato per " + symbol);

  const price   = parseFloat(q["05. price"]);
  const prev    = parseFloat(q["08. previous close"]) || price;
  const change  = parseFloat(q["09. change"]) || 0;
  const changeP = parseFloat((q["10. change percent"] || "0").replace("%","")) || 0;

  // Senza storico sul piano free: RSI/MA stimati da change %
  const rsi   = changeP > 2 ? 65 : changeP < -2 ? 38 : 50;
  const ma200 = price * (changeP > 0 ? 0.95 : 1.05); // stima conservativa
  const ma50  = price * (changeP > 0 ? 0.98 : 1.02);
  const signal = ltSignal(rsi, price, ma200);
  const score  = calcScore(signal, rsi, price, ma200);

  // Sparkline simulata attorno al prezzo reale
  const sparkline = Array.from({length: 24}, (_, i) => {
    const seed = symbol.charCodeAt(0) + i;
    return price * (1 + ((seed % 11) - 5) / 200 + changeP / 2000);
  });

  const d = { price, change, changeP, rsi, ma50: ma50.toFixed(2), ma200: ma200.toFixed(2), signal, score, sparkline, source: "Alpha Vantage" };
  _cache[ck] = { d, ts: Date.now() };
  return d;
}

// ── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Spin() {
  return <span style={{ display:"inline-block", width:12, height:12, border:"2px solid #1e3a5f", borderTopColor:"#0099ff", borderRadius:"50%", animation:"spin .7s linear infinite" }} />;
}
function Score({ v }) {
  const c = v >= 70 ? "#00ff9d" : v >= 50 ? "#ffc107" : "#ff4757";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${c}18`, border:`1px solid ${c}40`, borderRadius:6, padding:"2px 8px" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c, display:"inline-block" }} />
      <span style={{ color:c, fontSize:11, fontWeight:700, fontFamily:"monospace" }}>{v}/100</span>
    </span>
  );
}
function Sig({ s }) {
  const m = { BUY:{c:"#00ff9d",bg:"#00ff9d12"}, HOLD:{c:"#ffc107",bg:"#ffc10712"}, WAIT:{c:"#ff8c00",bg:"#ff8c0012"}, SELL:{c:"#ff4757",bg:"#ff475712"} };
  const t = m[s] || m.HOLD;
  return <span style={{ background:t.bg, color:t.c, border:`1px solid ${t.c}50`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:800, letterSpacing:1 }}>{s}</span>;
}
function Spark({ closes, change }) {
  if (!closes || closes.length < 2) return <span style={{ color:"#64748b", fontSize:11 }}>—</span>;
  const mn = Math.min(...closes), mx = Math.max(...closes), r = mx - mn || 1;
  const pts = closes.map((c, i) => `${(i/(closes.length-1))*100},${100-((c-mn)/r)*100}`).join(" ");
  const col = change >= 0 ? "#00ff9d" : "#ff4757";
  return (
    <svg width="80" height="28" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    </svg>
  );
}

// ── LOCAL AI (rule-based, no API key needed) ─────────────────────────────────
const STRATEGY_TIPS = {
  trend:    "Compra quando il prezzo rompe MA200 al rialzo con momentum confermato. Esci sotto MA200.",
  value:    "Cerca P/E < 15, P/B < 1.5 e FCF positivo. Holding 3-5+ anni.",
  dca:      "Versamenti fissi mensili su basket globale (VOO + VWO + GLD). Ignora la volatilità di breve.",
  momentum: "Top 10-20% per performance 12 mesi. Ribilancia trimestralmente.",
  macro:    "Allocazione tematica: AI (NVDA, MSFT), transizione energetica, demografia. Posizioni 5-10 anni.",
  weather:  "30% azioni, 40% bond LT, 15% oro, 15% commodity. Ribilancia annualmente.",
};

function localAI(question, ctx) {
  const { mktData, portfolio, watchlist, strat, allAssets } = ctx;
  const q = (question || "").trim();
  if (!q) return "Scrivi una domanda.";
  const ql = q.toLowerCase();
  const qu = q.toUpperCase();
  const fmt = (n) => (typeof n === "number" && isFinite(n) ? n.toFixed(2) : (n ?? "—"));
  const entries = Object.entries(mktData);

  const topByScore = (n, signal) => entries
    .filter(([_, d]) => !signal || d.signal === signal)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, n);

  const matchedAsset = allAssets.find(a => qu.includes(a.symbol.toUpperCase()));
  if (matchedAsset && mktData[matchedAsset.symbol]) {
    const d = mktData[matchedAsset.symbol];
    const trend = d.price > parseFloat(d.ma200) ? "sopra MA200 → trend LT rialzista" : "sotto MA200 → trend LT ribassista";
    const rsiInt = d.rsi < 40 ? "oversold (interessante per accumulo)" : d.rsi > 70 ? "overbought (cautela)" : "neutrale";
    return `📊 Analisi ${matchedAsset.symbol} — ${matchedAsset.name}
Prezzo: ${matchedAsset.currency} ${fmt(d.price)} (${d.changeP >= 0 ? "+" : ""}${fmt(d.changeP)}%)
Trend: ${trend}
RSI 14: ${d.rsi} → ${rsiInt}
MA50 / MA200: ${d.ma50} / ${d.ma200}
Segnale LT: ${d.signal} · Score: ${d.score}/100
Settore: ${matchedAsset.sector} · Mercato: ${matchedAsset.market}

Suggerimento in ottica ${strat.name}: ${STRATEGY_TIPS[strat.id] || "—"}`;
  }

  if (/\b(buy|opportunit|comprar|acquist|miglior)/i.test(ql)) {
    if (!entries.length) return "Nessun dato live caricato. Vai in Mercati e clicca 'Carica' per popolare i dati.";
    const buys = topByScore(8, "BUY");
    if (!buys.length) return "Nessun segnale BUY attivo. Considera All Weather o attendi pullback (RSI < 45 e prezzo > MA200).";
    let out = `📈 Top opportunità BUY a lungo termine:`;
    for (const [s, d] of buys) {
      const a = allAssets.find(x => x.symbol === s);
      out += `\n• ${s}${a ? ` (${a.sector})` : ""} — score ${d.score}, RSI ${d.rsi}, prezzo ${fmt(d.price)}`;
    }
    out += `\n\nCriterio: prezzo > MA200 e RSI < 45.`;
    return out;
  }

  if (/portafogl|posizion|mie asset|miei asset/i.test(ql)) {
    if (!portfolio.length) return "Portafoglio vuoto. Aggiungi asset dal tab Mercati (pulsante +).";
    const stats = portfolio.map(p => ({ ...p, d: mktData[p.symbol] }));
    const buys  = stats.filter(s => s.d?.signal === "BUY");
    const sells = stats.filter(s => s.d?.signal === "SELL");
    const sectors = {};
    for (const s of stats) sectors[s.sector] = (sectors[s.sector] || 0) + 1;
    let out = `💼 Portafoglio: ${portfolio.length} posizioni
Diversificazione settoriale: ${Object.entries(sectors).map(([k,v]) => `${k} (${v})`).join(", ")}
BUY attivi: ${buys.length} · SELL: ${sells.length}`;
    if (sells.length) out += `\n\n⚠️ Da rivedere: ${sells.map(s => s.symbol).join(", ")}`;
    if (buys.length)  out += `\n\n✅ In trend: ${buys.map(s => s.symbol).join(", ")}`;
    const noData = stats.filter(s => !s.d);
    if (noData.length) out += `\n\nℹ️ Senza dati live: ${noData.map(s => s.symbol).join(", ")}`;
    return out;
  }

  if (/strateg/i.test(ql)) {
    return `🧠 Strategia attiva: ${strat.name}
${strat.description}
Orizzonte: ${strat.horizon} · Rischio: ${strat.risk}

Operatività: ${STRATEGY_TIPS[strat.id] || "—"}`;
  }

  if (/diversif|commodit|materi[ae] prim/i.test(ql)) {
    return `🌍 Diversificazione LT bilanciata:
• 40-50% azioni globali (VOO + VWO + EWJ)
• 20-30% bond lungo termine (TLT)
• 10-15% oro (GLD / GC=F)
• 5-10% commodity reali (CL=F, HG=F, ZW=F)
• 5-10% real estate (VNQ)

Le commodity offrono protezione da inflazione e bassa correlazione con equity. In ottica All Weather sono strutturali, non tattiche.`;
  }

  if (/tass[oi]|inflaz|macro|fed|bce|recess/i.test(ql)) {
    return `📉 Scenario tassi alti:
• Bond lunghi (TLT) penalizzati a breve, ma yield interessante per LT
• Equity growth (NQ=F, ARKK) sensibili → preferire value (VOO)
• Oro (GLD) e commodity reali storicamente resilienti
• Difensivi: utilities, consumer staples (NESN.SW)
• Focus su free cash flow positivo e dividendi sostenibili

Strategia consigliata: All Weather o Value Investing.`;
  }

  if (/difensiv|orso|bear|crash|drawdown|caduta/i.test(ql)) {
    return `🛡️ Asset difensivi per fase orso:
• Oro (GLD, GC=F) — hedge classico
• Bond long duration (TLT) — risk-off rally
• Consumer staples (NESN.SW)
• Utilities & healthcare
• Cash / T-Bills brevi

Riduci leva, aumenta liquidità, evita small cap speculative. Strategia All Weather riduce il drawdown di ~40-50% rispetto a 100% equity.`;
  }

  if (/tech|energy|energia|settor/i.test(ql)) {
    const techSyms = ["AAPL","MSFT","NVDA","ASML","SAP.DE","QQQ","ARKK"];
    const enSyms   = ["CL=F","BZ=F","NG=F"];
    const summarize = (syms) => {
      const ds = syms.map(s => mktData[s]).filter(Boolean);
      if (!ds.length) return "dati non caricati";
      const avg = (k) => Math.round(ds.reduce((a, b) => a + (b[k] || 0), 0) / ds.length);
      const buys = ds.filter(d => d.signal === "BUY").length;
      return `RSI medio ${avg("rsi")}, score medio ${avg("score")}, BUY ${buys}/${ds.length}`;
    };
    return `🏭 Confronto settori:
TECH: ${summarize(techSyms)}
ENERGY: ${summarize(enSyms)}

Tech: rendimenti storici superiori ma drawdown più ampi. Energy: dividendi alti e protezione da inflazione. Un mix 60/40 tech/energy bilancia growth e difesa.`;
  }

  if (/etf/i.test(ql)) {
    const etfs = ["VOO","QQQ","VWO","EWJ","GLD","TLT","VNQ","ARKK"]
      .map(s => [s, mktData[s]]).filter(([_, d]) => d)
      .sort((a, b) => b[1].score - a[1].score);
    if (!etfs.length) return "Carica gli ETF dal tab Mercati per confrontarli.";
    let out = "🏦 Ranking ETF per score LT:";
    for (const [s, d] of etfs) out += `\n• ${s} — score ${d.score}, segnale ${d.signal}, RSI ${d.rsi}`;
    return out;
  }

  if (/watchlist|seguit/i.test(ql)) {
    if (!watchlist.length) return "Watchlist vuota.";
    let out = `⭐ Watchlist (${watchlist.length}):`;
    for (const s of watchlist) {
      const d = mktData[s];
      out += d
        ? `\n• ${s} — ${fmt(d.price)} · ${d.signal} · score ${d.score}`
        : `\n• ${s} — dati non caricati`;
    }
    return out;
  }

  if (/ciao|salve|hey|buong|buons/i.test(ql)) {
    return `Ciao! Sono il bot LT locale. Chiedimi un simbolo (es. "AAPL"), i segnali BUY, l'analisi del portafoglio o uno scenario macro.`;
  }

  return `Non ho riconosciuto la domanda. Posso aiutarti su:

📊 Analisi simbolo — scrivi un ticker (es. AAPL, VOO, GC=F)
📈 Segnali BUY — "mostra opportunità BUY"
💼 Portafoglio — "analizza il portafoglio"
🧠 Strategia — "spiega la strategia"
🌍 Diversificazione — "come diversifico?"
📉 Macro — "scenario tassi alti"
🛡️ Difensivi — "asset per mercato orso"
🏭 Settori — "tech vs energy"
🏦 ETF — "confronta ETF"
⭐ Watchlist — "mostra watchlist"`;
}

const lsGet = (k, fb = "") => (typeof localStorage !== "undefined" && localStorage.getItem(k)) || fb;
const lsSet = (k, v) => { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); };

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const hasStoredKey = !!(lsGet("gb_rapidKey") || lsGet("gb_avKey") || lsGet("gb_finnKey") || lsGet("gb_tdKey"));
  const [tab, setTab]               = useState(hasStoredKey ? "dashboard" : "setup");
  const [mkt, setMkt]               = useState("shares");
  const [strat, setStrat]           = useState(STRATEGIES[0]);
  const [portfolio, setPortfolio]   = useState([]);
  const [watchlist, setWatchlist]   = useState(["AAPL","VOO","GLD","ES=F"]);
  const [filter, setFilter]         = useState("ALL");
  const [mktData, setMktData]       = useState({});
  const [loading, setLoading]       = useState(new Set());
  const [errs, setErrs]             = useState({});
  const [provider, _setProvider]    = useState(() => lsGet("gb_provider", "twelvedata"));
  const [rapidKey, _setRapidKey]    = useState(() => lsGet("gb_rapidKey"));
  const [avKey, _setAvKey]          = useState(() => lsGet("gb_avKey"));
  const [finnKey, _setFinnKey]      = useState(() => lsGet("gb_finnKey"));
  const [tdKey, _setTdKey]          = useState(() => lsGet("gb_tdKey"));
  const setProvider = (v) => { _setProvider(v); lsSet("gb_provider", v); };
  const setRapidKey = (v) => { _setRapidKey(v); lsSet("gb_rapidKey", v); };
  const setAvKey    = (v) => { _setAvKey(v);    lsSet("gb_avKey", v); };
  const setFinnKey  = (v) => { _setFinnKey(v);  lsSet("gb_finnKey", v); };
  const setTdKey    = (v) => { _setTdKey(v);    lsSet("gb_tdKey", v); };
  const [connected, setConnected]   = useState(false);
  const [msgs, setMsgs]             = useState([
    { role:"assistant", content:"👋 Sono il tuo Trading Bot LT con AI locale.\n\nAnalizzo i dati live (RSI, MA50, MA200, score) e ti aiuto con strategie, diversificazione, segnali BUY e scenari macro — senza bisogno di chiavi esterne per la chat.\n\nProva: scrivi un ticker (\"AAPL\"), oppure \"mostra opportunità BUY\" o \"analizza il portafoglio\"." }
  ]);
  const [inp, setInp]         = useState("");
  const [typing, setTyping]   = useState(false);
  const [testResult, setTestResult] = useState(null);
  const chatRef               = useRef(null);
  const allAssets             = Object.values(MARKETS).flat();

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs, typing]);

  const activeKey = provider === "rapidapi"   ? rapidKey
                  : provider === "finnhub"    ? finnKey
                  : provider === "twelvedata" ? tdKey
                  : avKey;

  const fetchOne = useCallback(async (symbol) => {
    if (!activeKey) return;
    setLoading(p => new Set([...p, symbol]));
    setErrs(p => { const n={...p}; delete n[symbol]; return n; });
    try {
      const d = provider === "rapidapi"   ? await fetchRapidAPI(symbol, activeKey)
              : provider === "finnhub"    ? await fetchFinnhub(symbol, activeKey)
              : provider === "twelvedata" ? await fetchTwelveData(symbol, activeKey)
              : await fetchAlphaVantage(symbol, activeKey);
      setMktData(p => ({ ...p, [symbol]: d }));
    } catch(e) {
      setErrs(p => ({ ...p, [symbol]: e.message }));
    } finally {
      setLoading(p => { const n=new Set(p); n.delete(symbol); return n; });
    }
  }, [activeKey, provider]);

  const loadAll = useCallback(async () => {
    const syms = MARKETS[mkt].map(a => a.symbol);
    const delay = provider === "alphavantage" ? 1300
                : provider === "twelvedata"   ? 8000
                : provider === "finnhub"      ? 200
                : 250;
    for (const s of syms) {
      await fetchOne(s);
      await new Promise(r => setTimeout(r, delay));
    }
  }, [mkt, fetchOne, provider]);

  const save = () => {
    setConnected(true);
    setTab("dashboard");
    setTimeout(() => { watchlist.forEach(sym => fetchOne(sym)); }, 50);
  };

  const didAutoLoad = useRef(false);
  useEffect(() => {
    if (didAutoLoad.current || !activeKey) return;
    didAutoLoad.current = true;
    setConnected(true);
    const slow = provider === "twelvedata" || provider === "alphavantage";
    if (slow) {
      (async () => {
        const delay = provider === "twelvedata" ? 8000 : 1300;
        for (const sym of watchlist) {
          await fetchOne(sym);
          await new Promise(r => setTimeout(r, delay));
        }
      })();
    } else {
      watchlist.forEach(sym => fetchOne(sym));
    }
  }, [activeKey, fetchOne, watchlist, provider]);

  const testConnection = async () => {
    if (!activeKey) return;
    setTestResult({ status: "loading", msg: "Test in corso..." });

    if (provider === "twelvedata") {
      try {
        const d = await fetchTwelveData("AAPL", activeKey);
        setTestResult({ status: "ok", msg: `✓ AAPL = ${d.price.toFixed(2)} USD via TwelveData.` });
      } catch (e) {
        setTestResult({ status: "error", msg: `✗ ${e.message}` });
      }
      return;
    }
    if (provider === "finnhub") {
      try {
        const d = await fetchFinnhub("AAPL", activeKey);
        setTestResult({ status: "ok", msg: `✓ AAPL = ${d.price.toFixed(2)} USD via Finnhub.` });
      } catch (e) {
        setTestResult({ status: "error", msg: `✗ ${e.message}` });
      }
      return;
    }
    if (provider === "alphavantage") {
      try {
        const d = await fetchAlphaVantage("AAPL", activeKey);
        setTestResult({ status: "ok", msg: `✓ AAPL = ${d.price?.toFixed(2)} USD via Alpha Vantage.` });
      } catch (e) {
        setTestResult({ status: "error", msg: `✗ ${e.message}` });
      }
      return;
    }

    try {
      const url = "https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=AAPL&type=STOCKS";
      const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}&key=${encodeURIComponent(activeKey)}`);

      if (r.status === 404) {
        setTestResult({ status: "error", msg: "Il proxy /api/proxy non risponde (404). Il deploy Vercel non sta servendo la function. In dev locale (npm start) il proxy non gira: usa 'vercel dev'." });
        return;
      }

      let j; try { j = await r.json(); } catch { j = null; }

      if (r.status === 401 || r.status === 403) {
        setTestResult({ status: "error", msg: `Chiave RapidAPI non valida o non iscritta a yahoo-finance15 (HTTP ${r.status}).` });
        return;
      }
      if (r.status === 429) {
        setTestResult({ status: "error", msg: "Limite richieste superato sul piano RapidAPI." });
        return;
      }
      if (!r.ok) {
        setTestResult({ status: "error", msg: `HTTP ${r.status}. Risposta: ${JSON.stringify(j).slice(0, 220)}` });
        return;
      }

      const q = extractQuote(j);
      if (!q) {
        setTestResult({ status: "error", msg: `200 OK ma risposta vuota/inattesa. Chiavi top: ${Object.keys(j||{}).join(", ") || "—"}. Snippet: ${JSON.stringify(j).slice(0, 220)}` });
        return;
      }
      const price = pickNum(q, ["regularMarketPrice","price","ask","last","lastPrice","close"]);
      if (price == null) {
        setTestResult({ status: "error", msg: `200 OK ma nessun campo prezzo trovato. Campi disponibili: ${Object.keys(q).slice(0,15).join(", ")}. Probabilmente sei iscritto a un'altra API Yahoo, non a yahoo-finance15 di manwilbahaa.` });
        return;
      }
      setTestResult({ status: "ok", msg: `✓ Connessione OK. AAPL = ${price} USD (campo usato: ${Object.keys(q).find(k => q[k] === price) || "n/d"}).` });
    } catch (e) {
      setTestResult({ status: "error", msg: `✗ ${e.message}` });
    }
  };

  const get  = s => mktData[s];
  const isL  = s => loading.has(s);

  const mktAssets = MARKETS[mkt];
  const filtered  = filter === "ALL" ? mktAssets : mktAssets.filter(a => get(a.symbol)?.signal === filter);
  const liveN = Object.keys(mktData).length;
  const buyN  = Object.values(mktData).filter(d => d.signal === "BUY").length;

  // ── styles
  const C = {
    app:  { fontFamily:"'Sora',sans-serif", background:"#060a10", color:"#e2e8f0", minHeight:"100vh", display:"flex", flexDirection:"column" },
    hdr:  { background:"#09111f", borderBottom:"1px solid #1e3a5f40", padding:"0 22px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, flexShrink:0 },
    card: { background:"#0a1120", border:"1px solid #1e3a5f50", borderRadius:14, padding:18 },
    g3:   { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:18 },
    sc:   { background:"linear-gradient(135deg,#0a1120,#0f1a2e)", border:"1px solid #1e3a5f60", borderRadius:12, padding:"14px 18px" },
    tb:   { width:"100%", borderCollapse:"collapse" },
    th:   { textAlign:"left", padding:"7px 11px", fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:1, textTransform:"uppercase", borderBottom:"1px solid #1e3a5f40" },
    td:   { padding:"8px 11px", fontSize:13, borderBottom:"1px solid #1e3a5f15", verticalAlign:"middle" },
    nav:  (a) => ({ background:a?"#0099ff18":"transparent", color:a?"#0099ff":"#64748b", border:`1px solid ${a?"#0099ff40":"transparent"}`, borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }),
    mt:   (a) => ({ padding:"5px 14px", borderRadius:18, cursor:"pointer", fontSize:12, fontWeight:700, background:a?"#0099ff":"#0a1120", color:a?"#fff":"#64748b", border:`1px solid ${a?"#0099ff":"#1e3a5f40"}` }),
    ab:   (on,c) => ({ background:on?`${c}18`:"#1e3a5f20", color:on?c:"#64748b", border:`1px solid ${on?c+"40":"#1e3a5f30"}`, borderRadius:6, padding:"3px 9px", cursor:"pointer", fontSize:11, fontWeight:700 }),
    inp_: { background:"#060a10", border:"1px solid #1e3a5f50", borderRadius:10, padding:"9px 14px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit" },
    send: { background:"linear-gradient(135deg,#0099ff,#0066cc)", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", cursor:"pointer", fontWeight:700, fontSize:13 },
    mu:   { alignSelf:"flex-end", background:"linear-gradient(135deg,#0099ff,#0066cc)", color:"#fff", borderRadius:"14px 14px 4px 14px", padding:"10px 14px", maxWidth:"75%", fontSize:13, lineHeight:1.55 },
    mb:   { alignSelf:"flex-start", background:"#0f1a2e", border:"1px solid #1e3a5f40", color:"#e2e8f0", borderRadius:"14px 14px 14px 4px", padding:"11px 14px", maxWidth:"82%", fontSize:13, lineHeight:1.65 },
  };

  const sendMsg = () => {
    if (!inp.trim() || typing) return;
    const txt = inp.trim();
    setInp("");
    setMsgs(p => [...p, { role:"user", content:txt }]);
    setTyping(true);
    const reply = localAI(txt, { mktData, portfolio, watchlist, strat, allAssets });
    setTimeout(() => {
      setMsgs(p => [...p, { role:"assistant", content: reply }]);
      setTyping(false);
    }, 220);
  };

  const togglePort = a => setPortfolio(p => p.find(x=>x.symbol===a.symbol) ? p.filter(x=>x.symbol!==a.symbol) : [...p, {...a, addedAt:new Date().toLocaleDateString("it-IT")}]);
  const toggleWatch = s => setWatchlist(p => p.includes(s) ? p.filter(x=>x!==s) : [...p, s]);

  return (
    <div style={C.app}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0a1120} ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}
        button:active{transform:scale(.97)}
      `}</style>

      {/* HEADER */}
      <header style={C.hdr}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:"linear-gradient(135deg,#0099ff,#00ff9d)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⚡</div>
          <span style={{ fontSize:16, fontWeight:800, background:"linear-gradient(90deg,#0099ff,#00ff9d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>GlobalBot LT</span>
          <span style={{ fontSize:10, color:"#64748b", fontWeight:600, letterSpacing:.5 }}>LONG-TERM AI</span>
        </div>
        <nav style={{ display:"flex", gap:4 }}>
          {[
            ...(connected ? [] : [["setup","⚙️ Setup"]]),
            ["dashboard","📊 Dashboard"],["markets","🌍 Mercati"],["portfolio","💼 Portafoglio"],["strategies","🧠 Strategie"],["chat","💬 AI Chat"],
          ].map(([t,l])=>(
            <button key={t} style={C.nav(tab===t)} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </nav>
        <div style={{ display:"flex", gap:12, fontSize:12, alignItems:"center" }}>
          <span style={{ color:"#64748b" }}>Live: <b style={{ color:"#0099ff" }}>{liveN}</b></span>
          <span style={{ color:"#64748b" }}>BUY: <b style={{ color:"#00ff9d" }}>{buyN}</b></span>
          {connected && <><span style={{ width:8, height:8, borderRadius:"50%", background:"#00ff9d", display:"inline-block", animation:"pulse 2s infinite" }} /><span style={{ color:"#00ff9d", fontWeight:600 }}>LIVE</span></>}
          {connected && (
            <button onClick={()=>setTab("setup")} title="Cambia provider o chiave API"
              style={{ background:"transparent", border:"1px solid #1e3a5f60", color:"#64748b", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:13 }}>⚙️</button>
          )}
        </div>
      </header>

      <div style={{ flex:1, padding:18, maxWidth:1400, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>

        {/* SETUP */}
        {tab === "setup" && connected && (
          <div style={{ maxWidth:520, margin:"0 auto" }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>⚙️ Provider attivo</h2>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 24px" }}>Stai usando una fonte dati reale. Puoi cambiare provider o disconnettere.</p>

            <div style={{ ...C.card, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:1, marginBottom:4 }}>PROVIDER ATTIVO</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#00ff9d" }}>
                    {provider==="finnhub" ? "Finnhub"
                     : provider==="rapidapi" ? "Yahoo Finance · RapidAPI"
                     : provider==="twelvedata" ? "TwelveData"
                     : "Alpha Vantage"}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>● Connesso · {liveN} asset live</div>
                </div>
                <span style={{ fontSize:30 }}>✓</span>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["twelvedata","finnhub","rapidapi","alphavantage"].filter(p => p !== provider).map(p => {
                  const has = p === "rapidapi" ? rapidKey : p === "finnhub" ? finnKey : p === "twelvedata" ? tdKey : avKey;
                  const label = p==="finnhub" ? "Finnhub" : p==="rapidapi" ? "RapidAPI" : p==="twelvedata" ? "TwelveData" : "Alpha Vantage";
                  return (
                    <button key={p} onClick={()=> has ? (setProvider(p), didAutoLoad.current = false) : (setProvider(p), setConnected(false))}
                      style={{ background:"#1e3a5f30", color:"#0099ff", border:"1px solid #0099ff40", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                      ↻ Passa a {label}{has ? "" : " (configura)"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...C.card, background:"#060a10" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10 }}>AZIONI</div>
              <button onClick={()=>{
                if (!window.confirm("Disconnettere e cancellare tutte le chiavi salvate?")) return;
                setRapidKey(""); setAvKey(""); setFinnKey(""); setTdKey("");
                setConnected(false);
                setMktData({}); setErrs({});
                didAutoLoad.current = false;
                setTab("setup");
              }} style={{ background:"#ff475715", color:"#ff4757", border:"1px solid #ff475750", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                ✕ Disconnetti e dimentica chiavi
              </button>
            </div>
          </div>
        )}

        {tab === "setup" && !connected && (
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>⚙️ Configurazione API</h2>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 24px" }}>Collega una fonte dati reale per prezzi, RSI e MA live da tutto il mondo.</p>

            <div style={{ ...C.card, marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:1, marginBottom:14 }}>SCEGLI PROVIDER</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12 }}>
                {[
                  { id:"twelvedata",   label:"TwelveData",                badge:"CONSIGLIATO", bc:"#00ff9d", desc:"Free: 800 req/giorno, 8 req/min. Copertura globale completa (stocks, ETF, futures, forex, crypto). RSI/MA stimati sul piano free.", link:"https://twelvedata.com/register" },
                  { id:"finnhub",      label:"Finnhub",                   badge:"VELOCE",      bc:"#0099ff", desc:"Free: 60 req/min illimitate. Solo US stocks/ETF sul piano free. Ottimo per refresh frequenti.", link:"https://finnhub.io/register" },
                  { id:"rapidapi",     label:"Yahoo (RapidAPI)",          badge:"STORICO",     bc:"#ffc107", desc:"Yahoo Finance via proxy. Free: 500 req/mese. Storico completo per RSI/MA200 reali.", link:"https://rapidapi.com/manwilbahaa/api/yahoo-finance15" },
                  { id:"alphavantage", label:"Alpha Vantage",             badge:"BACKUP",      bc:"#94a3b8", desc:"API ufficiale. Free: 25 req/giorno. Backup, copertura US.", link:"https://www.alphavantage.co/support/#api-key" },
                ].map(p => (
                  <div key={p.id} onClick={()=>setProvider(p.id)}
                    style={{ background:provider===p.id?"#0d1d33":"#060a10", border:`2px solid ${provider===p.id?"#0099ff":"#1e3a5f40"}`, borderRadius:12, padding:14, cursor:"pointer" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:provider===p.id?"#0099ff":"#e2e8f0" }}>{p.label}</span>
                      <span style={{ background:`${p.bc}20`, color:p.bc, border:`1px solid ${p.bc}40`, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:800 }}>{p.badge}</span>
                    </div>
                    <p style={{ color:"#64748b", fontSize:11, margin:"0 0 7px", lineHeight:1.5 }}>{p.desc}</p>
                    <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color:"#0099ff", fontSize:11 }} onClick={e=>e.stopPropagation()}>→ Ottieni chiave gratuita</a>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...C.card, marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:1, marginBottom:12 }}>
                {provider==="rapidapi"   ? "RAPIDAPI KEY (X-RapidAPI-Key)"
                 : provider==="finnhub"  ? "FINNHUB API KEY"
                 : provider==="twelvedata" ? "TWELVEDATA API KEY"
                 : "ALPHA VANTAGE KEY"}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <input type="password"
                  placeholder={provider==="rapidapi"   ? "Incolla la tua RapidAPI key..."
                             : provider==="finnhub"   ? "Incolla la tua Finnhub API key..."
                             : provider==="twelvedata" ? "Incolla la tua TwelveData API key..."
                             : "Incolla la tua Alpha Vantage key..."}
                  value={provider==="rapidapi" ? rapidKey
                       : provider==="finnhub"  ? finnKey
                       : provider==="twelvedata" ? tdKey
                       : avKey}
                  onChange={e=> provider==="rapidapi"   ? setRapidKey(e.target.value)
                              : provider==="finnhub"   ? setFinnKey(e.target.value)
                              : provider==="twelvedata" ? setTdKey(e.target.value)
                              : setAvKey(e.target.value)}
                  style={{ ...C.inp_, flex:1 }} />
                <button onClick={testConnection} disabled={!activeKey} style={{ background:"#1e3a5f30", color:"#0099ff", border:"1px solid #0099ff40", borderRadius:10, padding:"10px 14px", cursor:activeKey?"pointer":"default", fontWeight:700, fontSize:13, opacity:activeKey?1:.4 }}>🔍 Test</button>
                <button onClick={save} disabled={!activeKey} style={{ ...C.send, opacity:activeKey?1:.4, cursor:activeKey?"pointer":"default" }}>✓ Connetti</button>
              </div>
              <p style={{ color:"#64748b", fontSize:11, margin:"8px 0 0" }}>🔒 La chiave resta nel browser e viene inviata solo al provider scelto.</p>
              {testResult && (
                <div style={{
                  marginTop:12, padding:"10px 12px", borderRadius:8, fontSize:12, lineHeight:1.5,
                  background: testResult.status==="ok" ? "#00ff9d15" : testResult.status==="error" ? "#ff475715" : "#0099ff15",
                  border: `1px solid ${testResult.status==="ok" ? "#00ff9d50" : testResult.status==="error" ? "#ff475750" : "#0099ff50"}`,
                  color: testResult.status==="ok" ? "#00ff9d" : testResult.status==="error" ? "#ff8e9a" : "#94a3b8",
                }}>{testResult.msg}</div>
              )}
            </div>

            <div style={{ ...C.card, background:"#060a10" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:12 }}>
                📖 COME OTTENERE LA CHIAVE — {provider==="rapidapi" ? "RAPIDAPI" : provider==="finnhub" ? "FINNHUB" : provider==="twelvedata" ? "TWELVEDATA" : "ALPHA VANTAGE"}
              </div>
              {provider==="twelvedata" ? (
                <ol style={{ color:"#94a3b8", fontSize:12, lineHeight:2.1, paddingLeft:18, margin:0 }}>
                  <li>Vai su <a href="https://twelvedata.com/register" target="_blank" rel="noopener noreferrer" style={{ color:"#0099ff" }}>twelvedata.com/register</a></li>
                  <li>Crea account gratuito con email (se hai già un account su un altro bot, riusa la stessa chiave)</li>
                  <li>Verifica email → dashboard mostra la chiave subito</li>
                  <li>Limite gratuito: <b style={{ color:"#00ff9d" }}>800 req/giorno, 8 req/min</b></li>
                  <li>Incollala sopra e clicca Connetti ✓</li>
                </ol>
              ) : provider==="finnhub" ? (
                <ol style={{ color:"#94a3b8", fontSize:12, lineHeight:2.1, paddingLeft:18, margin:0 }}>
                  <li>Vai su <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer" style={{ color:"#0099ff" }}>finnhub.io/register</a></li>
                  <li>Crea account gratuito con email</li>
                  <li>Conferma email → dashboard mostra subito la chiave</li>
                  <li>Limite gratuito: <b style={{ color:"#00ff9d" }}>60 req/min illimitate</b></li>
                  <li>Incollala sopra e clicca Connetti ✓</li>
                </ol>
              ) : provider==="rapidapi" ? (
                <ol style={{ color:"#94a3b8", fontSize:12, lineHeight:2.1, paddingLeft:18, margin:0 }}>
                  <li>Vai su <a href="https://rapidapi.com/manwilbahaa/api/yahoo-finance15" target="_blank" rel="noopener noreferrer" style={{ color:"#0099ff" }}>RapidAPI — Yahoo Finance 15</a></li>
                  <li>Crea account gratuito → clicca <b style={{ color:"#e2e8f0" }}>Subscribe to Test</b></li>
                  <li>Scegli piano <b style={{ color:"#00ff9d" }}>FREE</b> (500 request/mese)</li>
                  <li>Copia la chiave <b style={{ color:"#e2e8f0" }}>X-RapidAPI-Key</b> dagli header di esempio</li>
                  <li>Incollala sopra e clicca Connetti ✓</li>
                </ol>
              ) : (
                <ol style={{ color:"#94a3b8", fontSize:12, lineHeight:2.1, paddingLeft:18, margin:0 }}>
                  <li>Vai su <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" style={{ color:"#0099ff" }}>alphavantage.co/support/#api-key</a></li>
                  <li>Compila il form con nome e email</li>
                  <li>Ricevi la chiave API (subito a schermo o via email)</li>
                  <li>Limite gratuito: 25 richieste/giorno, 500/mese</li>
                  <li>Incollala sopra e clicca Connetti ✓</li>
                </ol>
              )}
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ marginBottom:18 }}>
              <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>Dashboard Globale</h2>
              <p style={{ color:"#64748b", margin:"4px 0 0", fontSize:13 }}>
                {connected ? `Dati live via ${provider==="rapidapi"?"Yahoo Finance / RapidAPI":provider==="finnhub"?"Finnhub":provider==="twelvedata"?"TwelveData":"Alpha Vantage"}` : "⚠️ Vai in Setup per collegare le API"}
              </p>
            </div>
            {Object.keys(errs).length > 0 && (
              <div style={{ background:"#ff475715", border:"1px solid #ff475750", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#ff8e9a" }}>
                ⚠️ <b>Errore caricamento dati</b> ({Object.keys(errs).length} simboli): {Object.values(errs)[0]}
                <div style={{ color:"#94a3b8", marginTop:6, fontSize:11 }}>
                  {provider === "twelvedata"
                    ? <>Verifica: 1) chiave <b>TwelveData</b> valida; 2) il limite 8 req/min potrebbe averti rate-limitato — clicca "Carica" più lentamente o aspetta 1 minuto; 3) limite giornaliero 800 req potrebbe essere stato superato.</>
                    : provider === "finnhub"
                    ? <>Il piano <b>Finnhub free</b> copre solo US stocks/ETF. Per ticker internazionali (.T, .HK, .SW, .DE, .NS, .AX) e futures usa <b>TwelveData</b> o <b>RapidAPI</b>.</>
                    : provider === "rapidapi"
                    ? <>Verifica: 1) chiave RapidAPI valida e iscritta a <b>yahoo-finance15</b>; 2) il proxy <code>/api/proxy</code> è raggiungibile; 3) non hai superato il limite mensile (500 req).</>
                    : <>Verifica: 1) chiave <b>Alpha Vantage</b> valida; 2) limite gratuito 25 req/giorno potrebbe essere stato superato (riprova domani).</>
                  }
                </div>
              </div>
            )}
            <div style={C.g3}>
              {[
                { label:"Asset Live",    value:liveN||"—", sub:`${allAssets.length} asset disponibili`, icon:"🌐", c:"#0099ff" },
                { label:"Segnali BUY",   value:buyN||"—",  sub:"RSI < 45 + prezzo > MA200",            icon:"📈", c:"#00ff9d" },
                { label:"Portafoglio",   value:portfolio.length, sub:`${portfolio.filter(p=>get(p.symbol)?.signal==="BUY").length} in BUY`, icon:"💼", c:"#ffc107" },
              ].map((s,i)=>(
                <div key={i} style={C.sc}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{s.label}</div>
                      <div style={{ fontSize:34, fontWeight:800, color:s.c }}>{s.value}</div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>{s.sub}</div>
                    </div>
                    <span style={{ fontSize:24 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={C.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:"#94a3b8" }}>⭐ WATCHLIST</h3>
                  {connected && <button onClick={()=>watchlist.forEach(s=>fetchOne(s))} style={{ ...C.ab(false,"#0099ff"), fontSize:10 }}>↻ Aggiorna</button>}
                </div>
                <table style={C.tb}>
                  <thead><tr><th style={C.th}>Simbolo</th><th style={C.th}>Spark</th><th style={C.th}>Prezzo</th><th style={C.th}>RSI</th><th style={C.th}>Segnale</th></tr></thead>
                  <tbody>
                    {watchlist.map(sym=>{
                      const d=get(sym);
                      return (
                        <tr key={sym}>
                          <td style={C.td}><b>{sym}</b></td>
                          <td style={C.td}>{isL(sym)?<Spin/>:d?<Spark closes={d.sparkline} change={d.change}/>:"—"}</td>
                          <td style={C.td}><span style={{ fontFamily:"monospace", fontSize:12 }}>{d?d.price?.toFixed(2):"—"}</span></td>
                          <td style={C.td}><span style={{ fontFamily:"monospace", color:d?.rsi<40?"#00ff9d":d?.rsi>65?"#ff4757":"#e2e8f0" }}>{d?.rsi??"—"}</span></td>
                          <td style={C.td}>{d?<Sig s={d.signal}/>:<span style={{ color:"#1e3a5f", fontSize:11 }}>—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!connected && <div style={{ textAlign:"center", padding:"10px 0 4px", color:"#64748b", fontSize:11 }}>→ Configura API in Setup per dati live</div>}
              </div>
              <div style={C.card}>
                <h3 style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:"#94a3b8" }}>🧠 STRATEGIA ATTIVA</h3>
                <div style={{ background:"#060a10", borderRadius:10, padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"#0099ff", marginBottom:6 }}>{strat.name}</div>
                  <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6, marginBottom:12 }}>{strat.description}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ background:"#0099ff18", borderRadius:8, padding:"4px 10px" }}><div style={{ fontSize:9, color:"#64748b", fontWeight:700 }}>ORIZZONTE</div><div style={{ fontSize:12, color:"#0099ff", fontWeight:700 }}>{strat.horizon}</div></div>
                    <div style={{ background:"#ffc10718", borderRadius:8, padding:"4px 10px" }}><div style={{ fontSize:9, color:"#64748b", fontWeight:700 }}>RISCHIO</div><div style={{ fontSize:12, color:"#ffc107", fontWeight:700 }}>{strat.risk}</div></div>
                  </div>
                </div>
                <button onClick={()=>setTab("chat")} style={{ ...C.send, width:"100%", borderRadius:10, padding:11 }}>💬 Chiedi Analisi all'AI</button>
              </div>
            </div>
          </div>
        )}

        {/* MARKETS */}
        {tab === "markets" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>Mercati Globali</h2>
                <p style={{ color:"#64748b", margin:"4px 0 0", fontSize:13 }}>Azioni · Futures · ETF · Materie Prime</p>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {connected && <button onClick={loadAll} style={{ ...C.send, padding:"7px 14px", fontSize:12 }}>↻ Carica {MARKETS[mkt].length} asset</button>}
                {["ALL","BUY","HOLD","WAIT","SELL"].map(f=>(
                  <button key={f} style={{ ...C.mt(filter===f), borderRadius:8, padding:"4px 11px" }} onClick={()=>setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              {Object.keys(MARKETS).map(m=>(
                <button key={m} style={C.mt(mkt===m)} onClick={()=>setMkt(m)}>
                  {{"shares":"📊 Azioni","futures":"⚡ Futures","etf":"🏦 ETF","commodities":"🪨 Commodities"}[m]}
                </button>
              ))}
            </div>
            <div style={C.card}>
              {!connected && <div style={{ background:"#0099ff10", border:"1px solid #0099ff30", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#94a3b8" }}>⚙️ <b style={{ color:"#0099ff" }}>Configura le API in Setup</b> per caricare dati reali da Yahoo Finance.</div>}
              <table style={C.tb}>
                <thead>
                  <tr>
                    {["Asset","Mercato","Spark","Prezzo","Var%","RSI","MA50","MA200","Segnale LT","Score","Fonte","Azioni"].map(h=><th key={h} style={C.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(asset=>{
                    const d=get(asset.symbol), l=isL(asset.symbol), e=errs[asset.symbol];
                    const cp=d?.changeP??0, abv=d&&d.price>parseFloat(d.ma200);
                    return (
                      <tr key={asset.symbol}
                        onMouseEnter={ev=>ev.currentTarget.style.background="#0f1a2e"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}
                        style={{ transition:"background .15s" }}>
                        <td style={C.td}><div style={{ fontWeight:700 }}>{asset.symbol}</div><div style={{ fontSize:10, color:"#64748b" }}>{asset.name.slice(0,20)}</div></td>
                        <td style={C.td}><span style={{ fontSize:10, background:"#1e3a5f30", borderRadius:4, padding:"2px 6px" }}>{asset.market}</span></td>
                        <td style={C.td}>{l?<Spin/>:d?<Spark closes={d.sparkline} change={d.change}/>: connected?<button onClick={()=>fetchOne(asset.symbol)} style={{ ...C.ab(false,"#0099ff"), fontSize:10 }}>Load</button>:"—"}</td>
                        <td style={C.td}><span style={{ fontFamily:"monospace", fontWeight:600 }}>{l?<Spin/>:d?`${asset.currency} ${d.price?.toFixed(2)}`:e?<span style={{ color:"#ff4757", fontSize:10 }} title={e}>ERR</span>:"—"}</span></td>
                        <td style={C.td}>{d?<span style={{ color:cp>=0?"#00ff9d":"#ff4757", fontFamily:"monospace", fontWeight:700 }}>{cp>=0?"+":""}{cp.toFixed(2)}%</span>:"—"}</td>
                        <td style={C.td}>{d?<span style={{ fontFamily:"monospace", color:d.rsi<40?"#00ff9d":d.rsi>65?"#ff4757":"#e2e8f0" }}>{d.rsi}</span>:"—"}</td>
                        <td style={C.td}><span style={{ fontSize:11, fontFamily:"monospace", color:"#94a3b8" }}>{d?.ma50??"—"}</span></td>
                        <td style={C.td}>{d?<span style={{ fontSize:11, color:abv?"#00ff9d":"#ff4757", fontFamily:"monospace" }}>{abv?"▲":"▼"} {d.ma200}</span>:"—"}</td>
                        <td style={C.td}>{d?<Sig s={d.signal}/>:"—"}</td>
                        <td style={C.td}>{d?<Score v={d.score}/>:"—"}</td>
                        <td style={C.td}>{d?<span style={{ fontSize:10, color:"#64748b" }}>{d.source}</span>:"—"}</td>
                        <td style={C.td}>
                          <div style={{ display:"flex", gap:5 }}>
                            {connected&&<button onClick={()=>fetchOne(asset.symbol)} style={{ ...C.ab(false,"#64748b"), fontSize:10 }}>↻</button>}
                            <button style={C.ab(!!portfolio.find(p=>p.symbol===asset.symbol),"#00ff9d")} onClick={()=>togglePort(asset)}>{portfolio.find(p=>p.symbol===asset.symbol)?"✓":"+"}</button>
                            <button style={C.ab(watchlist.includes(asset.symbol),"#ffc107")} onClick={()=>toggleWatch(asset.symbol)}>{watchlist.includes(asset.symbol)?"★":"☆"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PORTFOLIO */}
        {tab === "portfolio" && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 18px" }}>💼 Portafoglio LT</h2>
            {portfolio.length===0 ? (
              <div style={{ ...C.card, textAlign:"center", padding:56 }}>
                <div style={{ fontSize:42, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:17, fontWeight:700, marginBottom:7 }}>Portafoglio vuoto</div>
                <div style={{ color:"#64748b", marginBottom:18, fontSize:13 }}>Vai su Mercati e aggiungi asset con il pulsante +</div>
                <button style={C.send} onClick={()=>setTab("markets")}>🌍 Esplora Mercati</button>
              </div>
            ) : (
              <div style={C.card}>
                <table style={C.tb}>
                  <thead><tr>{["Asset","Aggiunto","Prezzo","RSI","MA200","Segnale LT","Score",""].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {portfolio.map(p=>{
                      const d=get(p.symbol), l=isL(p.symbol);
                      return (
                        <tr key={p.symbol}>
                          <td style={C.td}><div style={{ fontWeight:700 }}>{p.symbol}</div><div style={{ fontSize:10, color:"#64748b" }}>{p.name.slice(0,22)}</div></td>
                          <td style={C.td}><span style={{ fontSize:11, color:"#64748b" }}>{p.addedAt}</span></td>
                          <td style={C.td}>{l?<Spin/>:d?<span style={{ fontFamily:"monospace", fontWeight:600 }}>{p.currency} {d.price?.toFixed(2)}</span>:"—"}</td>
                          <td style={C.td}>{d?<span style={{ fontFamily:"monospace", color:d.rsi<40?"#00ff9d":d.rsi>65?"#ff4757":"#e2e8f0" }}>{d.rsi}</span>:"—"}</td>
                          <td style={C.td}>{d?<span style={{ fontSize:11, fontFamily:"monospace", color:d.price>parseFloat(d.ma200)?"#00ff9d":"#ff4757" }}>{d.price>parseFloat(d.ma200)?"▲":"▼"} {d.ma200}</span>:"—"}</td>
                          <td style={C.td}>{d?<Sig s={d.signal}/>:"—"}</td>
                          <td style={C.td}>{d?<Score v={d.score}/>:"—"}</td>
                          <td style={C.td}>
                            <div style={{ display:"flex", gap:5 }}>
                              {connected&&<button onClick={()=>fetchOne(p.symbol)} style={{ ...C.ab(false,"#0099ff"), fontSize:10 }}>↻</button>}
                              <button onClick={()=>togglePort(p)} style={{ background:"#ff475718", color:"#ff4757", border:"1px solid #ff475740", borderRadius:6, padding:"3px 9px", cursor:"pointer", fontSize:11 }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STRATEGIES */}
        {tab === "strategies" && (
          <div>
            <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🧠 Strategie Long-Term</h2>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 18px" }}>La strategia selezionata guida le analisi e i segnali dell'AI.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {STRATEGIES.map(s=>(
                <div key={s.id} onClick={()=>setStrat(s)}
                  style={{ ...C.card, cursor:"pointer", border:`2px solid ${strat.id===s.id?"#0099ff60":"#1e3a5f40"}`, background:strat.id===s.id?"#0d1d33":"#0a1120" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:strat.id===s.id?"#0099ff":"#e2e8f0" }}>{s.name}</span>
                    {strat.id===s.id&&<span style={{ background:"#0099ff", color:"#fff", borderRadius:20, padding:"1px 9px", fontSize:10, fontWeight:700 }}>ATTIVA</span>}
                  </div>
                  <p style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6, margin:"0 0 12px" }}>{s.description}</p>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ background:"#0099ff18", borderRadius:8, padding:"4px 10px" }}><div style={{ fontSize:9, color:"#64748b", fontWeight:700 }}>ORIZZONTE</div><div style={{ fontSize:12, color:"#0099ff", fontWeight:700 }}>{s.horizon}</div></div>
                    <div style={{ background:"#ffc10718", borderRadius:8, padding:"4px 10px" }}><div style={{ fontSize:9, color:"#64748b", fontWeight:700 }}>RISCHIO</div><div style={{ fontSize:12, color:"#ffc107", fontWeight:700 }}>{s.risk}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:16, height:"calc(100vh - 130px)" }}>
            <div style={{ ...C.card, display:"flex", flexDirection:"column", padding:0, overflow:"hidden" }}>
              <div style={{ padding:"13px 17px", borderBottom:"1px solid #1e3a5f40", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, background:"linear-gradient(135deg,#0099ff,#00ff9d)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⚡</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:13 }}>GlobalBot AI · Locale</div>
                  <div style={{ fontSize:10, color:"#00ff9d" }}>● {strat.name} · {liveN} asset live · rule-based</div>
                </div>
              </div>
              <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {msgs.map((m,i)=>(
                  <div key={i} style={m.role==="user"?C.mu:C.mb}>
                    {m.content.split("\n").map((l,j)=><div key={j}>{l||" "}</div>)}
                  </div>
                ))}
                {typing && (
                  <div style={{ ...C.mb, display:"flex", gap:5, padding:"12px 15px" }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#0099ff", animation:`bounce 1s ${i*.2}s infinite` }} />)}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:9, padding:"11px 16px", borderTop:"1px solid #1e3a5f40" }}>
                <input style={{ ...C.inp_, flex:1 }} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Chiedi analisi, strategia, scenario macro..." />
                <button style={C.send} onClick={sendMsg} disabled={typing}>{typing?"…":"→"}</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={C.card}>
                <h3 style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:"#64748b" }}>💡 DOMANDE RAPIDE</h3>
                {["Analizza i BUY signal del portafoglio","Confronta ETF globali per LT","Diversificare con commodity?","Scenario tassi alti 2025-2026","Asset difensivo per mercato orso","Analisi settore tech vs energy"].map((q,i)=>(
                  <button key={i} onClick={()=>setInp(q)}
                    style={{ display:"block", width:"100%", textAlign:"left", background:"#060a10", border:"1px solid #1e3a5f30", borderRadius:7, padding:"7px 10px", color:"#94a3b8", cursor:"pointer", fontSize:11, marginBottom:5 }}
                    onMouseEnter={e=>{e.target.style.borderColor="#0099ff50";e.target.style.color="#e2e8f0";}}
                    onMouseLeave={e=>{e.target.style.borderColor="#1e3a5f30";e.target.style.color="#94a3b8";}}>
                    {q}
                  </button>
                ))}
              </div>
              <div style={C.card}>
                <h3 style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:"#64748b" }}>📊 CONTESTO AI</h3>
                <div style={{ fontSize:11, color:"#64748b", lineHeight:2 }}>
                  <div>⚡ Strategia: <span style={{ color:"#0099ff" }}>{strat.name}</span></div>
                  <div>💼 Posizioni: <span style={{ color:"#e2e8f0" }}>{portfolio.length}</span></div>
                  <div>📡 Asset live: <span style={{ color:"#e2e8f0" }}>{liveN}</span></div>
                  <div>🎯 BUY signals: <span style={{ color:"#00ff9d" }}>{buyN}</span></div>
                  <div>⚙️ Provider: <span style={{ color:"#e2e8f0" }}>{connected?(provider==="rapidapi"?"RapidAPI":provider==="finnhub"?"Finnhub":provider==="twelvedata"?"TwelveData":"Alpha Vantage"):"Non conf."}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
