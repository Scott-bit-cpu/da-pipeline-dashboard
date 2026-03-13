import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown, ChevronUp, Filter, Database, ArrowUpRight, ArrowDownRight, GitCompare, RefreshCw } from "lucide-react";
import { TODAY, YESTERDAY, TODAY_DATE, YESTERDAY_DATE } from "./data";

const STAGE_MAP = {
  "1 - Target (1%)":1,"2 - Discovery (5%)":5,"3 - Objectives (10%)":10,
  "4 - Sponsor (20%)":20,"4 - Economic Buyer Identified (30%)":30,
  "4 - Present Solution (20%)":20,"5 - Economic Buyer Validation (40%)":40,
  "6 - Proposal (50%)":50,"6 - Validation Completed (70%)":70,
  "7 - Verbal Agreement (75%)":75,"7 - Deal Imminent (90%)":90,
  "8 - Contracting (90%)":90,"9 - Closed Won (100%)":100
};
const spct = (s) => {
  const v = STAGE_MAP[s];
  if (v !== undefined) return v;
  const m = (s || "").match(/\((\d+)%\)/);
  return m ? parseInt(m[1]) : 0;
};
const FC_RANK = { Upside: 1, Submitted: 2, Expect: 3, Commit: 4 };
const fmtK = (n) => {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1000000) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
};
const FC_COLORS = { Commit: "#22d3ee", Expect: "#a78bfa", Upside: "#f59e0b", Submitted: "#34d399" };

function computeDeltas(today, yesterday) {
  if (!yesterday || !yesterday.length) return [];
  const tMap = Object.fromEntries(today.map(d => [d.id, d]));
  const yMap = Object.fromEntries(yesterday.map(d => [d.id, d]));
  const allIds = new Set([...Object.keys(tMap), ...Object.keys(yMap)]);
  const out = [];
  for (const id of allIds) {
    const t = tMap[id], y = yMap[id];
    if (t && !y) {
      out.push({ ...t, flags: ["new"], section: "increase", delta_nnacv: t.nnacv, change_label: "New deal entered pipeline", prev: null });
      continue;
    }
    if (y && !t) {
      out.push({ ...y, flags: ["removed"], section: "decrease", delta_nnacv: -y.nnacv, change_label: "Removed from pipeline", prev: null });
      continue;
    }
    const flags = [], labels = [];
    const tf = FC_RANK[t.forecast_category] || 0;
    const yf = FC_RANK[y.forecast_category] || 0;
    const tp = spct(t.stage), yp = spct(y.stage);
    const nd = t.nnacv - y.nnacv;
    if (tf > yf) { flags.push("fc_upgraded"); labels.push(`${y.forecast_category} ‚Üí ${t.forecast_category}`); }
    if (tf < yf) { flags.push("fc_downgraded"); labels.push(`${y.forecast_category} ‚Üí ${t.forecast_category} ‚Üì`); }
    if (nd > 1000) { flags.push("nnacv_up"); labels.push(`NNACV +${fmtK(nd)}`); }
    if (nd < -1000) { flags.push("nnacv_down"); labels.push(`NNACV ${fmtK(nd)}`); }
    if (t.close_date > y.close_date) { flags.push("date_pushed"); labels.push(`Close pushed ‚Üí ${t.close_date}`); }
    if (t.close_date < y.close_date) { flags.push("date_pulled"); labels.push(`Close pulled ‚Üí ${t.close_date}`); }
    if (tp > yp) { flags.push("stage_up"); labels.push(`Stage ${yp}%‚Üí${tp}%`); }
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
  return <span style={{ background: `${c}15`, color: c, border: `1px solid ${c}30`, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{wf === "Workflow Data Fabric" ? "WDF" : wf}</span>;
};

const StagePip = ({ pct }) => {
  const c = pct >= 70 ? "#22d3ee" : pct >= 40 ? "#a78bfa" : pct >= 20 ? "#f59e0b" : "#374151";
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
          <div style={{ color: "#3a6070", fontSize: 10, maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.opty_name}</div>
        </td>
        <td style={{ padding: "9px 12px" }}><WFChip wf={d.workflow} /></td>
        <td style={{ padding: "9px 12px" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#ddeef5" }}>{fmtK(d.nnacv)}</div>
          {isDelta && d.delta_nnacv !== 0 && <div style={{ fontSize: 10, color: nc, fontWeight: 700 }}>{d.delta_nnacv > 0 ? "+" : ""}{fmtK(d.delta_nnacv)}</div>}
        </td>
        <td style={{ padding: "9px 12px" }}><FCBadge fc={d.forecast_category} /></td>
        <td style={{ padding: "9px 12px" }}><StagePip pct={spct(d.stage)} /></td>
        <td style={{ padding: "9px 12px", color: "#4a7a8a", fontSize: 11 }}>{d.close_date}</td>
        {isDelta && <td style={{ padding: "9px 12px", color: "#5a8fa3", fontSize: 10, fontStyle: "italic", maxWidth: 190 }}>{d.change_label}</td>}
        <td style={{ padding: "9px 12px", textAlign: "center" }}>
          {open ? <ChevronUp size={12} color="#3a6070" /> : <ChevronDown size={12} color="#3a6070" />}
        </td>
      </tr>
      {open && (
        <tr style={{ background: "#081d2c" }}>
          <td colSpan={isDelta ? 8 : 7} style={{ padding: "6px 12px 12px 24px" }}>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 11 }}>
              <span style={{ color: "#3a6070" }}>Stage: <span style={{ color: "#9ecfe0" }}>{d.stage}</span></span>
              <span style={{ color: "#3a6070" }}>Area: <span style={{ color: "#9ecfe0" }}>{(d.area || "").replace(" (AREA)", "")}</span></span>
              <span style={{ color: "#3a6070" }}>Region: <span style={{ color: "#9ecfe0" }}>{(d.region || "").replace(" (Region)", "")}</span></span>
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
    ? ["Account", "Workflow", "NNACV / Œî", "Forecast", "Stage", "Close", "Change", ""]
    : ["Account", "Workflow", "NNACV", "Forecast", "Stage", "Close Date", ""];
  return (
    <div style={{ marginBottom: 14, borderRadius: 11, overflow: "hidden", border: `1px solid ${accent}22` }}>
      <div onClick={() => setClosed(!closed)} style={{ background: `${accent}08`, padding: "12px 15px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: closed ? "none" : `1px solid ${accent}18` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ background: `${accent}18`, borderRadius: 7, padding: "5px 6px", display: "flex" }}>
            <Icon size={13} color={accent} />
          </div>
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
  const deltas = useMemo(() => computeDeltas(TODAY, YESTERDAY), []);

  const areas = useMemo(() => ["All Areas", ...new Set(TODAY.map(d => d.area).filter(Boolean))].sort((a, b) => a === "All Areas" ? -1 : a.localeCompare(b)), []);
  const [area, setArea] = useState("All Areas");
  const regions = useMemo(() => {
    const base = area === "All Areas" ? TODAY : TODAY.filter(d => d.area === area);
    return ["All Regions", ...new Set(base.map(d => d.region).filter(Boolean))].sort((a, b) => a === "All Regions" ? -1 : a.localeCompare(b));
  }, [area]);
  const [region, setRegion] = useState("All Regions");
  const [wf, setWf] = useState("All");
  const [fc, setFc] = useState("All");
  const onArea = (v) => { setArea(v); setRegion("All Regions"); };

  const filtered = useMemo(() => TODAY.filter(d =>
    (area === "All Areas" || d.area === area) &&
    (region === "All Regions" || d.region === region) &&
    (wf === "All" || d.workflow === wf) &&
    (fc === "All" || d.forecast_category === fc)
  ), [area, region, wf, fc]);

  const fDeltas = useMemo(() => deltas.filter(d =>
    (area === "All Areas" || d.area === area) &&
    (region === "All Regions" || d.region === region) &&
    (wf === "All" || d.workflow === wf) &&
    (fc === "All" || d.forecast_category === fc)
  ), [deltas, area, region, wf, fc]);

  const fMov = fDeltas.filter(d => d.section === "movement").sort((a, b) => b.nnacv - a.nnacv);
  const fInc = fDeltas.filter(d => d.section === "increase").sort((a, b) => b.delta_nnacv - a.delta_nnacv);
  const fDec = fDeltas.filter(d => d.section === "decrease").sort((a, b) => a.delta_nnacv - b.delta_nnacv);

  const total = filtered.reduce((s, d) => s + d.nnacv, 0);
  const prevTotal = YESTERDAY.reduce((s, d) => s + d.nnacv, 0);
  const netDelta = total - prevTotal;

  const fcChart = ["Commit", "Expect", "Upside", "Submitted"].map(f => ({
    name: f,
    v: filtered.filter(d => d.forecast_category === f).reduce((s, d) => s + d.nnacv, 0),
    n: filtered.filter(d => d.forecast_category === f).length
  })).filter(x => x.v > 0);

  const areaChart = [...new Set(filtered.map(d => d.area).filter(Boolean))].map(a => ({
    name: a.replace(" (AREA)", "").replace("AMS Commercial ", "").replace("Canada ", "CA "),
    v: filtered.filter(d => d.area === a).reduce((s, d) => s + d.nnacv, 0)
  })).sort((a, b) => b.v - a.v).slice(0, 7);

  const ss = { background: "#071e2a", border: "1px solid #162e3a", borderRadius: 6, color: "#8ab8c8", padding: "6px 10px", fontSize: 11, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none", minWidth: 150 };

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
            <span style={{ color: "#63DF4E", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Live ¬∑ Snowflake ¬∑ D&A Pipeline Intelligence</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>RaptorDB + WDF ¬∑ Daily Delta</h1>
          <div style={{ color: "#254555", fontSize: 11, marginTop: 3 }}>{TODAY_DATE} vs {YESTERDAY_DATE} ¬∑ {deltas.length} changes detected ¬∑ {filtered.length} deals today</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ background: "#63DF4E12", border: "1px solid #63DF4E28", borderRadius: 7, padding: "4px 12px", fontSize: 10, color: "#63DF4E", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <RefreshCw size={9} /> {TODAY_DATE} ¬∑ {TODAY.length} deals
          </div>
          <div style={{ color: netDelta >= 0 ? "#63DF4E" : "#f87171", fontSize: 12, fontWeight: 700 }}>Net overnight: {netDelta > 0 ? "+" : ""}{fmtK(netDelta)}</div>
          <div style={{ color: "#254555", fontSize: 10, marginTop: 2 }}>Say "refresh the dashboard" tomorrow</div>
        </div>
      </div>

      <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 9, padding: "11px 15px", marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Filter size={11} color="#63DF4E" />
          <span style={{ color: "#63DF4E", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Filters</span>
        </div>
        {[{ lbl: "Area", v: area, opts: areas, fn: onArea }, { lbl: "Region", v: region, opts: regions, fn: setRegion }, { lbl: "Workflow", v: wf, opts: ["All", "WDF", "RaptorDB"], fn: setWf }, { lbl: "Forecast", v: fc, opts: ["All", "Commit", "Expect", "Upside", "Submitted"], fn: setFc }].map(({ lbl, v, opts, fn }) => (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ color: "#1f4555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{lbl}</span>
            <select value={v} onChange={e => fn(e.target.value)} style={ss}>{opts.map(o => <option key={o}>{o}</option>)}</select>
          </div>
        ))}
        <div style={{ marginLeft: "auto", color: "#1f4555", fontSize: 11, alignSelf: "center" }}>{filtered.length} opps ¬∑ <span style={{ color: "#63DF4E", fontWeight: 700 }}>{fmtK(total)}</span></div>
      </div>

      <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
        <KCard lbl="Total Pipeline" val={fmtK(total)} delta={netDelta} c="#63DF4E" />
        <KCard lbl="Commit" val={fmtK(filtered.filter(d => d.forecast_category === "Commit").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Commit").length} deals`} c="#22d3ee" />
        <KCard lbl="Expect" val={fmtK(filtered.filter(d => d.forecast_category === "Expect").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Expect").length} deals`} c="#a78bfa" />
        <KCard lbl="Upside" val={fmtK(filtered.filter(d => d.forecast_category === "Upside").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Upside").length} deals`} c="#f59e0b" />
        <KCard lbl="Submitted" val={fmtK(filtered.filter(d => d.forecast_category === "Submitted").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.forecast_category === "Submitted").length} deals`} c="#34d399" />
        <KCard lbl="RaptorDB" val={fmtK(filtered.filter(d => d.workflow === "RaptorDB").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.workflow === "RaptorDB").length} deals`} c="#60a5fa" />
        <KCard lbl="WDF" val={fmtK(filtered.filter(d => d.workflow === "WDF").reduce((s, d) => s + d.nnacv, 0))} sub={`${filtered.filter(d => d.workflow === "WDF").length} deals`} c="#63DF4E" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 10, padding: "13px 15px" }}>
          <div style={{ color: "#254555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Pipeline by Forecast Category</div>
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
          <div style={{ color: "#254555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Pipeline by Area</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={areaChart} layout="vertical" barSize={11}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0d2535" />
              <XAxis type="number" stroke="#162e3a" tick={{ fontSize: 9, fill: "#254555" }} tickFormatter={v => fmtK(v)} />
              <YAxis dataKey="name" type="category" stroke="#162e3a" tick={{ fontSize: 9, fill: "#4a7a8a" }} width={90} />
              <Tooltip contentStyle={{ background: "#071e2a", border: "1px solid #162e3a", borderRadius: 7, color: "#ddeef5" }} formatter={v => [fmtK(v), "Pipeline"]} />
              <Bar dataKey="v" radius={[0, 4, 4, 0]} fill="#63DF4E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ color: "#162e3a", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 9 }}>
        Overnight Changes ¬∑ {YESTERDAY_DATE} ‚Üí {TODAY_DATE} ¬∑ {deltas.length} changes ¬∑ net {netDelta >= 0 ? "+" : ""}{fmtK(netDelta)}
      </div>

      <Section title="Category Movement" desc="Deals where forecast category changed overnight" accent="#f59e0b" Icon={GitCompare} deals={fMov} empty="No category changes overnight with current filters." isDelta={true} />
      <Section title="Pipeline Increase" desc="New deals ¬∑ NNACV increased ¬∑ Stage advanced ¬∑ Close date pulled forward" accent="#22d3ee" Icon={ArrowUpRight} deals={fInc} empty="No pipeline increases overnight with current filters." isDelta={true} />
      <Section title="Pipeline Decrease / Risk" desc="Deals removed ¬∑ NNACV reduced ¬∑ Stage regressed ¬∑ Close date pushed out" accent="#f87171" Icon={ArrowDownRight} deals={fDec} empty="No pipeline decreases overnight with current filters." isDelta={true} />

      <div style={{ textAlign: "center", color: "#0d2535", fontSize: 10, marginTop: 10 }}>
        Source: Snowflake ¬∑ cdl.sales.v_sales_deal_search ¬∑ BU: RaptorDB + WDF ¬∑ AMS ¬∑ {YESTERDAY_DATE} ‚Üí {TODAY_DATE} ¬∑ {TODAY.length} deals today
      </div>
    </div>
  );
}

