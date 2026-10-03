import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import HoldButton from "../components/ui/HoldButton";

interface QuarantineRow {
  id: number;
  vault_file: string;
  original_path: string;
  sha256: string;
  quarantined_at: string;
  threat_name: string;
}

export default function QuarantineView() {
  const [items, setItems] = useState<QuarantineRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    invoke<QuarantineRow[]>("list_quarantine")
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  async function restore(id: number) {
    setBusy(true);
    try {
      await invoke("restore_quarantine", { id });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function destroy(id: number) {
    setBusy(true);
    try {
      await invoke("destroy_quarantine", { id });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h3 className="panel-title">Quarantine Vault — AES-256 encrypted</h3>
      {items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Vault empty. Neutralized threats will appear here.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Threat</th>
              <th>Original path</th>
              <th>SHA-256</th>
              <th>Quarantined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <tr key={q.id}>
                <td>
                  <span className="badge quarantined">{q.threat_name}</span>
                </td>
                <td>{q.original_path}</td>
                <td>{q.sha256.slice(0, 16)}…</td>
                <td>{q.quarantined_at}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button className="btn ghost" style={{ padding: "4px 10px" }} disabled={busy} onClick={() => restore(q.id)}>
                      Restore
                    </button>
                    <HoldButton
                      size="sm"
                      holdTime={1400}
                      backgroundColor="rgba(255,46,76,0.12)"
                      fillColor="#ff2e4c"
                      textColor="#ff8fa0"
                      fillTextColor="#ffffff"
                      radius={8}
                      onHold={() => destroy(q.id)}
                    >
                      Destroy
                    </HoldButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
