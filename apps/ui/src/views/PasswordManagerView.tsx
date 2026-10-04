import { useState } from "react";
import PasswordView from "./PasswordView";
import "./password-manager.css";

// Invented metadata only. This view never accepts, stores or unlocks credentials.
const ACCOUNTS = [
  { id: "mail", name: "Orbit Mail", user: "alex@example.test", host: "mail.example.test", initials: "OM", health: "Weak", advice: "Replace a short, predictable password with a unique generated one." },
  { id: "school", name: "School Portal", user: "student@example.test", host: "school.example.test", initials: "SP", health: "Reused", advice: "Give this account its own password. Reuse puts multiple accounts at risk." },
  { id: "notes", name: "Field Notes", user: "alex@example.test", host: "notes.example.test", initials: "FN", health: "Unique", advice: "This sample represents a unique password. No breach lookup has been performed." },
  { id: "games", name: "Arcade", user: "player@example.test", host: "arcade.example.test", initials: "AR", health: "Reused", advice: "This sample shares a password with School Portal. Change each account separately." },
] as const;

export default function PasswordManagerView() {
  const [mode, setMode] = useState<"accounts" | "health" | "tools">("accounts");
  const [sample, setSample] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const accounts = ACCOUNTS.filter(a => `${a.name} ${a.user} ${a.host}`.toLowerCase().includes(query.toLowerCase()) && (mode !== "health" || a.health !== "Unique"));
  const active = accounts.find(a => a.id === selected);
  function closeSample() { setSample(false); setQuery(""); setSelected(null); }
  return <div className="password-manager">
    <section className="pm-heading">
      <div><span className="pm-eyebrow">SENTINEL / PASSWORDS</span><h2>Your accounts. One place.</h2><p>Find a login, review its health, or generate a stronger password.</p></div>
      <span className="pm-connection">Desktop vault unavailable</span>
    </section>
    <div className="pm-tabs" aria-label="Password manager sections">
      {([['accounts', 'Accounts'], ['health', 'Password health'], ['tools', 'Generator & checker']] as const).map(([id, label]) => <button key={id} className={`btn ${mode === id ? '' : 'ghost'}`} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}
    </div>
    {mode === "tools" ? <PasswordView/> : <>
      <section className="pm-banner"><span className="pm-lock" aria-hidden="true">◇</span><div><strong>{sample ? "Sample vault · invented accounts" : "Your vault is not connected yet"}</strong><p>{sample ? "Explore the layout. These are not saved passwords; nothing syncs or persists." : "Real unlock, import and autofill become available after the shared encrypted vault is connected."}</p></div><button className="btn ghost" onClick={() => sample ? closeSample() : setSample(true)}>{sample ? "Close sample" : "Explore sample vault"}</button></section>
      {sample ? <>
        <div className="pm-summary" aria-label="Sample password health">
          <div><strong>4</strong><span>Sample accounts</span></div><div><strong className="pm-attention">1</strong><span>Weak password</span></div><div><strong className="pm-attention">2</strong><span>Reused passwords</span></div><div><strong>—</strong><span>Breach check unavailable</span></div>
        </div>
        <div className="pm-workspace">
          <section className="panel pm-list"><div className="pm-list-heading"><h3>{mode === "health" ? "Needs attention" : "All accounts"}</h3><span>{accounts.length} samples</span></div>
            <input className="input" aria-label="Search sample accounts" placeholder="Search accounts or websites" value={query} maxLength={120} onChange={e => { setQuery(e.target.value); setSelected(null); }}/>
            <div className="pm-accounts">{accounts.map(a => <button key={a.id} aria-pressed={active?.id === a.id} className={`pm-account ${active?.id === a.id ? 'selected' : ''}`} onClick={() => setSelected(a.id)}><span className="pm-monogram">{a.initials}</span><span className="pm-account-name"><strong>{a.name}</strong><small>{a.user}</small></span><span className={`pm-health ${a.health === 'Unique' ? 'unique' : ''}`}>{a.health}</span></button>)}{!accounts.length && <p className="pm-empty">No matching samples. Try another account or website.</p>}</div>
          </section>
          <section className="panel pm-detail" aria-label="Sample account details">
            {active ? <><span className="pm-eyebrow">SAMPLE ACCOUNT</span><div className="pm-detail-title"><span className="pm-monogram">{active.initials}</span><h3>{active.name}</h3></div><dl><dt>Username</dt><dd>{active.user}</dd><dt>Website</dt><dd>{active.host}</dd><dt>Password</dt><dd className="pm-masked">Not stored in this preview</dd></dl><div className="pm-advice"><strong>{active.health} · illustrative assessment</strong><p>{active.advice}</p></div><div className="pm-actions"><button className="btn" onClick={() => setMode("tools")}>Generate a replacement</button><button className="btn ghost" disabled>Fill on website</button></div><p className="pm-footnote">Change a password in the actual website’s account settings. Sentinel cannot change it here. Example websites are fictional.</p></> : <div className="pm-empty-detail"><span className="pm-lock" aria-hidden="true">◇</span><h3>{mode === "health" ? "Start with the accounts at risk" : "Choose an account"}</h3><p>See its username, website and next steps here.</p></div>}
          </section>
        </div>
      </> : <section className="panel pm-unavailable"><h3>A shared vault for desktop and browser</h3><p>Saved logins, explicit website fill and password health will use the same encrypted vault.</p><div className="pm-actions"><button className="btn" disabled>Unlock vault</button><button className="btn ghost" disabled>Import selected Chrome export</button><button className="btn ghost" onClick={() => setMode("tools")}>Use local password tools</button></div></section>}
    </>}
  </div>;
}
