import { useState } from "react";
import Icon from "../components/Icon";
import './glm-pages.css';

interface WatchAlert {
  id: number;
  severity: "danger" | "warn" | "info";
  icon: string;
  title: string;
  desc: string;
  source: string;
}

/** Alert Center + live guards. Detection wiring lands in Phase B; the
 *  structure, severity styling and scam checker are live now. */

const SAMPLE_ALERTS: WatchAlert[] = [
  {
    id: 1,
    severity: "warn",
    icon: "wifi",
    title: "Connected to an open network",
    desc: "Cafe_Guest_WiFi has no encryption — unencrypted traffic may be visible; HTTPS content is not exposed merely by an open network.",
    source: "wifi-guard",
  },
  {
    id: 2,
    severity: "danger",
    icon: "mail",
    title: "Scam message flagged",
    desc: "\u201cYour parcel is held at customs — pay \u20b95 to release.\u201d 3 signals: urgency, payment link, spoofed sender.",
    source: "scam-radar",
  },
];

type Verdict = {
  level: "clean" | "warn" | "danger";
  signals: string[];
  summary: string;
};

/** Offline scam-text engine — the same heuristics the Watchtower will run
 *  on every incoming SMS/email/WhatsApp message. */
function analyzeText(text: string): Verdict {
  const t = text.toLowerCase();
  const signals: string[] = [];

  if (/(urgent|immediately|act now|last chance|expires|within \d+ (hour|minute|day))/.test(t))
    signals.push("urgency pressure");
  if (/(won|winner|prize|lottery|congratulation|reward|free gift|cashback)/.test(t))
    signals.push("too-good-to-be-true offer");
  if (/(otp|one[- ]time password|verify your (account|number)|cvv|pin|password)/.test(t))
    signals.push("credential request — verify through the official service");
  if (/(bank account (is|will be) (blocked|suspended|frozen)|kyc (is|update|expired)|pan (card|aadhaar) (is )?(suspend|block))/.test(t))
    signals.push("account-suspension threat");
  if (/(pay(?:ing)? (?:rs|₹|inr|usd|\$)\s?\d|send money|processing fee|delivery fee|clearance fee)/.test(t))
    signals.push("small-payment demand");
  if (/(http:\/\/|bit\.ly|tinyurl|t\.co\/|goo\.gl|is\.gd|clk\.|wa\.me\/\d)/.test(t))
    signals.push("shortened or insecure link");
  if (/(click (the )?(link|below)|tap here|open this link|download the app from)/.test(t))
    signals.push("link-nudging language");
  if (/(dear customer|dear user|respected customer|valued customer)/.test(t))
    signals.push("generic greeting (they don't know you)");
  if (/[\u20b9$£€]\s?\d{2}/.test(t) && /(winner|claim|prize|refund)/.test(t))
    signals.push("money amount + reward bait");

  const level: Verdict["level"] =
    signals.length >= 3 ? "danger" : signals.length >= 1 ? "warn" : "clean";

  const summary =
    level === "danger"
      ? "This message shows classic scam patterns. Do not click any link or pay anything."
      : level === "warn"
        ? "Some suspicious signals detected. Verify the sender through an official channel before acting."
        : "No known scam patterns detected. Still never share OTPs or passwords.";

  return { level, signals, summary };
}

export default function WatchtowerView() {
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  function check() {
    setVerdict(analyzeText(text));
  }

  return (
    <div className="glm-watchtower">
      <section className="panel glm-page">
        <div className="glm-page-heading"><div><span className="pm-eyebrow">SENTINEL / WATCHTOWER</span><h3 className="panel-title">Scam Radar</h3></div><span className="badge">Local message checker</span></div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 12px" }}>
          Check an invented message for local scam clues. Nothing is uploaded.
        </p>
        <textarea
          className="input"
          aria-label="Invented message" maxLength={4096} rows={4}
          placeholder='e.g. "URGENT: your bank account will be blocked tonight. Click bit.ly/verify-now to update your KYC…"'
          value={text}
          onChange={(e) => { setText(e.target.value); setVerdict(null); }}
          style={{ resize: "vertical", fontFamily: "var(--font-body)" }}
        />
        <div className="glm-toolbar">
          <button className="btn" onClick={check} disabled={!text.trim()}>
            <Icon name="radar" size={15} /> Check message
          </button>
          {text && (
            <button
              className="btn ghost"
              onClick={() => {
                setText("");
                setVerdict(null);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {verdict && (
          <div
            style={{
              marginTop: 16,
              border: `1px solid var(--${verdict.level === "clean" ? "safe" : verdict.level === "warn" ? "warn" : "danger"})`,
              background:
                verdict.level === "clean"
                  ? "rgba(62,230,160,0.06)"
                  : verdict.level === "warn"
                    ? "rgba(255,196,107,0.06)"
                    : "rgba(255,138,122,0.07)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
                fontSize: 14,
                color:
                  verdict.level === "clean"
                    ? "var(--safe)"
                    : verdict.level === "warn"
                      ? "var(--warn)"
                      : "var(--danger)",
              }}
            >
              <Icon name={verdict.level === "clean" ? "check" : "alert"} size={16} />
              {verdict.level === "clean"
                ? "No pattern clues · unknown"
                : verdict.level === "warn"
                  ? `Suspicious — ${verdict.signals.length} signal${verdict.signals.length > 1 ? "s" : ""}`
                  : `Likely scam — ${verdict.signals.length} signals`}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text)" }}>
              {verdict.summary}
            </div>
            {verdict.signals.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
                {verdict.signals.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <details className="glm-details"><summary>Coverage & privacy</summary><p>Use invented messages only. Local pattern clues cannot verify senders or establish safety. No inbox or network monitoring is connected.</p></details>
      </section>

      <section className="panel glm-page">
        <div className="glm-page-heading"><h3 className="panel-title">Alert Centre</h3><span className="badge">Synthetic examples · not live</span></div>
        {SAMPLE_ALERTS.map((a) => (
          <div
            key={a.id}
            className={`feed-line ${a.severity}`}
            style={{ border: "1px solid var(--grid-line)", borderRadius: "var(--radius-sm)", marginBottom: 8, padding: "10px 12px" }}
          >
            <span className="feed-ico">
              <Icon name={a.icon} size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="feed-msg" style={{ color: "var(--text)" }}>
                <b>{a.title}</b>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{a.desc}</div>
            </div>
            <span className="feed-ts">{a.source}</span>
          </div>
        ))}
        <span className="glm-caption">Automatic network monitoring is unavailable.</span>
      </section>
    </div>
  );
}


