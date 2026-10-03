import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThreat } from "../state";
import TelemetryFeed from "../components/TelemetryFeed";
import Grainient from "../components/ui/Grainient";
import Icon from "../components/Icon";

interface AppStatus {
  threats_total: number;
  quarantined_total: number;
  signatures: number;
  protection: string;
}

const HERO_TEXT: Record<string, { pre: string; word: string; post: string }> = {
  safe: { pre: "You're ", word: "protected", post: "." },
  warn: { pre: "Something needs ", word: "attention", post: "." },
  danger: { pre: "Threat ", word: "contained", post: "." },
};

export default function Dashboard() {
  const { level, feed, setLevel } = useThreat();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [simulating, setSimulating] = useState(false);

  const refresh = () =>
    invoke<AppStatus>("app_status").then(setStatus).catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function simulateAttack() {
    setSimulating(true);
    try {
      await invoke("simulate_attack");
    } finally {
      setSimulating(false);
      refresh();
    }
  }

  const hero = HERO_TEXT[level] ?? HERO_TEXT.safe;

  return (
    <>
      {/* HERO — one sentence, state-driven, gradient underneath */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", border: "none" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.85 }}>
          <Grainient
            color1={level === "danger" ? "#FF8A7A" : level === "warn" ? "#FFC46B" : "#2f89e3"}
            color2={level === "danger" ? "#8A2E24" : "#16324F"}
            color3="#121218"
            timeSpeed={0.18}
            warpStrength={1.2}
            rotationAmount={420}
            grainAmount={0.12}
            grainAnimated
          />
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "30px 32px",
            background:
              "linear-gradient(90deg, rgba(18,18,24,0.78) 0%, rgba(18,18,24,0.3) 65%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 38,
                lineHeight: 1.12,
                letterSpacing: "-0.5px",
                margin: 0,
                color: "#F2F5FB",
              }}
            >
              {hero.pre}
              <span style={{ color: `var(--${level === "safe" ? "safe" : level})` }}>{hero.word}</span>
              {hero.post}
            </h2>
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "rgba(226,231,240,0.85)",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                textShadow: "0 1px 8px rgba(18,18,24,0.8)",
              }}
            >
              <span><b style={{ color: "#fff" }}>{status?.threats_total ?? "—"}</b> threats stopped</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span><b style={{ color: "#fff" }}>{status?.quarantined_total ?? "—"}</b> in vault</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>engine live · <b style={{ color: "#fff" }}>{status?.signatures ?? "—"}</b> signatures</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button className="btn ghost" onClick={simulateAttack} disabled={simulating}>
              <Icon name="zap" size={15} />
              {simulating ? "Running…" : "Run simulation"}
            </button>
            <button
              className="btn"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(220,228,240,0.85))",
                color: "#121218",
                border: "none",
              }}
              onClick={() => setLevel("safe")}
            >
              <Icon name="scan" size={15} />
              New scan
            </button>
          </div>
        </div>
      </section>

      {/* ACTIVITY + side rail */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <section className="panel">
          <h3 className="panel-title">Activity</h3>
          <TelemetryFeed feed={feed} />
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="panel">
            <h3 className="panel-title">Attack theater</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 12.5, lineHeight: 1.55, margin: "0 0 12px" }}>
              Fires a safe EICAR test attack at this machine and lets you watch
              SENTINEL catch it live.
            </p>
            <button
              className="btn ghost"
              style={{
                width: "100%",
                justifyContent: "center",
                color: level === "danger" ? "var(--danger)" : "var(--text-dim)",
                borderColor: level === "danger" ? "var(--danger)" : undefined,
              }}
              onClick={simulateAttack}
              disabled={simulating}
            >
              <Icon name="play" size={14} />
              {simulating ? "Engaged…" : "Run simulation"}
            </button>
          </section>

          <section className="panel">
            <h3 className="panel-title">Live protection</h3>
            {[
              ["Real-time shield", "● ON", "var(--safe)"],
              ["YARA rules", "5 loaded", "var(--text)"],
              ["Signatures", `${status?.signatures ?? 2} seeded`, "var(--text)"],
            ].map(([label, value, color], i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--grid-line)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color }}>{value}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
