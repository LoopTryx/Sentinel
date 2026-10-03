export default function QuarantineView() {
 return <section className="panel"><h3 className="panel-title">Quarantine Vault</h3><p>Quarantine is unavailable: no reviewed storage/remediation adapter is connected.</p><p>This is separate from the planned password manager. No encrypted vault, restore or destruction operation is enabled.</p><button className="btn" disabled>Restore</button></section>;
}
