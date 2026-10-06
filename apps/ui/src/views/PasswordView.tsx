import { useMemo, useState } from "react";

/* ---------------- strength engine (offline, no dependencies) ------------- */

const COMMON = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "letmein",
  "dragon", "111111", "iloveyou", "admin", "welcome", "login", "princess",
  "sunshine", "master", "football", "shadow", "superman", "trustno1",
  "password1", "india", "cricket", "hello", "freedom", "whatever", "qazwsx",
  "google", "facebook", "samsung", "lol123", "pokemon", "sachin", "dhoni",
]);

function analyze(pw: string) {
  if (!pw)
    return {
      score: 0, label: "EMPTY", entropy: 0, crackTime: "—", crackBits: 0,
      tips: ["Type or generate a password to analyze it."], pool: 0,
    };

  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;

  const lower = pw.toLowerCase();
  const entropyBits = pw.length * Math.log2(Math.max(pool, 2));

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pool >= 62 && pw.length >= 10) score++;
  if (entropyBits >= 80) score++;

  const tips: string[] = [];
  let cracked = entropyBits;

  if (COMMON.has(lower)) {
    cracked = Math.min(cracked, 8);
    tips.push("This is one of the most commonly leaked passwords — never use it.");
  }
  if (/^[0-9]+$/.test(pw)) {
    cracked = Math.min(cracked, 20);
    tips.push("Digits only — attackers try every number combination first.");
  }
  if (/(.)\1{2,}/.test(pw)) {
    cracked -= 8;
    tips.push("Repeated characters (aaa, 111) make it much weaker.");
  }
  if (/(0123|1234|2345|abcd|qwer|asdf)/i.test(pw)) {
    cracked -= 10;
    tips.push("Keyboard or alphabet sequences are trivially guessed.");
  }
  if (/^(19|20)\d{2}$/.test(pw.slice(-4)) || /(19|20)\d{2}/.test(pw)) {
    cracked -= 5;
    tips.push("Years/birthdates are the first thing attackers try.");
  }
  if (pw.length < 12) tips.push("Use at least 12 characters — length beats complexity.");
  if (!/[^a-zA-Z0-9]/.test(pw)) tips.push("Add a symbol (!@#…) for a stronger mix.");
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) tips.push("Mix UPPER and lower case.");

  cracked = Math.max(cracked, 1);

  // offline attack: ~100 billion guesses/sec (modern GPU rig)
  const seconds = Math.pow(2, cracked) / 1e11 / 2;
  const crackTime = humanTime(seconds);

  const labels = ["CRITICAL", "WEAK", "FAIR", "STRONG", "FORTRESS"];
  if (tips.length && score < 4) score = Math.max(0, score - (cracked < entropyBits - 10 ? 2 : 1));
  if (cracked < 28) score = Math.min(score, 0);
  else if (cracked < 40) score = Math.min(score, 1);
  else if (cracked < 60) score = Math.min(score, 2);
  else score = Math.max(score, 3);

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    entropy: Math.round(entropyBits),
    crackTime,
    crackBits: Math.round(cracked),
    tips: tips.slice(0, 3).length ? tips.slice(0, 3) : ["Solid password — nothing to flag."],
    pool,
  };
}

function humanTime(s: number): string {
  if (s < 1) return "instantly";
  if (s < 60) return `${Math.round(s)} seconds`;
  if (s < 3600) return `${Math.round(s / 60)} minutes`;
  if (s < 86400) return `${Math.round(s / 3600)} hours`;
  if (s < 2592000) return `${Math.round(s / 86400)} days`;
  if (s < 31536000) return `${Math.round(s / 2592000)} months`;
  const years = s / 31536000;
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1e6) return `${Math.round(years / 1000)}K years`;
  if (years < 1e9) return `${Math.round(years / 1e6)}M years`;
  return "billions of years";
}

/* ------------------------------- generator ------------------------------- */

function generatePassword(len: number, upper: boolean, digits: boolean, symbols: boolean) {
  let chars = "abcdefghijkmnopqrstuvwxyz"; // no l — avoids ambiguity
  if (upper) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ";
  if (digits) chars += "23456789";
  if (symbols) chars += "!@#$%^&*-_=+?";
  const limit = Math.floor(256 / chars.length) * chars.length;
  let output = '';
  for (let rounds = 0; rounds < 128 && output.length < len; rounds++) {
    const bytes = crypto.getRandomValues(new Uint8Array(64));
    for (const n of bytes) if (n < limit && output.length < len) output += chars[n % chars.length];
  }
  if (output.length !== len) throw new Error('Random generation unavailable');
  return output;
}

/* --------------------------------- view ---------------------------------- */

const SCORE_COLORS = ["#ff8a7a", "#ff8a7a", "#ffc46b", "#3ee6a0", "#3ee6a0"];

const CHAR_CLASSES = [
  { key: "lower", label: "a-z", test: /[a-z]/ },
  { key: "upper", label: "A-Z", test: /[A-Z]/ },
  { key: "digit", label: "0-9", test: /[0-9]/ },
  { key: "symbol", label: "#!$", test: /[^a-zA-Z0-9]/ },
];

/* Verdict ring: score 0–4 shown as a glowing arc around the verdict word */
function VerdictGauge({ score, label, active }: { score: number; label: string; active: boolean }) {
  const color = active ? SCORE_COLORS[score] : "var(--text-faint)";
  const C = 2 * Math.PI * 50;
  return (
    <div style={{ position: "relative", width: 118, height: 118 }}>
      <svg width="118" height="118" viewBox="0 0 118 118" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="59" cy="59" r="50" fill="none" stroke="rgba(139,151,197,0.12)" strokeWidth="9" />
        <circle
          cx="59" cy="59" r="50" fill="none"
          stroke={active ? SCORE_COLORS[score] : "rgba(124,184,255,0.2)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(score / 4) * C} ${C}`}
          style={{
            filter: active ? `drop-shadow(0 0 7px ${SCORE_COLORS[score]})` : "none",
            transition: "stroke-dasharray 0.5s cubic-bezier(0.2,0.8,0.2,1), stroke 0.3s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
          letterSpacing: 1.5, color,
          textShadow: active ? `0 0 14px ${SCORE_COLORS[score]}66` : "none",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function PasswordView() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [genLen, setGenLen] = useState(16);
  const [genUpper, setGenUpper] = useState(false);
  const [genDigits, setGenDigits] = useState(false);
  const [genSymbols, setGenSymbols] = useState(false);
  const [copied, setCopied] = useState(false);

  const a = useMemo(() => analyze(pw), [pw]);
  const meterColor = SCORE_COLORS[a.score];

  // crack-time marker position on a log2 scale: 0 bits → left, 128+ bits → right
  const crackPos = Math.min(Math.max(Math.log2(Math.max(a.crackBits, 1)) / 7, 0), 1);

  async function copyGenerated() {
    const g = generatePassword(genLen, genUpper, genDigits, genSymbols);
    setPw(g);
    try {
      await navigator.clipboard.writeText(g);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be blocked — password is still in the field */
    }
  }

  return (
    <><p className="panel">Educational local estimate only. Use invented examples; do not enter real credentials. No breach check or vault is connected. Times assume a uniform random password and 100 billion guesses/second; human patterns can be far easier to guess.</p>
      <section className="panel">
        <h3 className="panel-title">Password Strength Analyzer</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            type={show ? "text" : "password"}
            maxLength={128} aria-label="Invented password example" placeholder="Type a password to analyze — nothing leaves this machine"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ fontSize: 15, letterSpacing: show ? 0.5 : 2 }}
          />
          <button className="btn ghost" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>

        {/* strength bar */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 6,
            height: 8,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: 99,
                background:
                  pw && i <= a.score ? SCORE_COLORS[a.score] : "rgba(139,151,197,0.12)",
                boxShadow:
                  pw && i <= a.score ? `0 0 12px ${SCORE_COLORS[a.score]}55` : "none",
                transition: "background 0.3s ease, box-shadow 0.3s ease",
              }}
            />
          ))}
        </div>

        {pw && (
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {a.tips.map((t) => (
              <span key={t} className={`tip-chip${t.startsWith("Solid") ? " ok" : ""}`}>
                {t.startsWith("Solid") ? "✓" : "⚠"} {t}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">Analysis — live</h3>
        <div className="pw-grid">
          {/* VERDICT — glowing score ring */}
          <div className="stat pw-card">
            <span className="pw-label">Verdict</span>
            <VerdictGauge score={a.score} label={a.label} active={!!pw} />
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 22, height: 3, borderRadius: 2,
                    background: pw && i < a.score ? meterColor : "rgba(124,184,255,0.15)",
                    boxShadow: pw && i < a.score ? `0 0 8px ${meterColor}88` : "none",
                    transition: "background 0.3s ease, box-shadow 0.3s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* ENTROPY — bits on a 128-bit meter */}
          <div className="stat pw-card">
            <span className="pw-label">Entropy</span>
            <div>
              <span className="pw-num">{a.entropy}</span>
              <span className="pw-unit">bits</span>
            </div>
            <div className="pw-meter" style={{ margin: "0 6px" }}>
              <div
                className="pw-meter-fill"
                style={{
                  width: `${Math.min(a.entropy / 128, 1) * 100}%`,
                  background: "linear-gradient(90deg, rgba(var(--accent-rgb), 0.45), var(--blue-bright))",
                  boxShadow: "0 0 14px rgba(var(--accent-rgb), 0.6)",
                }}
              />
              {[28, 60, 80].map((t) => (
                <span key={t} className="pw-tick" style={{ left: `${(t / 128) * 100}%` }} />
              ))}
            </div>
          </div>

          {/* CRACK TIME — marker on an instant → uncrackable scale */}
          <div className="stat pw-card">
            <span className="pw-label">Crack time</span>
            <span
              className="pw-num"
              style={{
                fontSize:
                  a.crackTime.length <= 8 ? 30 : a.crackTime.length <= 16 ? 24 : 20,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: "0 8px",
              }}
            >
              {a.crackTime}
            </span>
            <div className="pw-meter" style={{ margin: "0 6px" }}>
              <div
                className="pw-meter-fill"
                style={{
                  width: "100%",
                  background: "linear-gradient(90deg, #ff8a7a, #ffc46b, #3ee6a0)",
                  opacity: 0.22,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  bottom: -4,
                  left: `${crackPos * 100}%`,
                  width: 3,
                  transform: "translateX(-50%)",
                  borderRadius: 2,
                  background: "var(--chrome-hi)",
                  boxShadow: "0 0 10px rgba(232,241,255,0.9)",
                  transition: "left 0.5s cubic-bezier(0.2,0.8,0.2,1)",
                }}
              />
            </div>
          </div>

          {/* CHARACTER POOL — classes light up as they are used */}
          <div className="stat pw-card">
            <span className="pw-label">Character pool</span>
            <div style={{ display: "flex", gap: 8 }}>
              {CHAR_CLASSES.map((c) => (
                <span key={c.key} className={`pw-chip${c.test.test(pw) ? " on" : ""}`}>
                  {c.label}
                </span>
              ))}
            </div>
            <div className="pw-meter" style={{ margin: "0 6px" }}>
              <div
                className="pw-meter-fill"
                style={{
                  width: `${Math.min(pw.length / 20, 1) * 100}%`,
                  background: "linear-gradient(90deg, rgba(var(--accent-rgb), 0.45), var(--blue-bright))",
                  boxShadow: "0 0 14px rgba(var(--accent-rgb), 0.6)",
                }}
              />
            </div>
            <span className="pw-unit" style={{ marginLeft: 0 }}>
              {pw.length} characters
            </span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Strong Password Generator</h3>
        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            LENGTH
            <input
              type="range"
              min={8}
              max={32}
              value={genLen}
              onChange={(e) => setGenLen(Number(e.target.value))}
              style={{ accentColor: "var(--cyan)", width: 140 }}
            />
            <span style={{ color: "var(--cyan)", width: 22 }}>{genLen}</span>
          </label>
          {(
            [
              ["A-Z", genUpper, setGenUpper],
              ["0-9", genDigits, setGenDigits],
              ["#!$", genSymbols, setGenSymbols],
            ] as const
          ).map(([label, val, set]) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => set(e.target.checked)}
                style={{ accentColor: "var(--cyan)" }}
              />
              {label}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={copyGenerated}>
            ⚡ Generate + Copy
          </button>
          {copied && (
            <span style={{ color: "var(--safe)", fontFamily: "var(--font-mono)", fontSize: 12, alignSelf: "center" }}>
              ✓ copied to clipboard
            </span>
          )}
        </div>
        <p style={{ marginTop: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Generated locally with crypto-grade randomness — never sent anywhere.
        </p>
      </section>
    </>
  );
}

