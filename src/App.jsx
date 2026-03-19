import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown, ChevronUp, Filter, Database, ArrowUpRight, ArrowDownRight, GitCompare, RefreshCw, Info } from "lucide-react";
import { TODAY, YESTERDAY, TODAY_DATE, YESTERDAY_DATE } from "./data";

// Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
function getQuarter(close_date) {
  if (!close_date) return "Unknown";
  try {
    const y = parseInt(close_date.slice(0, 4));
    const m = parseInt(close_date.slice(5, 7));
    const fy = String(y).slice(-2);
    if (m <= 3)  return `Q1 FY${fy}`;
    if (m <= 6)  return `Q2 FY${fy}`;
    if (m <= 9)  return `Q3 FY${fy}`;
    return `Q4 FY${fy}`;
  } catch (e) { return "Unknown"; }
}

const STAGE_MAP = {
  "1 - Target (1%)":1,"2 - Discovery (5%)":5,"3 - Objectives (10%)":10,
  "4 - Sponsor (20%)":20,"4 - Economic Buyer Identified (30%)":30,
  "4 - Present Solution (20%)":20,"5 - Economic Buyer Validation (40%)":40,
  "6 - Proposal (50%)":50,"6 - Validation Completed (70%)":70,
  "7 - Verbal Agreement (75%)":75,"7 - Deal Imminent (90%)":90,
  "8 - Contracting (90%)":90,"8 - 100% ":100,"9 - Closed Won (100%)":100
};
const spct = (s) => {
  const v = STAGE_MAP[s];
  if (v !== undefined) return v;
  const m = (s || "").match(/\((\d+)%\)/);
  if (m) return parseInt(m[1]);
  const m2 = (s || "").match(/(\d+)%/);
  return m2 ? parseInt(m2[1]) : 0;
};
const FC_RANK = { Upside: 1, Submitted: 2, Expect: 3, Commit: 4 };
const fmtK = (n) => {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1000000) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1000) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
};
const FC_COLORS = { Commit: "#22d3ee", Expect: "#a78bfa", Upside: "#f59e0b", Submitted: "#34d399" };
const QTR_COLORS = { Q1: "#22d3ee", Q2: "#a78bfa", Q3: "#f59e0b", Q4: "#34d399" };

function computeDeltas(today, yesterday) {
  if (!yesterday || !yesterday.length) return [];
  const tMap = Object.fromEntries(today.map(d => [d.id, d]));
  const yMap = Object.fromEntries(yesterday.map(d => [d.id, d]));
  const allIds = new Set([...Object.keys(tMap), ...Object.keys(yMap)]);
  const out = [];
  for (const id of allIds) {
    const t = tMap[id], y = yMap[id];
    if (t && !y) { out.push({ ...t, flags: ["new"], section: "increase", delta_nnacv: t.nnacv, change_label: "New deal", prev: null }); continue; }
    if (y && !t) { out.push({ ...y, flags: ["removed"], section: "decrease", delta_nnacv: -y.nnacv, change_label: "Removed from pipeline", prev: null }); continue; }
    const flags = [], labels = [];
    const tf = FC_RANK[t.forecast_category] || 0, yf = FC_RANK[y.forecast_category] || 0;
    const tp = spct(t.stage), yp = spct(y.stage), nd = t.nnacv - y.nnacv;
    if (tf > yf) { flags.push("fc_upgraded");   labels.push(`${y.forecast_category} ‚Üí ${t.forecast_category}`); }
    if (tf < yf) { flags.push("fc_downgraded"); labels.push(`${y.forecast_category} ‚Üí ${t.forecast_category} ‚Üì`); }
    if (nd > 1000)  { flags.push("nnacv_up");   labels.push(`NNACV +${fmtK(nd)}`); }
    if (nd < -1000) { flags.push("nnacv_down"); labels.push(`NNACV ${fmtK(nd)}`); }
    if (t.close_date > y.close_date) { flags.push("date_pushed"); labels.push(`Close pushed ‚Üí ${t.close_date}`); }
    if (t.close_date < y.close_date) { flags.push("date_pulled"); labels.push(`Close pulled ‚Üí ${t.close_date}`); }
    if (tp > yp) { flags.push("stage_up");   labels.push(`Stage ${yp}%‚Üí${tp}%`); }
    if (tp < yp) { flags.push("stage_down"); labels.push(`Stage ${yp}%‚Üí${tp}% ‚Üì`); }
    if (!flags.length) continue;
    const section = flags.some(f => f.startsWith("fc_")) ? "movement"
      : flags.some(f => ["nnacv_up", "date_pulled", "stage_up", "new"].includes(f)) ? "increase"
      : "decrease";
    out.push({ ...t, flags, section, delta_nnacv: nd, prev: y, change_label: labels.join("  ¬∑  ") });
  }
  return out;
}

const FCBadge = ({ fc }) => {
  const c = FC_COLORS[fc] || "#6b7280";
  return <span style={{ background: `${c}18`, color: c, border: `1px solid ${c}35`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{fc}</span>;
};
const WFChip = ({ wf }) => {
  const c = wf === "RaptorDB" ? "#60a5fa" : "#63DF4E";
  return <span style={{ background: `${c}15`, color: c, border: `1px solid ${c}30`, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{wf}</span>;
};
const QtrChip = ({ date }) => {
  const q = getQuarter(date);
  const c = QTR_COLORS[q.slice(0, 2)] || "#6b7280";
  return <span style={{ background: `${c}18`, color: c, border: `1px solid ${c}30`, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{q}</span>;
};
const StagePip = ({ pct }) => {
  const c = pct >= 90 ? "#22d3ee" : pct >= 40 ? "#a78bfa" : pct >= 20 ? "#f59e0b" : "#374151";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 52, height: 3, background: "#1a3a4a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: c, borderRadius: 2 }} />
      </div>
      <span style={{ color: "#4a7a8a", fontSize: 10 }}>{pct}%</span>
    </div>
  );
};

function Row({ d, isDelta }) {
  const [open, setOpen] = useState(false);
  const nc = d.delta_nnacv > 0 ? "#63DF4E" : d.delta_nnacv < 0 ? "#f87171" : "#5a8fa3";
  return (
    <>
      <tr onClick={() => setOpen(!open)} style={{ cursor: "pointer", background: open ? "#0b2535" : "transparent", borderBottom: "1px solid #0d2535", transition: "background 0.12s" }}>
        <td style={{ padding: "9px 12px" }}>
          <div style={{ color: "#ddeef5", fontWeight: 600, fontSize: 12 }}>{d.account || "(unnamed)"}</div>
          <div style={{ color: "#3a6070", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.opty_name}</div>
        </td>
        <td style={{ padding: "9px 12px", color: "#9ecfe0", fontSize: 11, whiteSpace: "nowrap" }}>{(d.owner || "").split(" ").slice(0,2).join(" ")}</td>
        <td style={{ padding: "9px 12px" }}><WFChip wf={d.workflow} /></td>
        <td style={{ padding: "9px 12px" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#ddeef5" }}>{fmtK(d.nnacv)}</div>
          {isDelta && d.delta_nnacv !== 0 && <div style={{ fontSize: 10, color: nc, fontWeight: 700 }}>{d.delta_nnacv > 0 ? "+" : ""}{fmtK(d.delta_nnacv)}</div>}
        </td>
        <td style={{ padding: "9px 12px" }}><FCBadge fc={d.forecast_category} /></td>
        <td style={{ padding: "9px 12px" }}><StagePip pct={spct(d.stage)} /></td>
        <td style={{ padding: "9px 12px" }}>
          <div style={{ fontSize: 11, color: "#4a7a8a", marginBottom: 3 }}>{d.close_date}</div>
          <QtrChip date={d.close_date} />
        </td>
        {isDelta && <td style={{ padding: "9px 12px", color: "#5a8fa3", fontSize: 10, fontStyle: "italic", maxWidth: 180 }}>{d.change_label}</td>}
        <td style={{ padding: "9px 12px", textAlign: "center" }}>{open ? <ChevronUp size={12} color="#3a6070" /> : <ChevronDown size={12} color="#3a6070" />}</td>
      </tr>
      {open && (
        <tr style={{ background: "#081d2c" }}>
          <td colSpan={isDelta ? 9 : 8} style={{ padding: "6px 12px 12px 24px" }}>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 11 }}>
              <span style={{ color: "#3a6070" }}>Stage: <span style={{ color: "#9ecfe0" }}>{d.stage}</span></span>
              <span style={{ color: "#3a6070" }}>Area: <span style={{ color: "#9ecfe0" }}>{(d.area || "").replace(" (AREA)", "")}</span></span>
              {d.owner && <span style={{ color: "#3a6070" }}>Owner: <span style={{ color: "#9ecfe0" }}>{d.owner}</span></span>}
              {d.prev && <span style={{ color: "#3a6070" }}>Yesterday NNACV: <span style={{ color: "#f59e0b" }}>{fmtK(d.prev.nnacv)}</span></span>}
              {d.prev && d.prev.close_date !== d.close_date && <span style={{ color: "#3a6070" }}>Prev close: <span style={{ color: "#f87171" }}>{d.prev.close_date}</span></span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Section({ title, desc, accent, Icon, deals, empty, isDelta }) {
  const [closed, setClosed] = useState(false);
  const total = deals.reduce((s, d) => s + (d.delta_nnacv || 0), 0);
  const hdrs = isDelta
    ? ["Account", "SSE", "Workflow", "NNACV / Œî", "Spec. Category", "Stage", "Close / Qtr", "Change", ""]
    : ["Account", "SSE", "Workflow", "NNACV", "Spec. Category", "Stage", "Close / Qtr", ""];
  return (
    <div style={{ marginBottom: 14, borderRadius: 11, overflow: "hidden", border: `1px solid ${accent}22` }}>
      <div onClick={() => setClosed(!closed)} style={{ background: `${accent}08`, padding: "12px 15px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: closed ? "none" : `1px solid ${accent}18` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ background: `${accent}18`, borderRadius: 7, padding: "5px 6px", display: "flex" }}><Icon size={13} color={accent} /></div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ color: accent, fontWeight: 800, fontSize: 13 }}>{title}</span>
              <span style={{ background: `${accent}18`, color: accent, borderRadius: 9, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{deals.length} {isDelta ? "changes" : "deals"}</span>
              {isDelta && total !== 0 && <span style={{ color: total > 0 ? "#63DF4E" : "#f87171", fontSize: 12, fontWeight: 700 }}>{total > 0 ? "+" : ""}{fmtK(total)}</span>}
            </div>
            <div style={{ color: "#3a6070", fontSize: 10 }}>{desc}</div>
          </div>
        </div>
        {closed ? <ChevronDown size={13} color={accent} /> : <ChevronUp size={13} color={accent} />}
      </div>
      {!closed && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#040f18" }}>
                {hdrs.map(h => <th key={h} style={{ padding: "7px 12px", color: "#1f4555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0
                ? <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#1f4555", fontSize: 12 }}>{empty}</td></tr>
                : deals.map((d, i) => <Row key={(d.id || d.opty_name) + i} d={d} isDelta={isDelta} />)
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const hasDelta = YESTERDAY && YESTERDAY.length > 0;
  const deltas = useMemo(() => computeDeltas(TODAY, YESTERDAY), []);

  const quarters = useMemo(() => {
    const qSet = new Set(TODAY.map(d => getQuarter(d.close_date)).filter(q => q !== "Unknown"));
    const qOrder = ["Q1 FY26","Q2 FY26","Q3 FY26","Q4 FY26","Q1 FY27","Q2 FY27"];
    return ["All Quarters", ...qOrder.filter(q => qSet.has(q))];
  }, []);

  const areas = useMemo(() => ["All Areas", ...new Set(TODAY.map(d => d.area).filter(Boolean))].sort((a, b) => a === "All Areas" ? -1 : a.localeCompare(b)), []);
  const [area, setArea] = useState("All Areas");
  const [region, setRegion] = useState("All Regions");
  const [wf, setWf] = useState("All");
  const [fc, setFc] = useState("All");
  const [qtr, setQtr] = useState("All Quarters");
  const onArea = (v) => { setArea(v); setRegion("All Regions"); };

  const filtered = useMemo(() => TODAY.filter(d =>
    (area === "All Areas" || d.area === area) &&
    (wf === "All" || d.workflow === wf) &&
    (fc === "All" || d.forecast_category === fc) &&
    (qtr === "All Quarters" || getQuarter(d.close_date) === qtr)
  ), [area, wf, fc, qtr]);

  const fDeltas = useMemo(() => deltas.filter(d =>
    (area === "All Areas" || d.area === area) &&
    (wf === "All" || d.workflow === wf) &&
    (fc === "All" || d.forecast_category === fc) &&
    (qtr === "All Quarters" || getQuarter(d.close_date) === qtr)
  ), [deltas, area, wf, fc, qtr]);

  const fMov = fDeltas.filter(d => d.section === "movement").sort((a, b) => b.nnacv - a.nnacv);
  const fInc = fDeltas.filter(d => d.section === "increase").sort((a, b) => b.delta_nnacv - a.delta_nnacv);
  const fDec = fDeltas.filter(d => d.section === "decrease").sort((a, b) => a.delta_nnacv - b.delta_nnacv);

  const total = filtered.reduce((s, d) => s + d.nnacv, 0);

  const fcChart = ["Commit", "Expect", "Upside", "Submitted"].map(f => ({
    name: f,
    v: filtered.filter(d => d.forecast_category === f).reduce((s, d) => s + d.nnacv, 0),
    n: filtered.filter(d => d.forecast_category === f).length
  })).filter(x => x.v > 0);

  const qtrChart = ["Q1 FY26","Q2 FY26","Q3 FY26","Q4 FY26","Q1 FY27"].map(q => ({
    name: q,
    v: filtered.filter(d => getQuarter(d.close_date) === q).reduce((s, d) => s + d.nnacv, 0),
    n: filtered.filter(d => getQuarter(d.close_date) === q).length
  })).filter(x => x.v > 0);

  const ss = { background: "#071e2a", border: "1px solid #162e3a", borderRadius: 6, color: "#8ab8c8", padding: "6px 10px", fontSize: 11, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 140 };
  const KCard = ({ lbl, val, sub, c, delta }) => (
    <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 9, padding: "13px 15px", flex: 1, minWidth: 110 }}>
      <div style={{ color: "#254555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{lbl}</div>
      <div style={{ color: c || "#ddeef5", fontSize: 19, fontWeight: 800 }}>{val}</div>
      {delta !== undefined && delta !== 0 && <div style={{ fontSize: 10, color: delta > 0 ? "#63DF4E" : "#f87171", fontWeight: 700, marginTop: 2 }}>{delta > 0 ? "+" : ""}{fmtK(delta)} vs yesterday</div>}
      {sub && delta === undefined && <div style={{ color: "#3a6070", fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#040f18", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: "#aac8d4", padding: "16px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <Database size={12} color="#63DF4E" />
            <span style={{ color: "#63DF4E", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Dynamics 365 ¬∑ Specialist Pipeline ¬∑ D&A Intelligence</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>RaptorDB + WDF ¬∑ Specialist View</h1>
          <div style={{ color: "#254555", fontSize: 11, marginTop: 3 }}>{TODAY_DATE} ¬∑ {filtered.length} open deals ¬∑ Specialist Category ¬∑ Source: Dynamics 365</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ background: "#63DF4E12", border: "1px solid #63DF4E28", borderRadius: 7, padding: "4px 12px", fontSize: 10, color: "#63DF4E", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <RefreshCw size={9} /> {TODAY_DATE} ¬∑ {TODAY.length} deals
          </div>
          <div style={{ color: "#254555", fontSize: 10, marginTop: 2 }}>Upload Dynamics export daily for delta tracking</div>
        </div>
      </div>

      {/* DAY 1 BANNER */}
      {!hasDelta && (
        <div style={{ background: "#071e2a", border: "1px dashed #63DF4E30", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={15} color="#63DF4E" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ color: "#63DF4E", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>Day 1 Dynamics Baseline ‚Äî {TODAY.length} deals ¬∑ {fmtK(TODAY.reduce((s,d)=>s+d.nnacv,0))} Specialist Pipeline</div>
            <div style={{ color: "#3a6070", fontSize: 11 }}>This is your first Dynamics-sourced snapshot using Specialist Category. Tomorrow, upload your next Dynamics export and say <strong style={{ color: "#c4dce8" }}>"refresh the dashboard"</strong> ‚Äî real day-over-day deltas will appear in the three sections below.</div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 9, padding: "11px 15px", marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Filter size={11} color="#63DF4E" />
          <span style={{ color: "#63DF4E", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Filters</span>
        </div>
        {[
          { lbl: "Quarter", v: qtr, opts: quarters, fn: setQtr },
          { lbl: "Area", v: area, opts: areas, fn: onArea },
          { lbl: "Workflow", v: wf, opts: ["All", "WDF", "RaptorDB"], fn: setWf },
          { lbl: "Spec. Category", v: fc, opts: ["All", "Commit", "Expect", "Upside", "Submitted"], fn: setFc }
        ].map(({ lbl, v, opts, fn }) => (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ color: "#1f4555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{lbl}</span>
            <select value={v} onChange={e => fn(e.target.value)} style={ss}>{opts.map(o => <option key={o}>{o}</option>)}</select>
          </div>
        ))}
        <div style={{ marginLeft: "auto", color: "#1f4555", fontSize: 11, alignSelf: "center" }}>
          {filtered.length} opps ¬∑ <span style={{ color: "#63DF4E", fontWeight: 700 }}>{fmtK(total)}</span>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <KCard lbl="Specialist Pipeline" val={fmtK(total)} sub={`${filtered.length} open deals`} c="#63DF4E" />
        <KCard lbl="Commit" val={fmtK(filtered.filter(d => d.forecast_category === "Commit").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Commit").length} deals`} c="#22d3ee" />
        <KCard lbl="Expect" val={fmtK(filtered.filter(d => d.forecast_category === "Expect").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Expect").length} deals`} c="#a78bfa" />
        <KCard lbl="Upside" val={fmtK(filtered.filter(d => d.forecast_category === "Upside").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Upside").length} deals`} c="#f59e0b" />
        <KCard lbl="Submitted" val={fmtK(filtered.filter(d => d.forecast_category === "Submitted").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Submitted").length} deals`} c="#34d399" />
        <KCard lbl="RaptorDB" val={fmtK(filtered.filter(d => d.workflow === "RaptorDB").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.workflow === "RaptorDB").length} deals`} c="#60a5fa" />
        <KCard lbl="WDF" val={fmtK(filtered.filter(d => d.workflow === "WDF").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.workflow === "WDF").length} deals`} c="#63DF4E" />
      </div>

      {/* CHARTS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 10, padding: "13px 15px" }}>
          <div style={{ color: "#254555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Pipeline by Specialist Category</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={fcChart} barSize={34}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0d2535" />
              <XAxis dataKey="name" stroke="#162e3a" tick={{ fontSize: 11, fill: "#4a7a8a" }} />
              <YAxis stroke="#162e3a" tick={{ fontSize: 9, fill: "#254555" }} tickFormatter={v => fmtK(v)} />
              <Tooltip contentStyle={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 7, color: "#ddeef5" }} formatter={(v, n, p) => [fmtK(v), `${p.payload.n} deals`]} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>{fcChart.map((f, i) => <Cell key={i} fill={FC_COLORS[f.name] || "#4a7a8a"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 10, padding: "13px 15px" }}>
          <div style={{ color: "#254555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Pipeline by Quarter ¬∑ Q1=Jan-Mar ¬∑ Q2=Apr-Jun ¬∑ Q3=Jul-Sep ¬∑ Q4=Oct-Dec</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={qtrChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0d2535" />
              <XAxis dataKey="name" stroke="#162e3a" tick={{ fontSize: 10, fill: "#4a7a8a" }} />
              <YAxis stroke="#162e3a" tick={{ fontSize: 9, fill: "#254555" }} tickFormatter={v => fmtK(v)} />
              <Tooltip contentStyle={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 7, color: "#ddeef5" }} formatter={(v, n, p) => [fmtK(v), `${p.payload.n} deals`]} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>{qtrChart.map((q, i) => <Cell key={i} fill={QTR_COLORS[q.name.slice(0, 2)] || "#63DF4E"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DELTA SECTIONS */}
      {hasDelta ? (
        <>
          <div style={{ color: "#162e3a", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 9 }}>
            Overnight Changes ¬∑ {YESTERDAY_DATE} ‚Üí {TODAY_DATE} ¬∑ {fDeltas.length} changes
          </div>
          <Section title="Category Movement" desc="Deals where Specialist Category changed overnight" accent="#f59e0b" Icon={GitCompare} deals={fMov} empty="No category changes." isDelta={true} />
          <Section title="Pipeline Increase" desc="New deals ¬∑ NNACV increased ¬∑ Stage advanced ¬∑ Close date pulled forward" accent="#22d3ee" Icon={ArrowUpRight} deals={fInc} empty="No pipeline increases." isDelta={true} />
          <Section title="Pipeline Decrease / Risk" desc="Deals removed ¬∑ NNACV reduced ¬∑ Stage regressed ¬∑ Close date pushed out" accent="#f87171" Icon={ArrowDownRight} deals={fDec} empty="No pipeline decreases." isDelta={true} />
        </>
      ) : (
        <>
          <div style={{ color: "#162e3a", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 9 }}>Today's Pipeline ¬∑ Sorted by Specialist Category</div>
          <Section title="Commit + Expect" desc="Deals in Commit or Expect Specialist Category" accent="#22d3ee" Icon={ArrowUpRight} deals={filtered.filter(d => d.forecast_category === "Commit" || d.forecast_category === "Expect").sort((a, b) => b.nnacv - a.nnacv)} empty="No Commit or Expect deals." isDelta={false} />
          <Section title="Upside" desc="Deals in Upside Specialist Category" accent="#f59e0b" Icon={GitCompare} deals={filtered.filter(d => d.forecast_category === "Upside").sort((a, b) => b.nnacv - a.nnacv)} empty="No Upside deals." isDelta={false} />
          <Section title="Submitted" desc="Deals in Submitted status" accent="#34d399" Icon={ArrowDownRight} deals={filtered.filter(d => d.forecast_category === "Submitted").sort((a, b) => b.nnacv - a.nnacv)} empty="No Submitted deals." isDelta={false} />
        </>
      )}

      <div style={{ textAlign: "center", color: "#0d2535", fontSize: 10, marginTop: 10 }}>
        Source: Dynamics 365 ¬∑ Specialist Category ¬∑ Specialist Pipeline ¬∑ {TODAY_DATE} ¬∑ {TODAY.length} open deals
      </div>
    </div>
  );
}

