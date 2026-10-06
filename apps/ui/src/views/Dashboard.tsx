import { useState } from "react";

import { useThreat } from "../state";
import Grainient from "../components/ui/Grainient";
import Icon from "../components/Icon";
import {useDemoState} from '../demo-bridge';

/** Shield modules — honest statuses: local lessons and unavailable/planned runtime capabilities. */
const SHIELD_MODULES: {
  group: string;
  modules: { name: string; desc: string; status: "PREVIEW" | "LOCAL LESSON" | "UNAVAILABLE" | "PLANNED" }[];
}[] = [
  {
    group: "CORE",
    modules: [
      { name: "Antivirus Engine", desc: "Console adapter unavailable · CLI preview only", status: "UNAVAILABLE" },
      { name: "Passwords", desc: "sample accounts · local generator · vault unavailable", status: "PREVIEW" },
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

export default function Dashboard() {
  const {state:demo}=useDemoState();
  const { level, feed, setLevel, push } = useThreat();
  const [simulating, setSimulating] = useState(false);
  const [simDone, setSimDone] = useState(false);

  function simulateAttack() {
    setSimulating(true);
    setLevel("danger");
    push({kind: "scenario", level: "danger", message: "Synthetic suspicious-file illustration — no file was created, scanned or contained", detail: null, ts: new Date().toLocaleTimeString()});
    setSimDone(true);
    setSimulating(false);
  }
  function resetConsole() {
    setLevel("preview");
    setSimDone(false);
  }

  return (
    <>
      {/* ── HERO — grainient gradient, sticker chip, big brand ── */}
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
        <div style={{ position: "relative", zIndex: 1, padding: "34px 36px 30px" }}>
          <div
            className="sticker-chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transform: "rotate(-2deg)",
              padding: "7px 14px",
              borderRadius: 8,
              border: "2px solid rgba(155,120,255,0.75)",
              background: "linear-gradient(180deg, #74b3f5, #2f89e3)",
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
            {demo?'LOCAL DEMO RUNTIME CONNECTED':'PREVIEW · NO AGENT CONNECTION'}
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
      </section>

      {/* ── STAT TILES ── */}
      <div className="stat-grid">
        <div className="stat">
          <div className="num">{"—"}</div>
          <div className="label">SIGNATURES LOADED</div>
        </div>
        <div className="stat">
          <div className="num">{"—"}</div>
          <div className="label">THREATS CAUGHT</div>
        </div>
        <div className="stat">
          <div className="num">{"—"}</div>
            <div className="label">IN QUARANTINE</div>
        </div>
      </div>

      {/* ── ATTACK SIMULATION + SCENARIO ACTIVITY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <section className="panel">
          <h3 className="panel-title">SYNTHETIC SCENARIO</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
            Changes the console theme using invented evidence. No file, device or system policy is touched.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn danger" onClick={simulateAttack} disabled={simulating}>
              <Icon name="play" size={14} />
              {simulating ? "ENGAGED…" : "PREVIEW ALERT"}
            </button>
            <button className="btn ghost" onClick={resetConsole}>
              RESET CONSOLE
            </button>
          </div>
          {simDone && level === "danger" && (
            <div
              style={{
                marginTop: 14,
                color: "var(--danger)",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
              }}
            >
              Illustrated warning only — nothing was scanned or contained.
            </div>
          )}
        </section>

        <section className="panel">
          <h3 className="panel-title">SCENARIO ACTIVITY</h3>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.75,
              overflowY: "auto",
              maxHeight: 220,
            }}
          >
            {feed.length === 0 && (
              <div style={{ color: "var(--text-faint)" }}>
                {"// live telemetry unavailable — choose a labeled scenario"}
              </div>
            )}
            {feed.slice(0, 30).map((l) => (
              <div
                key={l.seq}
                style={{
                  display: "flex",
                  gap: 10,
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
      </div>

      {/* ── SHIELD MODULES ── */}
      <section className="panel">
        <h3 className="panel-title">SHIELD MODULES</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 14 }}>
          {SHIELD_MODULES.map((g) => (
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
    </>
  );
}

