import { useState, useEffect, useCallback } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { api } from './apiUtils';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const G = '#2e7d4f';
const MONTHLY_VISITORS = 10000;
const LABELS = { document: 'Document', image: 'Images', stylesheet: 'Stylesheets', script: 'Scripts', font: 'Fonts', media: 'Media', other: 'Other' };
const ICONS = { Document: '📄', Images: '🖼️', Stylesheets: '🎨', Scripts: '⚙️', Fonts: '🔤', Media: '🎬', Other: '📦' };

const num = (v, d = 1) => (v === null || v === undefined || isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
const fmtBytes = (b) => {
  b = Number(b) || 0;
  return b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;
};

function parseBreakdown(rb) {
  return Object.entries(rb || {})
    .filter(([k]) => !['total', 'third-party'].includes(k))
    .map(([k, v]) => ({ name: LABELS[k] || k, bytes: Number(v?.transferSize || 0), count: v?.requestCount ?? 0 }))
    .filter((i) => i.bytes > 0)
    .sort((x, y) => y.bytes - x.bytes);
}

const Card = ({ title, icon, right, children, className = '' }) => (
  <section className={`rounded-2xl bg-white/80 border border-[#dfe9dc] shadow-sm p-5 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-semibold text-[#1d4d33]">{icon} {title}</h2>
        {right}
      </div>
    )}
    {children}
  </section>
);

const Stat = ({ label, value, unit, bg, note }) => (
  <div className={`rounded-2xl border border-[#dfe9dc] p-4 ${bg}`}>
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-3xl font-bold text-[#1d4d33] mt-1">{value}<span className="text-sm font-normal text-gray-600 ml-1">{unit}</span></p>
    <p className="text-xs mt-2 text-gray-500">{note}</p>
  </div>
);

function Ring({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = 62, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 160 160" className="w-44 h-44 mx-auto">
      <circle cx="80" cy="80" r={r} fill="none" stroke="#e3eee0" strokeWidth="14" />
      <circle cx="80" cy="80" r={r} fill="none" stroke={G} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 80 80)"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="80" y="82" textAnchor="middle" fontSize="38" fontWeight="700" fill="#1d4d33">{Math.round(v)}</text>
      <text x="80" y="104" textAnchor="middle" fontSize="13" fill="#6b7280">/100</text>
    </svg>
  );
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(null);
  const [history, setHistory] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [waste, setWaste] = useState(null);
  const [sim, setSim] = useState(null);
  const [opt, setOpt] = useState(null);
  const [optBusy, setOptBusy] = useState(false);
  const [panelErr, setPanelErr] = useState({});

  const setErr = (k, m) => setPanelErr((x) => ({ ...x, [k]: m }));

  const loadHistory = useCallback(async () => {
    try {
      const j = await api('/api/history', {}, 'GET');
      setHistory(j.history || []);
    } catch { /* dashboard still works without it */ }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const loadSupport = async (d) => {
    let t;
    try { t = await api('/api/traffic-summary', {}, 'GET'); setTraffic(t); }
    catch (e) { setErr('traffic', e.message); return; }
    try {
      setWaste(await api('/api/waste-estimate', {
        total_sessions: t.total_sessions, bot_sessions: t.bot_sessions,
        total_page_size_bytes: d.total_page_size_bytes, co2_per_visit_g: d.co2_per_visit_g,
      }));
    } catch (e) { setErr('waste', e.message); }
    try {
      setSim(await api('/api/simulate-impact', {
        total_page_size_bytes: d.total_page_size_bytes, monthly_visitors: MONTHLY_VISITORS,
        bot_traffic_percent: t.anomaly_percentage,
      }));
    } catch (e) { setErr('sim', e.message); }
  };

  const analyze = async () => {
    const input = url.trim();
    if (!input) return setError('Please enter a website URL.');
    const u = /^https?:\/\//i.test(input) ? input : 'https://' + input;
    setLoading(true); setError(''); setTraffic(null); setWaste(null); setSim(null); setOpt(null); setPanelErr({});
    try {
      const d = await api('/api/analyze?url=' + encodeURIComponent(u), {}, 'GET');
      if (d.error) throw new Error(d.error);
      setRaw(d);
      loadHistory();
      loadSupport(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const runOptimizer = async () => {
    if (!raw) return;
    setOptBusy(true); setOpt(null); setErr('opt', '');
    try {
      setOpt(await api('/api/optimize', {
        resource_breakdown: raw.resource_breakdown,
        total_page_size_bytes: raw.total_page_size_bytes,
        monthly_visitors: MONTHLY_VISITORS,
      }));
    } catch (e) { setErr('opt', e.message); }
    finally { setOptBusy(false); }
  };

  const items = raw ? parseBreakdown(raw.resource_breakdown) : [];
  const totalBytes = raw?.total_page_size_bytes || 0;
  const prev = raw ? history.filter((h) => h.url === raw.url)[1] : null;
  const scoreDelta = prev && prev.green_score ? ((raw.green_score - prev.green_score) / prev.green_score) * 100 : null;

  const hist = [...history].reverse();
  const hLabels = hist.map((h, i) => (h.scan_date ? String(h.scan_date).slice(5, 10) : `#${i + 1}`));

  const verdict = !raw ? '' : raw.green_score >= 80 ? 'Excellent sustainability performance!'
    : raw.green_score >= 60 ? 'Good sustainability performance!' : 'Needs improvement. See recommendations.';

  const recs = [];
  items.slice(0, 3).forEach((i) => {
    const n = i.name.toLowerCase();
    if (n.includes('script')) recs.push(['Remove unused JavaScript', `Scripts are ${fmtBytes(i.bytes)}. Defer, split or minify.`]);
    else if (n.includes('image')) recs.push(['Optimize images', 'Use WebP/AVIF and lazy loading.']);
    else if (n.includes('style')) recs.push(['Trim CSS', `Stylesheets are ${fmtBytes(i.bytes)}. Remove unused rules.`]);
    else if (n.includes('font')) recs.push(['Optimize web fonts', 'Subset fonts and use font-display: swap.']);
    else recs.push([`Reduce ${i.name} payload`, `${fmtBytes(i.bytes)} transferred.`]);
  });
  if (raw) recs.push(['Enable caching', 'Long cache headers cut repeat-visit bytes.']);
  if (traffic?.bot_sessions > 0) recs.push(['Investigate flagged traffic', `${num(traffic.anomaly_percentage, 1)}% of sessions look anomalous.`]);

  return (
    <div className="min-h-screen bg-[#f4f8f1] text-gray-800 flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-[#eef4ea] border-b border-[#dfe9dc]">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌱</span>
          <div>
            <h1 className="text-2xl font-bold text-[#1d4d33] leading-none">BytePrune</h1>
            <p className="text-xs text-gray-600">Clean Code. Lower Carbon. Better Web.</p>
          </div>
        </div>
        <div className="text-right text-sm"><p className="font-semibold text-[#1d4d33]">Harini Reddy</p><p className="text-gray-500 text-xs">Admin</p></div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 p-4 gap-1 bg-[#eef4ea] border-r border-[#dfe9dc]">
          {[['#top', '🏠 Dashboard'], ['#top', '🔍 Analyze Website'], ['#agent', '📄 Reports'], ['#history', '🕘 History'], ['#top', '⚙️ Settings']].map(([h, t]) => (
            <a key={t} href={h} className="block px-4 py-2.5 rounded-lg text-[#1d4d33] hover:bg-[#2e7d4f] hover:text-white transition">{t}</a>
          ))}
          <div className="mt-auto text-center text-sm text-[#1d4d33] pt-10"><div className="text-5xl">🌍</div>Greener Websites<br />for a Healthier Planet</div>
        </aside>

        <main id="top" className="flex-1 p-6 space-y-6 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-[#1d4d33]">Welcome back, Harini!</h2>
              <p className="text-gray-600">Analyze. Optimize. Make the web more sustainable.</p>
            </div>
            <div className="flex w-full lg:w-[520px] bg-white rounded-xl border border-[#dfe9dc] shadow-sm overflow-hidden">
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && analyze()}
                placeholder="Enter website URL (e.g. https://example.com)" className="flex-1 px-4 py-3 outline-none text-sm" />
              <button onClick={analyze} disabled={loading} className="px-6 bg-[#2e7d4f] hover:bg-[#256a42] text-white font-semibold disabled:opacity-60">
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>}
          {loading && <div className="text-center py-6 text-[#2e7d4f]">⏳ Running PageSpeed analysis… this can take up to a minute.</div>}
          {!raw && !loading && <Card><p className="text-gray-600">Enter a URL above and click <b>Analyze</b> to see your Green Score, carbon footprint, traffic analysis and optimization plan.</p></Card>}

          {raw && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Stat label="Carbon Footprint" value={num(raw.co2_per_visit_g, 3)} unit="g CO₂ / visit" bg="bg-[#eef6ec]" note={`≈ ${num(raw.co2_monthly_kg, 2)} kg/month at ${MONTHLY_VISITORS.toLocaleString()} visits`} />
                <Stat label="Green Score" value={Math.round(raw.green_score)} unit="/ 100" bg="bg-[#eef6ec]"
                  note={scoreDelta === null ? 'no previous scan of this site' : `${scoreDelta <= 0 ? '↓' : '↑'} ${Math.abs(scoreDelta).toFixed(0)}% vs. previous analysis`} />
                <Stat label="Page Size" value={fmtBytes(totalBytes).split(' ')[0]} unit={fmtBytes(totalBytes).split(' ')[1]} bg="bg-[#eef5f8]" note={`${items.length} resource types`} />
                <Stat label="Load Time (Speed Index)" value={num(raw.load_time_ms / 1000, 2)} unit="s" bg="bg-[#f1eefa]" note="from PageSpeed" />
                <Stat label="Total Requests" value={raw.num_requests || '—'} unit="" bg="bg-[#fbf6e6]" note="network requests" />
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <Card title="Green Score History" icon="📈">
                  {hist.length ? <Line data={{ labels: hLabels, datasets: [{ label: 'Green Score', data: hist.map((h) => h.green_score), borderColor: G, backgroundColor: 'rgba(46,125,79,.12)', fill: true, tension: 0.3 }] }} options={{ plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} />
                    : <p className="text-sm text-gray-500">Run more scans to build history.</p>}
                </Card>
                <Card title="Carbon Score Trend" icon="🌿">
                  {hist.length ? <Bar data={{ labels: hLabels, datasets: [{ label: 'Carbon sub-score', data: hist.map((h) => h.carbon_score), backgroundColor: '#4c9a65' }] }} options={{ plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }} />
                    : <p className="text-sm text-gray-500">Run more scans to build history.</p>}
                </Card>
                <Card title="Green Score" icon="🍃">
                  <Ring value={raw.green_score} />
                  <p className="text-center font-semibold text-[#1d4d33] mt-2">{verdict}</p>
                  <div className="flex justify-center gap-6 text-sm text-gray-600 mt-2">
                    <span>Performance: <b>{raw.performance_sub_score}</b></span><span>Carbon: <b>{raw.carbon_sub_score}</b></span>
                  </div>
                </Card>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <Card title="Traffic Analysis" icon="👥">
                  {panelErr.traffic && <p className="text-sm text-red-600">{panelErr.traffic}</p>}
                  {!traffic && !panelErr.traffic && <p className="text-sm text-gray-500">Loading traffic analysis…</p>}
                  {traffic && (
                    <div className="flex items-center gap-4">
                      <div className="w-36"><Doughnut data={{ labels: ['Normal', 'Flagged'], datasets: [{ data: [traffic.normal_sessions, traffic.bot_sessions], backgroundColor: [G, '#e5a93b'] }] }} options={{ cutout: '65%', plugins: { legend: { display: false } } }} /></div>
                      <div className="text-sm space-y-1">
                        <p>Sessions: <b>{traffic.total_sessions}</b></p>
                        <p>Normal: <b>{traffic.normal_sessions}</b></p>
                        <p>Flagged: <b>{traffic.bot_sessions}</b> ({num(traffic.anomaly_percentage, 1)}%)</p>
                        <p className="text-xs text-gray-400">Isolation Forest on synthetic data. Flagged ≠ confirmed malicious.</p>
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Resource Waste Analysis" icon="♻️">
                  {panelErr.waste && <p className="text-sm text-red-600">{panelErr.waste}</p>}
                  {waste && (
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div className="rounded-lg bg-[#fbf6e6] p-3"><p className="text-gray-500">Wasted bandwidth</p><p className="font-bold text-lg">{fmtBytes(waste.wasted_bandwidth_bytes)}</p></div>
                      <div className="rounded-lg bg-[#fbf6e6] p-3"><p className="text-gray-500">Wasted CO₂</p><p className="font-bold text-lg">{num(waste.wasted_co2_g, 2)} g</p></div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mb-2">Share of page weight by resource type:</p>
                  {items.slice(0, 4).map((i) => {
                    const p = (i.bytes / totalBytes) * 100;
                    return (
                      <div key={i.name} className="mb-2">
                        <div className="flex justify-between text-sm"><span>{ICONS[i.name] || '📦'} {i.name}</span><span>{p.toFixed(0)}%</span></div>
                        <div className="h-2 bg-gray-200 rounded"><div className="h-2 rounded bg-[#4c9a65]" style={{ width: `${p}%` }} /></div>
                      </div>
                    );
                  })}
                </Card>

                <Card title="AI Recommendations" icon="✨">
                  <ul className="space-y-2">
                    {recs.slice(0, 4).map(([t, s]) => (
                      <li key={t} className="rounded-lg border border-[#dfe9dc] p-3"><p className="font-medium text-sm">{t}</p><p className="text-xs text-gray-500">{s}</p></li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card title="Before / After Impact Simulator" icon="📉" right={<span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">SIMULATED PROJECTION</span>}>
                  {panelErr.sim && <p className="text-sm text-red-600">{panelErr.sim}</p>}
                  {!sim && !panelErr.sim && <p className="text-sm text-gray-500">Loading simulation…</p>}
                  {sim?.before && (
                    <>
                      <Bar data={{ labels: ['Monthly CO₂ (kg)'], datasets: [
                        { label: 'Before', data: [sim.before.co2_monthly_kg], backgroundColor: '#e5a93b' },
                        { label: 'After (projected)', data: [sim.after.co2_monthly_kg], backgroundColor: G }] }} />
                      <p className="text-sm mt-3">
                        Visitors: {sim.before.monthly_visitors.toLocaleString()} → {sim.after.monthly_visitors.toLocaleString()} ·
                        CO₂ saved: <b>{num(sim.co2_saved_monthly_kg, 3)} kg/month</b> ·
                        Green Score: {sim.before.green_score} → {sim.after.green_score} ({sim.green_score_improvement >= 0 ? '+' : ''}{sim.green_score_improvement})
                      </p>
                      <p className="text-[11px] text-gray-400">Simulates removing flagged bot traffic. Projection only; no live website was modified.</p>
                    </>
                  )}
                </Card>

                <Card title="Agentic Optimization Log" icon="🧠" right={<button onClick={runOptimizer} disabled={optBusy} className="px-4 py-2 rounded-lg bg-[#2e7d4f] hover:bg-[#256a42] disabled:opacity-50 text-white text-sm font-semibold">{optBusy ? 'Running…' : 'Run Optimizer'}</button>}>
                  <div id="agent" />
                  {panelErr.opt && <p className="text-sm text-red-600">{panelErr.opt}</p>}
                  {!opt && !optBusy && <p className="text-sm text-gray-500">Click “Run Optimizer” to run the plan → act → observe → re-plan loop.</p>}
                  {optBusy && <p className="text-sm text-[#2e7d4f]">Agent is working…</p>}
                  {opt?.before && (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="rounded-lg bg-[#fbf6e6] p-2">
                          <p className="text-xs text-gray-500">Green Score</p>
                          <p className="font-bold text-lg">{opt.before.green_score} → {opt.after.green_score}</p>
                          <p className="text-xs text-green-700">{opt.green_score_improvement >= 0 ? '+' : ''}{opt.green_score_improvement}</p>
                        </div>
                        <div className="rounded-lg bg-[#eef6ec] p-2">
                          <p className="text-xs text-gray-500">Monthly CO₂ (kg)</p>
                          <p className="font-bold text-lg">{num(opt.before.co2_monthly_kg, 2)} → {num(opt.after.co2_monthly_kg, 2)}</p>
                          <p className="text-xs text-green-700">−{num(opt.co2_saved_monthly_kg, 2)} kg</p>
                        </div>
                        <div className="rounded-lg bg-[#eef5f8] p-2">
                          <p className="text-xs text-gray-500">Page weight</p>
                          <p className="font-bold text-sm mt-1">{fmtBytes(opt.before.total_bytes)} → {fmtBytes(opt.after.total_bytes)}</p>
                        </div>
                      </div>
                      <ol className="space-y-2 max-h-64 overflow-auto text-sm">
                        {(opt.action_log || []).map((s) => (
                          <li key={s.step} className="rounded-lg bg-[#f4f8f1] border border-[#dfe9dc] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#1d4d33]">Step {s.step}: {String(s.action).replace(/_/g, ' ')}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{s.green_score_before} → {s.green_score_after}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{s.description}</p>
                            <p className="text-xs text-gray-500 mt-1">Estimated saving: {fmtBytes(s.bytes_saved)}</p>
                          </li>
                        ))}
                        {(!opt.action_log || opt.action_log.length === 0) && (
                          <li className="text-sm text-gray-500">No further optimizations were needed.</li>
                        )}
                      </ol>
                      <p className="text-[11px] text-gray-400 mt-2">Simulated optimization using estimated reductions. No live website was modified.</p>
                    </>
                  )}
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card title="Website Sustainability Insights" icon="🌍">
                  <ul className="space-y-2 text-sm">
                    <li>✅ Estimated footprint: {num(raw.co2_per_visit_g, 3)} g CO₂ per visit (~{num(raw.co2_monthly_kg, 2)} kg/month).</li>
                    <li>✅ Page weight is {fmtBytes(totalBytes)} across {raw.num_requests} requests.</li>
                    {items[0] && <li>✅ Largest resource category: {items[0].name} ({fmtBytes(items[0].bytes)}).</li>}
                    {traffic && <li>✅ {num(traffic.anomaly_percentage, 1)}% of analyzed (synthetic) sessions were flagged as anomalous.</li>}
                  </ul>
                  <p className="text-[11px] text-gray-400 mt-3">Carbon values are estimates from transfer size, not direct energy measurements.</p>
                </Card>

                <Card title="Recent Analysis History" icon="🕘" right={<button onClick={loadHistory} className="text-xs text-[#2e7d4f]">↻ Refresh</button>}>
                  <div id="history" />
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 text-xs"><th>Date</th><th>URL</th><th>Score</th><th>Carbon</th></tr></thead>
                    <tbody>
                      {history.slice(0, 6).map((h, i) => (
                        <tr key={i} className="border-t border-[#eef2ea]">
                          <td className="py-1.5">{h.scan_date ? String(h.scan_date).slice(0, 10) : '—'}</td>
                          <td className="truncate max-w-[160px]">{String(h.url).replace(/^https?:\/\//, '')}</td>
                          <td><span className="px-2 rounded-full bg-green-100 text-green-800">{Math.round(h.green_score)}</span></td>
                          <td>{Math.round(h.carbon_score)}</td>
                        </tr>
                      ))}
                      {history.length === 0 && <tr><td colSpan="4" className="py-3 text-gray-500">No history yet.</td></tr>}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="px-6 py-3 bg-[#2f5d42] text-white text-sm flex justify-between">
        <span><b>BytePrune</b> | Vardhaman College of Engineering</span>
        <span>Smarter Websites. A Greener Tomorrow.</span>
      </footer>
    </div>
  );
}