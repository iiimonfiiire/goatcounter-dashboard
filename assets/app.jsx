const { useState, useEffect, useRef, useMemo, useCallback } = React;
const {
  AreaChart, Area, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} = Recharts;

/* ---------- helpers ---------- */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const daysBetween = (a, b) => Array.from({ length: diffDays(a, b) + 1 }, (_, i) => addDays(a, i));
const sum = (a) => (a || []).reduce((x, y) => x + (y || 0), 0);
const dayOf = (s) => String(s.day).slice(0, 10);
const dailyOf = (s) => (s.daily != null ? s.daily : sum(s.hourly));
const nf = new Intl.NumberFormat('en-US');
const nfc = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (n) => (n >= 100000 ? nfc.format(n) : nf.format(Math.round(n)));
const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(n / d >= 0.1 ? 0 : 1)}%` : '0%');
const fmtDay = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CUSTOM_DAYS = 366;

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'custom', label: 'Custom' },
];

function resolveRange(state) {
  const today = ymd(new Date());
  if (state.preset === 'custom') return { from: state.from, to: state.to };
  const n = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[state.preset] || 30;
  return { from: addDays(today, -(n - 1)), to: today };
}

function previousRange({ from, to }) {
  const n = diffDays(from, to) + 1;
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

const rangeParams = ({ from, to }) => ({ start: `${from}T00:00:00Z`, end: `${to}T23:59:59Z` });

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const preset = PRESETS.some((p) => p.id === q.get('range')) ? q.get('range') : '30d';
  const today = ymd(new Date());
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const state = { preset, from: valid(q.get('from')) ? q.get('from') : addDays(today, -29), to: valid(q.get('to')) ? q.get('to') : today };
  if (state.preset === 'custom' && (state.from > state.to || diffDays(state.from, state.to) >= MAX_CUSTOM_DAYS)) state.preset = '30d';
  const staticHost = /\.github\.io$/.test(window.location.hostname);
  return { state, demo: q.get('demo') === '1' || staticHost };
}

/* ---------- demo data ---------- */

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_CURVE = [0.3, 0.2, 0.15, 0.12, 0.12, 0.2, 0.4, 0.7, 1, 1.3, 1.5, 1.5, 1.4, 1.5, 1.6, 1.5, 1.3, 1.1, 1.1, 1.2, 1.3, 1.1, 0.8, 0.5];

function demoDay(day) {
  const r = rng(`day:${day}`);
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
  const weekday = wd === 0 || wd === 6 ? 0.7 : 1.05;
  const base = 160 * weekday * (0.8 + r() * 0.5);
  const hourly = HOUR_CURVE.map((w) => Math.round((base / 24) * w * (0.6 + r() * 0.8)));
  return { day, hourly, daily: sum(hourly) };
}

const DEMO_PATHS = [
  ['/blog/why-i-moved-to-sqlite', 'Why I moved to SQLite', 9],
  ['/', 'Home', 8],
  ['/blog/tiny-static-sites', 'Tiny static sites', 6],
  ['/projects', 'Projects', 4.5],
  ['/blog/home-server-notes', 'Home server notes', 4],
  ['/about', 'About', 3],
  ['/blog/nginx-envsubst-tricks', 'nginx envsubst tricks', 2.6],
  ['/blog/dark-mode-done-right', 'Dark mode done right', 2.2],
  ['/uses', 'Uses', 1.6],
  ['/blog/rss-is-not-dead', 'RSS is not dead', 1.2],
];

const DEMO_PAGES = {
  browsers: [['Chrome', 52], ['Safari', 22], ['Firefox', 12], ['Edge', 6], ['Samsung Internet', 3], ['Opera', 2], ['Brave', 1.5], ['Vivaldi', 0.8]],
  systems: [['Windows', 34], ['macOS', 24], ['Android', 20], ['iOS', 14], ['Linux', 6], ['ChromeOS', 2]],
  sizes: [['Desktop', 38], ['Desktop HD', 21], ['Phones', 18], ['Large phones', 14], ['Tablets', 6], ['Larger than HD', 3]],
  languages: [['English', 58], ['German', 9], ['Spanish', 7], ['French', 6], ['Portuguese', 4], ['Hebrew', 3.5], ['Japanese', 3], ['Dutch', 2.5], ['Italian', 2.5], ['Polish', 2]],
  locations: [
    ['US', 'United States', 30], ['GB', 'United Kingdom', 9], ['DE', 'Germany', 8], ['FR', 'France', 5], ['IL', 'Israel', 4.5], ['BR', 'Brazil', 4],
    ['IN', 'India', 4], ['CA', 'Canada', 3.5], ['AU', 'Australia', 3], ['NL', 'Netherlands', 3], ['ES', 'Spain', 2.5], ['IT', 'Italy', 2.2],
    ['PL', 'Poland', 2], ['JP', 'Japan', 1.8], ['SE', 'Sweden', 1.5], ['MX', 'Mexico', 1.3], ['ZA', 'South Africa', 1], ['NG', 'Nigeria', 0.8],
    ['KR', 'South Korea', 0.8], ['AR', 'Argentina', 0.7], ['TR', 'Turkey', 0.7], ['NO', 'Norway', 0.6], ['EG', 'Egypt', 0.5], ['ID', 'Indonesia', 0.5],
  ],
  toprefs: [['', 'Direct', 34], ['Google', 'Google', 22], ['Hacker News', 'Hacker News', 12], ['Reddit', 'Reddit', 8], ['Mastodon', 'Mastodon', 6], ['Bing', 'Bing', 3], ['DuckDuckGo', 'DuckDuckGo', 2.5], ['news.example.org', 'news.example.org', 1.4]],
  campaigns: [['newsletter', 'newsletter', 14], ['spring-launch', 'spring-launch', 9], ['social-share', 'social-share', 6], ['podcast', 'podcast', 2.5]],
};

function demoTotalFor(range) {
  const stats = daysBetween(range.from, range.to).map(demoDay);
  const visitors = sum(stats.map((s) => s.daily));
  const events = Math.round(visitors * 0.04);
  return { total: visitors + events, total_events: events, total_utc: visitors + events, stats };
}

function demoResponse(path, params) {
  const range = { from: params.start.slice(0, 10), to: params.end.slice(0, 10) };
  const total = demoTotalFor(range);
  const visitors = total.total - total.total_events;
  const m = path.match(/^stats\/(\w+)$/);
  if (path === 'stats/total') return total;
  if (path === 'stats/hits') {
    const wsum = sum(DEMO_PATHS.map((p) => p[2]));
    let hits = DEMO_PATHS.map(([p, title, w], i) => {
      const stats = total.stats.map((s) => {
        const k = (w / wsum) * (0.7 + rng(`${p}:${s.day}`)() * 0.6);
        return { day: s.day, daily: Math.round(s.daily * k), hourly: s.hourly.map((v) => Math.round(v * k)) };
      });
      return { path_id: i + 1, path: p, title, event: false, count: sum(stats.map((s) => s.daily)), max: 0, stats };
    });
    if (params.include_paths) hits = hits.filter((h) => String(h.path_id) === String(params.include_paths));
    return { hits: hits.slice(0, params.limit || 20), more: false, total: sum(hits.map((h) => h.count)) };
  }
  if (m && DEMO_PAGES[m[1]]) {
    const rows = DEMO_PAGES[m[1]].map((r) => {
      const [id, name, w] = r.length === 3 ? r : [r[0], r[0], r[1]];
      const base = r.length === 3 ? w : r[1];
      const j = 0.9 + rng(`${m[1]}:${name}:${range.from}`)() * 0.2;
      const row = { id, name, count: Math.round((visitors * base * j) / 100) };
      if (m[1] === 'toprefs') row.ref_scheme = id === '' ? 'h' : 'g';
      if (m[1] === 'campaigns') row.ref_scheme = 'c';
      return row;
    });
    return { stats: rows.slice(0, params.limit || 20), more: false };
  }
  throw new Error(`Demo has no data for ${path}`);
}

/* ---------- api client: sequential queue, 60s cache, 429 retry ---------- */

const GAP_MS = 500;
const CACHE_TTL_MS = 60000;
const MAX_ATTEMPTS = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

const api = {
  demo: false,
  cache: new Map(),
  queue: [],
  running: false,

  clear() { this.cache.clear(); },

  get(path, params, signal) {
    const query = new URLSearchParams(params).toString();
    if (this.demo) {
      return Promise.resolve().then(() => demoResponse(path, params));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ url: `api/v0/${path}?${query}`, signal, resolve, reject });
      this.pump();
    });
  },

  async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const task = this.queue.shift();
      if (task.signal && task.signal.aborted) { task.reject(abortError()); continue; }
      const hit = this.cache.get(task.url);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) { task.resolve(hit.data); continue; }
      try {
        const data = await this.fetchWithRetry(task);
        this.cache.set(task.url, { at: Date.now(), data });
        task.resolve(data);
      } catch (e) {
        task.reject(e);
      }
      await sleep(GAP_MS);
    }
    this.running = false;
  },

  async fetchWithRetry(task) {
    for (let attempt = 1; ; attempt++) {
      if (task.signal && task.signal.aborted) throw abortError();
      let res;
      try {
        res = await fetch(task.url, { headers: { Accept: 'application/json' }, credentials: 'omit', signal: task.signal });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new Error('Network error: could not reach the dashboard proxy.');
      }
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        const reset = Number(res.headers.get('X-Rate-Limit-Reset'));
        await sleep(Math.min(10000, (reset > 0 ? reset * 1000 : 1000 * attempt) + 100));
        continue;
      }
      if (res.ok) {
        try { return await res.json(); } catch (e) { throw new Error('Response was not valid JSON. Is the API proxy running?'); }
      }
      let detail = '';
      try { const b = await res.json(); detail = b.error || Object.values(b.errors || {}).flat().join(', '); } catch (e) { /* non-JSON body */ }
      if (res.status === 401 || res.status === 403) throw new Error(`GoatCounter rejected the API key (HTTP ${res.status}). Check its permissions.`);
      if (res.status === 404) throw new Error('API route not found (HTTP 404). Serve through the nginx proxy or use ?demo=1.');
      if (res.status === 429) throw new Error('Rate limited by GoatCounter (HTTP 429). Retry in a moment.');
      throw new Error(`Request failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
    }
  },
};

/* ---------- hooks ---------- */

function useResource(loader, deps, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const ctl = new AbortController();
    setState({ data: null, loading: true, error: null });
    loader(ctl.signal).then(
      (data) => { if (!ctl.signal.aborted) setState({ data, loading: false, error: null }); },
      (error) => { if (!ctl.signal.aborted && error.name !== 'AbortError') setState({ data: null, loading: false, error }); },
    );
    return () => ctl.abort();
  }, [...deps, enabled, tick]);
  const reload = useCallback(() => { api.clear(); setTick((t) => t + 1); }, []);
  return { ...state, reload };
}

function useVisible() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { rootMargin: '120px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/* ---------- shared UI ---------- */

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="empty">This chart failed to render.</p> : this.props.children; }
}

function Card({ title, note, res, className = '', children, skeletonHeight = 160 }) {
  const id = useMemo(() => `h-${Math.random().toString(36).slice(2, 8)}`, []);
  let body;
  if (res.error) {
    body = (
      <div className="error" role="alert">
        <p>{res.error.message}</p>
        <button type="button" className="btn" onClick={res.reload}>Retry</button>
      </div>
    );
  } else if (res.loading || !res.data) {
    body = <div className="skeleton" style={{ height: skeletonHeight }} role="status" aria-label={`Loading ${title}`} />;
  } else {
    body = <Boundary>{children(res.data)}</Boundary>;
  }
  return (
    <section className={`card ${className}`} aria-labelledby={id} aria-busy={res.loading}>
      <header>
        <h2 id={id}>{title}</h2>
        {note ? <span className="note">{note}</span> : null}
      </header>
      <div className="card-body">{body}</div>
    </section>
  );
}

function BarList({ rows, of, empty = 'No data in this period.', label }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  const denom = of || sum(rows.map((r) => r.count));
  return (
    <ul className="bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key || r.name}>
          <span className="name" title={r.name}>{r.name}</span>
          <span className="val">{fmt(r.count)} <span aria-hidden="true">·</span> {pct(r.count, denom)}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(r.count / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

function Donut({ rows, label }) {
  if (!rows.length) return <p className="empty">No data in this period.</p>;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const head = sorted.slice(0, 6);
  const rest = sum(sorted.slice(6).map((r) => r.count));
  const parts = rest > 0 ? [...head, { name: 'Other', count: rest, other: true }] : head;
  const total = sum(parts.map((p) => p.count));
  const color = (p, i) => (p.other ? 'var(--c-other)' : `var(--c${i + 1})`);
  return (
    <div className="donut">
      <PieChart width={150} height={150} role="img" aria-label={label}>
        <Pie data={parts} dataKey="count" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="var(--surface)" isAnimationActive={false}>
          {parts.map((p, i) => <Cell key={p.name} fill={color(p, i)} />)}
        </Pie>
      </PieChart>
      <ul className="legend">
        {parts.map((p, i) => (
          <li key={p.name}>
            <span className="dot" style={{ background: color(p, i) }} aria-hidden="true" />
            <span className="name" title={p.name}>{p.name}</span>
            <span className="pct">{pct(p.count, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartTip({ active, payload, unit }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <strong>{d.label}</strong>
      <div><span>{unit}</span><span>{fmt(d.v)}</span></div>
      {d.p != null ? <div><span>{d.pLabel}</span><span>{fmt(d.p)}</span></div> : null}
    </div>
  );
}

/* ---------- KPI row ---------- */

function Delta({ cur, prev }) {
  if (prev === 0 && cur === 0) return <span className="delta flat">no change</span>;
  if (prev === 0) return <span className="delta up">new</span>;
  const ch = ((cur - prev) / prev) * 100;
  const dir = Math.abs(ch) < 0.05 ? 'flat' : ch > 0 ? 'up' : 'down';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■';
  const text = `${Math.abs(ch).toFixed(1)}%`;
  return (
    <span className={`delta ${dir}`} aria-label={`${dir === 'flat' ? 'unchanged' : dir} ${text} versus previous period`}>
      <span aria-hidden="true">{arrow}</span> {text}
    </span>
  );
}

function kpiModel(data, single) {
  const visitors = data.total - data.total_events;
  const stats = data.stats || [];
  const days = Math.max(stats.length, 1);
  if (single) {
    const hours = stats.flatMap((s) => s.hourly || []);
    return { visitors, avg: visitors / 24, peak: Math.max(0, ...hours), events: data.total_events };
  }
  return { visitors, avg: visitors / days, peak: Math.max(0, ...stats.map(dailyOf)), events: data.total_events };
}

function Kpis({ cur, prev, single, prevLabel }) {
  const items = [
    ['Visitors', 'visitors', 'Total unique-visitor counts, events excluded'],
    [single ? 'Hourly average' : 'Daily average', 'avg', 'Visitors per ' + (single ? 'hour' : 'day')],
    [single ? 'Busiest hour' : 'Busiest day', 'peak', 'Highest single ' + (single ? 'hour' : 'day')],
    ['Events', 'events', 'Custom events recorded'],
  ];
  const both = { data: cur.data && prev.data ? true : null, loading: cur.loading || prev.loading, error: cur.error || prev.error, reload: () => { cur.reload(); prev.reload(); } };
  return items.map(([label, key, sub]) => (
    <Card key={key} title={label} res={both} className="s3" skeletonHeight={72}>
      {() => {
        const c = kpiModel(cur.data, single)[key];
        const p = kpiModel(prev.data, single)[key];
        return (
          <div>
            <div className="kpi-value">{fmt(c)}</div>
            <div className="kpi-sub"><Delta cur={c} prev={p} /> vs {prevLabel}</div>
            <div className="sr">{sub}</div>
          </div>
        );
      }}
    </Card>
  ));
}

/* ---------- traffic ---------- */

function Traffic({ cur, prev, range, prevRange, single }) {
  const points = useMemo(() => {
    if (!cur.data || !prev.data) return [];
    if (single) {
      const h = (res) => Array.from({ length: 24 }, (_, i) => ((res.stats || []).flatMap((s) => s.hourly || [])[i]) || 0);
      const a = h(cur.data);
      const b = h(prev.data);
      return a.map((v, i) => ({ label: `${pad(i)}:00`, v, p: b[i], pLabel: `Yesterday ${pad(i)}:00` }));
    }
    const days = daysBetween(range.from, range.to);
    const pdays = daysBetween(prevRange.from, prevRange.to);
    const map = (res) => new Map((res.stats || []).map((s) => [dayOf(s), dailyOf(s)]));
    const a = map(cur.data);
    const b = map(prev.data);
    return days.map((d, i) => ({ label: fmtDay(d), v: a.get(d) || 0, p: b.get(pdays[i]) || 0, pLabel: fmtDay(pdays[i]) }));
  }, [cur.data, prev.data, single, range.from, range.to]);
  const res = { data: cur.data && prev.data ? true : null, loading: cur.loading || prev.loading, error: cur.error || prev.error, reload: () => { cur.reload(); prev.reload(); } };
  return (
    <Card title="Traffic" note={single ? 'Visitors per hour' : 'Visitors per day, dashed line is the previous period'} res={res} className="s12" skeletonHeight={280}>
      {() => (
        <div className="chart-h" role="img" aria-label={`Visitors over time, ${fmt(sum(points.map((p) => p.v)))} in total`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.35 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={24} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip content={<ChartTip unit="Visitors" />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
              <Line type="monotone" dataKey="p" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} fill="url(#trafficFill)" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------- leaderboard ---------- */

function Spark({ pathId, range, single, nonce }) {
  const [ref, seen] = useVisible();
  const res = useResource(
    (signal) => api.get('stats/hits', { ...rangeParams(range), include_paths: pathId, limit: 1 }, signal),
    [pathId, range.from, range.to, api.demo, nonce],
    seen,
  );
  const points = useMemo(() => {
    const stats = res.data && res.data.hits && res.data.hits[0] ? res.data.hits[0].stats || [] : [];
    if (single) return stats.flatMap((s) => s.hourly || []).map((v, i) => ({ i, v }));
    const m = new Map(stats.map((s) => [dayOf(s), dailyOf(s)]));
    return daysBetween(range.from, range.to).map((d, i) => ({ i, v: m.get(d) || 0 }));
  }, [res.data, single, range.from, range.to]);
  return (
    <div className="spark" ref={ref}>
      {res.error ? <span className="note" title={res.error.message}>n/a</span>
        : res.data ? (
          <AreaChart width={96} height={28} data={points} margin={{ top: 2, right: 0, left: 0, bottom: 2 }} role="img" aria-label="Trend">
            <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.5} fill="var(--accent)" fillOpacity={0.15} isAnimationActive={false} dot={false} />
          </AreaChart>
        ) : <div className="skeleton" aria-hidden="true" />}
    </div>
  );
}

function Leaderboard({ range, single, nonce }) {
  const res = useResource((signal) => api.get('stats/hits', { ...rangeParams(range), limit: 10 }, signal), [range.from, range.to, api.demo, nonce]);
  return (
    <Card title="Top pages" note="Sparklines load as rows scroll into view" res={res} className="s7" skeletonHeight={320}>
      {(data) => {
        const hits = (data.hits || []).filter((h) => !h.event);
        if (!hits.length) return <p className="empty">No pageviews in this period.</p>;
        return (
          <ol className="board">
            {hits.map((h, i) => (
              <li key={h.path_id}>
                <span className="rank">{i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <div className="path" title={h.path}>{h.path}</div>
                  {h.title ? <div className="title" title={h.title}>{h.title}</div> : null}
                </span>
                <Spark pathId={h.path_id} range={range} single={single} nonce={nonce} />
                <span className="count">{fmt(h.count)}</span>
              </li>
            ))}
          </ol>
        );
      }}
    </Card>
  );
}

/* ---------- sources + campaigns ---------- */

function Sources({ range, nonce, visitors }) {
  const refs = useResource((signal) => api.get('stats/toprefs', { ...rangeParams(range), limit: 8 }, signal), [range.from, range.to, api.demo, nonce]);
  const camps = useResource((signal) => api.get('stats/campaigns', { ...rangeParams(range), limit: 8 }, signal), [range.from, range.to, api.demo, nonce]);
  const res = { data: refs.data && camps.data ? true : null, loading: refs.loading || camps.loading, error: refs.error || camps.error, reload: () => { refs.reload(); camps.reload(); } };
  return (
    <Card title="Sources and campaigns" note="Share of all visitors" res={res} className="s5" skeletonHeight={320}>
      {() => (
        <div className="stack">
          <div>
            <h3>Referrers</h3>
            <BarList label="Top referrers" of={visitors}
              rows={(refs.data.stats || []).map((r) => ({ key: r.id || 'direct', name: r.name || 'Direct / unknown', count: r.count }))} />
          </div>
          <div>
            <h3>Campaigns (utm_campaign)</h3>
            <BarList label="Top campaigns" of={visitors} empty="No tagged campaigns in this period."
              rows={(camps.data.stats || []).map((r) => ({ key: r.id || r.name, name: r.name || '(none)', count: r.count }))} />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- heatmap ---------- */

function Heatmap({ cur }) {
  return (
    <Card title="Weekday and hour" note="Average visitors per hour slot" res={cur} className="s12" skeletonHeight={220}>
      {(data) => {
        const stats = data.stats || [];
        const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
        const occ = Array(7).fill(0);
        const dayTotals = Array(7).fill(0);
        let hasHourly = false;
        stats.forEach((s) => {
          const wd = (new Date(`${dayOf(s)}T00:00:00Z`).getUTCDay() + 6) % 7;
          occ[wd] += 1;
          dayTotals[wd] += dailyOf(s);
          (s.hourly || []).slice(0, 24).forEach((v, h) => { grid[wd][h] += v; if (v) hasHourly = true; });
        });
        if (!hasHourly) {
          const rows = WEEKDAYS.map((name, i) => ({ name, count: dayTotals[i] }));
          return (
            <div>
              <p className="note">Hourly breakdown is not available for this range, showing weekday totals.</p>
              <BarList rows={rows} label="Visitors by weekday" empty="No data in this period." />
            </div>
          );
        }
        const avg = grid.map((row, d) => row.map((v) => (occ[d] ? v / occ[d] : 0)));
        const max = Math.max(...avg.flat(), 0.0001);
        return (
          <div>
            <div className="heat-scroll">
              <table className="heat" aria-label="Average visitors by weekday and hour">
                <thead>
                  <tr>
                    <th className="row"><span className="sr">Weekday</span></th>
                    {Array.from({ length: 24 }, (_, h) => <th key={h} scope="col">{h % 3 === 0 ? pad(h) : <span className="sr">{pad(h)}</span>}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((name, d) => (
                    <tr key={name}>
                      <th className="row" scope="row">{name}</th>
                      {avg[d].map((v, h) => {
                        const t = Math.sqrt(v / max);
                        const text = `${name} ${pad(h)}:00, ${v.toFixed(1)} average, ${fmt(grid[d][h])} total`;
                        return <td key={h} title={text} aria-label={text} style={{ background: v ? `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, var(--surface-2))` : 'var(--surface-2)' }} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="scale"><span>0</span><span className="ramp" aria-hidden="true" /><span>{max.toFixed(1)} avg</span></div>
          </div>
        );
      }}
    </Card>
  );
}

/* ---------- world map ---------- */

const NAME_ALIASES = { 'united states': 'united states of america', czechia: 'czechia', turkey: 'turkey', 'türkiye': 'turkey' };

function WorldMap({ rows }) {
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const world = window.WORLD_MAP;
  const { byCode, byName, max } = useMemo(() => {
    const bc = new Map();
    const bn = new Map();
    rows.forEach((r) => {
      if (r.id) bc.set(String(r.id).toUpperCase(), r.count);
      const n = String(r.name).toLowerCase();
      bn.set(NAME_ALIASES[n] || n, r.count);
    });
    return { byCode: bc, byName: bn, max: Math.max(...rows.map((r) => r.count), 1) };
  }, [rows]);
  const countFor = (c) => (c.c && byCode.has(c.c) ? byCode.get(c.c) : byName.get(c.n.toLowerCase()) || 0);
  const show = (e, c, n) => {
    const box = wrapRef.current.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, name: c.n, count: n });
  };
  const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 3).map((r) => `${r.name} ${fmt(r.count)}`).join(', ');
  return (
    <div className="map-wrap" ref={wrapRef} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${world.w} ${world.h}`} role="img" aria-label={`World map of visitors by country. Top: ${top || 'no data'}`}>
        {world.countries.map((c) => {
          const n = countFor(c);
          const t = Math.sqrt(n / max);
          return (
            <path key={c.n} d={c.d}
              style={{ fill: n ? `color-mix(in srgb, var(--accent) ${Math.round(15 + t * 85)}%, var(--surface-2))` : 'var(--surface-2)' }}
              onMouseMove={(e) => show(e, c, n)} onClick={(e) => show(e, c, n)} />
          );
        })}
      </svg>
      {tip ? <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.name}: <strong>{fmt(tip.count)}</strong></div> : null}
      <div className="scale"><span>0</span><span className="ramp" aria-hidden="true" /><span>{fmt(max)} visitors (square-root scale)</span></div>
    </div>
  );
}

function Geo({ range, nonce }) {
  const res = useResource((signal) => api.get('stats/locations', { ...rangeParams(range), limit: 100 }, signal), [range.from, range.to, api.demo, nonce]);
  const rows = (res.data && res.data.stats) || [];
  return (
    <>
      <Card title="Visitors by country" note="Small territories are too small to draw, see the list" res={res} className="s8" skeletonHeight={300}>
        {() => <WorldMap rows={rows} />}
      </Card>
      <Card title="Top countries" res={res} className="s4" skeletonHeight={300}>
        {() => <BarList label="Top countries" rows={[...rows].sort((a, b) => b.count - a.count).slice(0, 10).map((r) => ({ key: r.id || r.name, name: r.name, count: r.count }))} />}
      </Card>
    </>
  );
}

/* ---------- breakdown cards ---------- */

function Breakdown({ title, page, range, nonce, kind = 'donut', limit = 10 }) {
  const res = useResource((signal) => api.get(`stats/${page}`, { ...rangeParams(range), limit }, signal), [range.from, range.to, api.demo, nonce, page]);
  return (
    <Card title={title} res={res} className="s4" skeletonHeight={150}>
      {(data) => {
        const SIZE_NAMES = { phone: 'Phones', largephone: 'Large phones', tablet: 'Tablets', desktop: 'Desktop', desktophd: 'Desktop HD', unknown: 'Unknown' };
        const label = (r) => r.name || (page === 'sizes' && SIZE_NAMES[r.id]) || 'Unknown';
        const rows = (data.stats || []).filter((r) => r.count > 0).map((r) => ({ key: r.id || r.name, name: label(r), count: r.count }));
        return kind === 'donut' ? <Donut rows={rows} label={`${title} breakdown`} /> : <BarList rows={rows.slice(0, 8)} label={title} />;
      }}
    </Card>
  );
}

/* ---------- app ---------- */

function App() {
  const initial = useMemo(readUrl, []);
  const [rangeState, setRangeState] = useState(initial.state);
  const [draft, setDraft] = useState({ from: initial.state.from, to: initial.state.to });
  const [demo, setDemo] = useState(initial.demo);
  const [nonce, setNonce] = useState(0);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'dark');
  const [hint, setHint] = useState('');
  const [site, setSite] = useState({ name: '', url: '' });
  useEffect(() => {
    fetch('config.json').then((r) => (r.ok ? r.json() : null)).then((c) => {
      if (c && typeof c === 'object') setSite({ name: String(c.name || ''), url: /^https:\/\//.test(c.url || '') ? c.url : '' });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    document.title = site.name ? `${site.name} \u2013 Analytics dashboard (powered by GoatCounter)` : 'Analytics dashboard (powered by GoatCounter)';
  }, [site.name]);
  api.demo = demo;

  const range = useMemo(() => resolveRange(rangeState), [rangeState]);
  const prevRange = useMemo(() => previousRange(range), [range]);
  const single = range.from === range.to;

  useEffect(() => {
    const q = new URLSearchParams();
    if (rangeState.preset !== '30d') q.set('range', rangeState.preset);
    if (rangeState.preset === 'custom') { q.set('from', rangeState.from); q.set('to', rangeState.to); }
    if (demo) q.set('demo', '1');
    const s = q.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${s ? `?${s}` : ''}`);
  }, [rangeState, demo]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('gcd-theme', next); } catch (e) { /* storage blocked */ }
  };

  const applyCustom = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) { setHint('Start date must be on or before the end date.'); return; }
    if (diffDays(draft.from, draft.to) >= MAX_CUSTOM_DAYS) { setHint(`Pick a range of at most ${MAX_CUSTOM_DAYS} days.`); return; }
    setHint('');
    setRangeState({ preset: 'custom', from: draft.from, to: draft.to });
  };

  const deps = [range.from, range.to, demo, nonce];
  const cur = useResource((signal) => api.get('stats/total', rangeParams(range), signal), deps);
  const prev = useResource((signal) => api.get('stats/total', rangeParams(prevRange), signal), deps);
  const visitors = cur.data ? cur.data.total - cur.data.total_events : 0;
  const prevLabel = single ? 'yesterday' : 'previous period';
  const today = ymd(new Date());

  return (
    <div className="wrap">
      <header className="header">
        <div>
          <h1>{site.name ? `${site.name} Analytics` : 'Analytics'} {demo ? <span className="badge">Demo data</span> : null}</h1>
          <div className="sub">{single ? fmtDay(range.from) : `${fmtDay(range.from)} to ${fmtDay(range.to)}`} compared with {single ? 'the day before' : `${fmtDay(prevRange.from)} to ${fmtDay(prevRange.to)}`}</div>
        </div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Date range">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={rangeState.preset === p.id}
                onClick={() => (p.id === 'custom' ? setRangeState({ preset: 'custom', from: draft.from, to: draft.to }) : setRangeState({ ...rangeState, preset: p.id }))}>
                {p.label}
              </button>
            ))}
          </div>
          {site.url ? <a className="btn" href={site.url} target="_blank" rel="noopener noreferrer">GoatCounter &#8599;</a> : null}
          <button type="button" className="btn" onClick={() => { api.clear(); setNonce((n) => n + 1); }}>Refresh</button>
          <button type="button" className="btn" aria-pressed={demo} onClick={() => setDemo(!demo)}>Demo</button>
          <button type="button" className="btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
        </div>
        {rangeState.preset === 'custom' ? (
          <div className="custom">
            <label>From <input type="date" value={draft.from} max={today} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
            <label>To <input type="date" value={draft.to} max={today} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
            <button type="button" className="btn primary" onClick={applyCustom}>Apply</button>
            {hint ? <span className="hint" role="alert">{hint}</span> : null}
          </div>
        ) : null}
      </header>

      <main className="grid">
        <Kpis cur={cur} prev={prev} single={single} prevLabel={prevLabel} />
        <Traffic cur={cur} prev={prev} range={range} prevRange={prevRange} single={single} />
        <Leaderboard range={range} single={single} nonce={nonce + (demo ? 1000 : 0)} />
        <Sources range={range} nonce={nonce} visitors={visitors} />
        <Heatmap cur={cur} />
        <Geo range={range} nonce={nonce} />
        <Breakdown title="Browsers" page="browsers" range={range} nonce={nonce} />
        <Breakdown title="Operating systems" page="systems" range={range} nonce={nonce} />
        <Breakdown title="Devices" page="sizes" range={range} nonce={nonce} />
        <Breakdown title="Languages" page="languages" range={range} nonce={nonce} kind="bars" />
      </main>

      <footer className="footer">
        Powered by <a href="https://www.goatcounter.com" target="_blank" rel="noopener noreferrer">GoatCounter</a>
        {site.url ? <> <span aria-hidden="true">&middot;</span> <a href={site.url} target="_blank" rel="noopener noreferrer">Open GoatCounter dashboard</a></> : null}
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
