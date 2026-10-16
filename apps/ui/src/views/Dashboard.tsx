import {useDemoState} from '../demo-bridge';
import { useThreat } from "../state";
import Grainient from "../components/ui/Grainient";
import Icon from "../components/Icon";

/** GLM reference layout with connected demo state; preview remains honest when disconnected. */

const statusLabel =
  ({
    preview: "Preview · agent unavailable",
    warn: "Preview · scenario attention",
    danger: "Preview · scenario alert",
  } as Record<string, string>);

export default function Dashboard({ onViewAll, onNavigate }: { onViewAll: () => void; onOpenUsb?:()=>void; onNavigate?:(view:"scan"|"password"|"watchtower"|"usb")=>void }) {
  const {state:demo}=useDemoState();

  const { level, feed, setLevel, push, snapshot, resetConsole } = useThreat();

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

  return (
    <div className="dashboard-layout">
      {/* ── HERO — grainient gradient; title block left, status pill right ── */}
      <section className="panel dashboard-hero">
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
        <div className="hero-flex dashboard-hero-content">
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
                fontSize: "0.78125rem",
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
            <h2 className="dashboard-title">
              SENTINEL
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.78125rem",
                letterSpacing: "0.06em",
                color: "rgba(226,233,246,0.92)",
                textShadow: "0 1px 8px rgba(10,14,31,0.8)",
              }}
            >
              {demo?'Local file checks · partial coverage · shared demo accounts':'No live protection is installed — learning and presentation preview'}
            </div>
          </div>
          <div className="protection-pill" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
            <span className="led" /> {demo?'Connected · partial coverage':statusLabel[level] ?? statusLabel.preview}
          </div>
        </div>
      </section>



      <nav className="dashboard-actions" aria-label="Quick actions">
        <button type="button" className="btn" disabled={!onNavigate} onClick={()=>onNavigate?.('scan')}><Icon name="scan" size={18}/>Scan files</button>
        <button type="button" className="btn ghost" disabled={!onNavigate} onClick={()=>onNavigate?.('password')}><Icon name="key" size={18}/>Passwords</button>
        <button type="button" className="btn ghost" disabled={!onNavigate} onClick={()=>onNavigate?.('watchtower')}><Icon name="wifi" size={18}/>Watchtower</button>
      </nav>
      {/* ── STAT TILES — no backend in this preview, so honest em-dashes ── */}
      <div className="stat-grid dashboard-stats">
        <button type="button" className="stat" onClick={()=>onNavigate?.('scan')} disabled={!onNavigate}>
          <div className="num">{demo?.scan?.checked??'—'}</div>
          <div className="label">FILES INSPECTED</div>
        </button>
        <button type="button" className="stat" onClick={()=>onNavigate?.('scan')} disabled={!onNavigate}>
          <div className="num">{snapshot?snapshot.reports.filter(r=>r.verdict==='suspicious'||r.verdict==='signature_match').length:'—'}</div>
          <div className="label">REVIEW FINDINGS</div>
        </button>
        <button type="button" className="stat" onClick={()=>onNavigate?.('password')} disabled={!onNavigate}>
          <div className="num">{demo?.accounts.length??'—'}</div>
          <div className="label">DEMO ACCOUNTS</div>
        </button>
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
              fontSize: "0.75rem",
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
                    fontWeight: l.level === "info" ? 500 : 600,
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
            <p style={{ color: "var(--text-dim)", fontSize: "0.8125rem", lineHeight: 1.6, margin: "0 0 14px" }}>
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

    </div>
  );
}


