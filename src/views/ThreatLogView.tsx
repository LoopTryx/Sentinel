import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ThreatRow {
  id: number;
  detected_at: string;
  path: string;
  sha256: string;
  verdict: string;
  detections: string;
  action: string;
}

export default function ThreatLogView() {
  const [rows, setRows] = useState<ThreatRow[]>([]);

  useEffect(() => {
    const load = () =>
      invoke<ThreatRow[]>("list_recent_threats")
        .then(setRows)
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel">
      <h3 className="panel-title">Threat Log — persistent record</h3>
      {rows.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          No threats recorded yet.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Verdict</th>
              <th>Path</th>
              <th>Detections</th>
              <th>Action</th>
              <th>Detected at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge ${r.verdict}`}>{r.verdict}</span>
                </td>
                <td>{r.path}</td>
                <td>{r.detections}</td>
                <td>{r.action}</td>
                <td>{r.detected_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
