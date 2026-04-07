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

async function fetchRapidAPI(symbol, key) {
  const ck = `r_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  const quoteTarget = `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${encodeURIComponent(symbol)}&type=STOCKS`;
  const qRes = await fetch(proxyUrl(quoteTarget, key));
  if (!qRes.ok) throw new Error(`RapidAPI ${qRes.status}`);
  const qj = await qRes.json();
  const q  = qj?.body ?? qj?.quoteResponse?.result?.[0] ?? qj;
  const price = q.regularMarketPrice ?? q.ask ?? null;
  if (!price) throw new Error("No price");

  let rsi = 50, ma50 = price, ma200 = price, sparkline = [];
  try {
    const histTarget = `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/history?symbol=${encodeURIComponent(symbol)}&interval=1d&diffandsplits=false`;
    const hRes = await fetch(proxyUrl(histTarget, key));
    if (hRes.ok) {
      const hj = await hRes.json();
      const items = Object.values(hj?.body ?? {}).filter(i => i.close).slice(-220).reverse();
      const closes = items.map(i => parseFloat(i.close)).reverse();
      if (closes.length > 15) {
        rsi = calcRSI(closes); ma50 = calcMA(closes, 50); ma200 = calcMA(closes, 200);
        sparkline = closes.slice(-24);
      }
    }
  } catch (_) {}

  const signal = ltSignal(rsi, price, ma200);
  const score  = calcScore(signal, rsi, price, ma200);
  const d = {
    price, change: q.regularMarketChange ?? 0, changeP: q.regularMarketChangePercent ?? 0,
    high52: q.fiftyTwoWeekHigh ?? null, low52: q.fiftyTwoWeekLow ?? null,
    vol: q.regularMarketVolume ?? 0, rsi,
    ma50: ma50.toFixed(2), ma200: ma200.toFixed(2),
    signal, score, sparkline, source: "Yahoo / RapidAPI",
  };
  _cache[ck] = { d, ts: Date.now() };
  return d;
}

async function fetchAlphaVantage(symbol, key) {
  const ck = `av_${symbol}`;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL) return _cache[ck].d;

  const res = await fetch(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${key}`
  );
  if (!res.ok) throw new Error(`AV ${res.status}`);
  const json = await res.json();
  if (json.Note || json.Information) throw new Error("AV rate limit — riprova tra 1 minuto");
  const ts = json["Time Series (Daily)"];
  if (!ts) throw new Error("Nessun dato AV");

  const entries = Object.entries(ts).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  const closes  = entries.slice(0, 220).reverse().map(([, v]) => parseFloat(v["4. close"]));
  const price   = closes[closes.length - 1];
  const prev    = closes[closes.length - 2] || price;
  const change  = price - prev;
  const changeP = (change / prev) * 100;
  const rsi     = calcRSI(closes);
  const ma50    = calcMA(closes, 50);
  const ma200   = calcMA(closes, 200);
  const signal  = ltSignal(rsi, price, ma200);
  const score   = calcScore(signal, rsi, price, ma200);
  const sparkline = closes.slice(-24);
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("setup");
  const [mkt, setMkt]               = useState("shares");
  const [strat, setStrat]           = useState(STRATEGIES[0]);
  const [portfolio, setPortfolio]   = useState([]);
  const [watchlist, setWatchlist]   = useState(["AAPL","VOO","GLD","ES=F"]);
  const [filter, setFilter]         = useState("ALL");
  const [mktData, setMktData]       = useState({});
  const [loading, setLoading]       = useState(new Set());
  const [errs, setErrs]             = useState({});
  const [provider, setProvider]     = useState("rapidapi");
  const [rapidKey, setRapidKey]     = useState("");
  const [avKey, setAvKey]           = useState("");
  const [connected, setConnected]   = useState(false);
  const [msgs, setMsgs]             = useState([
    { role:"assistant", content:"👋 Sono il tuo AI Trading Bot LT.\n\nConfigura le API in ⚙️ Setup per ricevere dati reali da Yahoo Finance / Alpha Vantage.\n\nPosso analizzare azioni, futures, ETF e materie prime globali con RSI, MA50, MA200 e segnali a lungo termine." }
  ]);
  const [inp, setInp]         = useState("");
  const [typing, setTyping]   = useState(false);
  const chatRef               = useRef(null);
  const allAssets             = Object.values(MARKETS).flat();

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs, typing]);

  const activeKey = provider === "rapidapi" ? rapidKey : avKey;

  const fetchOne = useCallback(async (symbol) => {
    if (!activeKey) return;
    setLoading(p => new Set([...p, symbol]));
    setErrs(p => { const n={...p}; delete n[symbol]; return n; });
    try {
      const d = provider === "rapidapi" ? await fetchRapidAPI(symbol, activeKey) : await fetchAlphaVantage(symbol, activeKey);
      setMktData(p => ({ ...p, [symbol]: d }));
    } catch(e) {
      setErrs(p => ({ ...p, [symbol]: e.message }));
    } finally {
      setLoading(p => { const n=new Set(p); n.delete(symbol); return n; });
    }
  }, [activeKey, provider]);

  const loadAll = useCallback(async () => {
    const syms = MARKETS[mkt].map(a => a.symbol);
    for (const s of syms) {
      await fetchOne(s);
      await new Promise(r => setTimeout(r, provider === "alphavantage" ? 1300 : 250));
    }
  }, [mkt, fetchOne, provider]);

  const save = () => { setConnected(true); setTab("dashboard"); };
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

  const sendMsg = async () => {
    if (!inp.trim() || typing) return;
    const txt = inp.trim(); setInp("");
    setMsgs(p => [...p, { role:"user", content:txt }]); setTyping(true);
    try {
      const live = Object.entries(mktData).slice(0,12).map(([s,d]) =>
        `${s}: prezzo=${d.price?.toFixed(2)}, RSI=${d.rsi}, MA200=${d.ma200}, segnale=${d.signal}, score=${d.score}`).join("\n");
      const sys = `Sei un esperto AI di trading e investimenti a lungo termine. Parli italiano professionale e conciso.
Strategia attiva: ${strat.name} — ${strat.description} — Orizzonte: ${strat.horizon} — Rischio: ${strat.risk}
Portafoglio: ${portfolio.length ? portfolio.map(p=>p.symbol).join(", ") : "vuoto"}
Watchlist: ${watchlist.join(", ")}
Dati live:\n${live || "nessun dato caricato"}
Principi: investimento LT, diversificazione globale, gestione rischio disciplinata. Rispondi in modo pratico.`;
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:sys,
          messages:[...msgs.slice(-8), { role:"user", content:txt }]
        })
      });
      const data = await res.json();
      const reply = data.content?.map(c=>c.text||"").join("") || "Errore risposta.";
      setMsgs(p => [...p, { role:"assistant", content:reply }]);
    } catch { setMsgs(p => [...p, { role:"assistant", content:"⚠️ Errore connessione AI." }]); }
    setTyping(false);
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
          {[["setup","⚙️ Setup"],["dashboard","📊 Dashboard"],["markets","🌍 Mercati"],["portfolio","💼 Portafoglio"],["strategies","🧠 Strategie"],["chat","💬 AI Chat"]].map(([t,l])=>(
            <button key={t} style={C.nav(tab===t)} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </nav>
        <div style={{ display:"flex", gap:12, fontSize:12, alignItems:"center" }}>
          <span style={{ color:"#64748b" }}>Live: <b style={{ color:"#0099ff" }}>{liveN}</b></span>
          <span style={{ color:"#64748b" }}>BUY: <b style={{ color:"#00ff9d" }}>{buyN}</b></span>
          {connected && <><span style={{ width:8, height:8, borderRadius:"50%", background:"#00ff9d", display:"inline-block", animation:"pulse 2s infinite" }} /><span style={{ color:"#00ff9d", fontWeight:600 }}>LIVE</span></>}
        </div>
      </header>

      <div style={{ flex:1, padding:18, maxWidth:1400, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>

        {/* SETUP */}
        {tab === "setup" && (
          <div style={{ maxWidth:680, margin:"0 auto" }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>⚙️ Configurazione API</h2>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 24px" }}>Collega una fonte dati reale per prezzi, RSI e MA live da tutto il mondo.</p>

            <div style={{ ...C.card, marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:1, marginBottom:14 }}>SCEGLI PROVIDER</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { id:"rapidapi",     label:"Yahoo Finance (RapidAPI)", badge:"CONSIGLIATO", bc:"#00ff9d", desc:"Dati Yahoo Finance tramite proxy affidabile. Free: 500 req/mese. Dati globali completi.", link:"https://rapidapi.com/manwilbahaa/api/yahoo-finance15" },
                  { id:"alphavantage", label:"Alpha Vantage",            badge:"GRATUITO",    bc:"#0099ff", desc:"API gratuita ufficiale. Free: 25 req/giorno. Ottimo per test su mercati USA.", link:"https://www.alphavantage.co/support/#api-key" },
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
                {provider==="rapidapi"?"RAPIDAPI KEY (X-RapidAPI-Key)":"ALPHA VANTAGE KEY"}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <input type="password"
                  placeholder={provider==="rapidapi"?"Incolla la tua RapidAPI key...":"Incolla la tua Alpha Vantage key..."}
                  value={provider==="rapidapi"?rapidKey:avKey}
                  onChange={e=>provider==="rapidapi"?setRapidKey(e.target.value):setAvKey(e.target.value)}
                  style={{ ...C.inp_, flex:1 }} />
                <button onClick={save} disabled={!activeKey} style={{ ...C.send, opacity:activeKey?1:.4, cursor:activeKey?"pointer":"default" }}>✓ Connetti</button>
              </div>
              <p style={{ color:"#64748b", fontSize:11, margin:"8px 0 0" }}>🔒 La chiave resta nel browser e viene inviata solo al provider scelto.</p>
            </div>

            <div style={{ ...C.card, background:"#060a10" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:12 }}>
                📖 COME OTTENERE LA CHIAVE — {provider==="rapidapi"?"RAPIDAPI":"ALPHA VANTAGE"}
              </div>
              {provider==="rapidapi" ? (
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
                {connected ? `Dati live via ${provider==="rapidapi"?"Yahoo Finance / RapidAPI":"Alpha Vantage"}` : "⚠️ Vai in Setup per collegare le API"}
              </p>
            </div>
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
                  <div style={{ fontWeight:800, fontSize:13 }}>GlobalBot AI</div>
                  <div style={{ fontSize:10, color:"#00ff9d" }}>● {strat.name} · {liveN} asset live</div>
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
                  <div>⚙️ Provider: <span style={{ color:"#e2e8f0" }}>{connected?(provider==="rapidapi"?"RapidAPI":"Alpha Vantage"):"Non conf."}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
