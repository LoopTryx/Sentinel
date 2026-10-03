export default function ScanView() {
  return <section className="panel"><h3 className="panel-title">Selected-file inspection</h3>
    <p>The console scan adapter is unavailable. The existing read-only scanner remains available through the native preview and CLI; this page does not inspect files.</p>
    <div className="badge">Partial coverage · agent not connected</div>
    <p>Quick, full and custom scopes, actual counts, cancellation and reports will appear when the reviewed selection/job adapter is connected.</p>
    <div style={{display: 'flex', gap: 12}}><button className="btn" disabled>Choose file</button><button className="btn" disabled>Choose folder</button></div>
    <p>No automatic quarantine, full signature engine or USB release is available.</p></section>;
}
