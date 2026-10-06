import {useDemoState} from '../demo-bridge';
import { useThreat } from "../state";
import Grainient from "../components/ui/Grainient";
import Icon from "../components/Icon";

/** GLM reference layout with connected demo state; preview remains honest when disconnected. */

/** Shield modules — honest statuses: local lessons and unavailable/planned runtime capabilities. */
const SHIELD_MODULES: {
  group: string;
  modules: { name: string; desc: string; status: "LOCAL LESSON" | "UNAVAILABLE" | "PLANNED" | "BOUNDED DEMO" | "SHARED DEMO" }[];
}[] = [
  {
    group: "CORE",
    modules: [
      { name: "Antivirus Engine", desc: "Console adapter unavailable · CLI preview only", status: "UNAVAILABLE" },
      { name: "Password Lab", desc: "entropy analysis · crypto generator", status: "LOCAL LESSON" },
    ],
  },
  {
    group: "PERIMETER",
    modules: [
      { name: "USB Shield", desc: "removable drive auto-scan on arrival", status: "PLANNED" },
      { name: "Watchtower", desc: "local text clues · no network monitoring", status: "LOCAL LESSON" },
    ],
  },
  {
    group: "GATEWAY",
    modules: [
      { name: "Web Shield", desc: "link & download inspection", status: "PLANNED" },
      { name: "Browser Guard", desc: "mail / chat / QR protection", status: "PLANNED" },
    ],
  },
];

const statusLabel =
  ({
    preview: "Preview · agent unavailable",
    warn: "Preview · scenario attention",
    danger: "Preview · scenario alert",
  } as Record<string, string>);

export default function Dashboard({ onViewAll }: { onViewAll: () => void }) {
  const {state:demo}=useDemoState();
  const modules=SHIELD_MODULES.map(g=>({...g,modules:g.modules.map(m=>demo&&m.name==='Antivirus Engine'?{...m,status:'BOUNDED DEMO',desc:'ClamAV harmless-sample scans · real reports · partial coverage'}:demo&&m.name==='Password Lab'?{...m,name:'Passwords',status:'SHARED DEMO',desc:'Invented shared accounts · weakness/reuse audit · generated replacements'}:m)}));
  const { level, feed, setLevel, push } = useThreat();

  function simulateAttack() {
    setLevel("danger");
    push({
      kind: "scenario",
      level: "danger",
      message: "Synthetic suspicious-file illustration — no file was created, scanned or contained",
      detail: null,
      ts: new Date().toLocaleTimeString(),
    });
  }
  function resetConsole() {
    setLevel("preview");
  }

  return (
    <>
      {/* ── HERO — grainient gradient; title block left, status pill right ── */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", border: "none" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
          <Grainient
            color1={level === "danger" ? "#c2483c" : level === "warn" ? "#b3813a" : "#2f89e3"}
            color2={level === "danger" ? "#3d0f0c" : "#16324F"}
            color3="#0a0e1f"
            timeSpeed={0.18}
            warpStrength={1.2}
            rotationAmount={420}
            grainAmount={0.14}
            grainAnimated
          />
        </div>
        <div className="hero-flex" style={{ position: "relative", zIndex: 1, padding: "34px 36px 30px" }}>
          <div style={{ minWidth: 0 }}>
            <div
              className="sticker-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transform: "rotate(-2deg)",
                padding: "7px 14px",
                borderRadius: 8,
                border: "2px solid rgba(91,230,163,0.75)",
                background: "linear-gradient(180deg, #85f0bc, #31cf85)",
                color: "#04220f",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                boxShadow: "0 4px 18px rgba(47, 214, 126, 0.35), 0 0 0 4px rgba(18,18,24,0.55)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#04220f",
                  display: "inline-block",
                }}
              />
              {demo?'Local demo runtime connected':'Preview · no agent connection'}
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 44,
                letterSpacing: "0.02em",
                margin: "14px 0 10px",
                color: "#F4F7FF",
                textShadow: "0 2px 24px rgba(10,14,31,0.6)",
              }}
            >
              SENTINEL
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                letterSpacing: "0.06em",
                color: "rgba(226,233,246,0.92)",
                textShadow: "0 1px 8px rgba(10,14,31,0.8)",
              }}
            >
              {demo?'ClamAV harmless-sample inspection · shared dummy vault · paired browser events':'No live protection is installed — learning and presentation preview'}
            </div>
          </div>
          <div className="protection-pill" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
            <span className="led" /> {demo?'Connected · partial coverage':statusLabel[level] ?? statusLabel.preview}
          </div>
        </div>
      </section>

      {/* ── STAT TILES — no backend in this preview, so honest em-dashes ── */}
      <div className="stat-grid">
        <div className="stat">
          <div className="num">{demo?.scan?.checked??'—'}</div>
          <div className="label">FILES INSPECTED</div>
        </div>
        <div className="stat">
          <div className="num">{demo?.scan?.findings.filter(f=>f.kind==='provider_synthetic_match').length??'—'}</div>
          <div className="label">CLAMAV TEST MATCHES</div>
        </div>
        <div className="stat">
          <div className="num">{demo?.accounts.length??'—'}</div>
          <div className="label">DEMO ACCOUNTS</div>
        </div>
      </div>

      {/* ── MAIN GRID — wide activity feed left, scenario rail right ── */}
      <div className="console-grid">
        <section className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="section-head">
            <h3 className="panel-title" style={{ margin: 0 }}>
              ACTIVITY
            </h3>
            <button className="section-link" onClick={onViewAll}>
              View all
            </button>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.75,
              overflowY: "auto",
              maxHeight: 300,
              padding: "8px 0 0",
            }}
          >
            {demo?.events.map(event => (
              <div key={event.id} style={{padding:'7px 0',borderBottom:'1px solid var(--grid-line)',color:'var(--text-dim)'}}>
                <span>{new Date(event.at).toLocaleTimeString()} </span>
                <strong>{event.source} · {event.kind.replaceAll('_',' ')}</strong>
                <span> · {event.codes.join(' · ') || 'Local action completed'}</span>
              </div>
            ))}
            {feed.length === 0 && !demo?.events.length && (
              <div style={{ color: "var(--text-faint)" }}>
                {demo ? 'No local session events yet. Scan a harmless sample or use the paired extension.' : '// live telemetry unavailable — choose a labeled scenario'}
              </div>
            )}
            {feed.slice(0, 30).map((l) => (
              <div
                key={l.seq}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid var(--grid-line)",
                  color:
                    l.level === "danger"
                      ? "var(--danger)"
                      : l.level === "warn"
                        ? "var(--warn)"
                        : "var(--text-dim)",
                }}
              >
                <span style={{ opacity: 0.55, flexShrink: 0 }}>{l.ts}</span>
                <span
                  style={{
                    fontWeight: l.level === "info" ? 400 : 600,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {l.message}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="side-rail">
          <section className="panel">
            <h3 className="panel-title">ATTACK SIMULATION — SYNTHETIC SCENARIO</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
              Changes the console theme using invented evidence. No file, device
              or system policy is touched.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn danger" onClick={simulateAttack}>
                <Icon name="play" size={14} />
                PREVIEW ALERT
              </button>
              <button className="btn ghost" onClick={resetConsole}>
                RESET CONSOLE
              </button>
            </div>
          </section>

          <section className="panel">
            <h3 className="panel-title">CAPABILITY STATUS</h3>
            <div className="kv-row">
              <span className="kv-key">
                Scan adapter <span className="status-dot" style={{ display: "inline-block" }} />
              </span>
              <span className="kv-val" style={{ color: "var(--warn)" }}>
                {demo?'bounded demo':'unavailable'}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Vault backend</span>
              <span className="kv-val" style={{ color: "var(--warn)" }}>
                {demo?'shared demo':'unavailable'}
              </span>
            </div>
            <div className="kv-row" style={{ borderBottom: "none" }}>
              <span className="kv-key">Local lessons</span>
              <span className="kv-val" style={{ color: "var(--state)" }}>
                available
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* ── SHIELD MODULES — section head outside, grid inside ── */}
      <div>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h3 className="panel-title" style={{ margin: 0, fontSize: 19 }}>
            SHIELD MODULES
          </h3>
        </div>
        <section className="panel">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {modules.map((g) => (
              <div
                key={g.group}
                style={{
                  border: "1px solid var(--grid-line)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px 18px",
                  background: "rgba(11, 18, 48, 0.55)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    color: "var(--chrome-mid)",
                    marginBottom: 12,
                  }}
                >
                  {g.group}
                </div>
                {g.modules.map((m) => (
                  <div key={m.name} style={{ padding: "8px 0", borderTop: "1px solid var(--grid-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          flexShrink: 0,
                          background: m.status === "LOCAL LESSON" ? "var(--safe)" : "var(--text-faint)",
                          boxShadow: m.status === "LOCAL LESSON" ? "0 0 8px var(--safe)" : "none",
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{m.name}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          letterSpacing: "0.1em",
                          color: m.status === "LOCAL LESSON" ? "var(--safe)" : "var(--text-faint)",
                        }}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3, paddingLeft: 14 }}>
                      {m.desc}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}


