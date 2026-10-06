import { useCallback, useEffect, useState } from "react";
import { backendInvoke, hasBackend } from "../backend";
import HoldButton from "../components/ui/HoldButton";
import SwipeRow from "../components/ui/SwipeRow";
import Icon from "../components/Icon";

interface QuarantineRow {
  id: number;
  vault_file: string;
  original_path: string;
  sha256: string;
  quarantined_at: string;
  threat_name: string;
}


const STUB = (
  <section className="panel">
    <h3 className="panel-title">Quarantine Vault</h3>
    <p>Quarantine is unavailable: no reviewed storage/remediation adapter is connected.</p>
    <p>This is separate from the planned password manager. No encrypted vault, restore or destruction operation is enabled.</p>
    <button className="btn" disabled>Restore</button>
  </section>
);

export default function QuarantineView() {
  const [items, setItems] = useState<QuarantineRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    backendInvoke<QuarantineRow[]>("list_quarantine")
      .then(setItems)
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  async function restore(id: number) {
    setBusy(true);
    try {
      await backendInvoke("restore_quarantine", { id });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function destroy(id: number) {
    setBusy(true);
    try {
      await backendInvoke("destroy_quarantine", { id });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!hasBackend()) return STUB;

  return (
    <section className="panel">
      <h3 className="panel-title">Quarantine Vault — AES-256 encrypted</h3>
      {items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Vault empty. Neutralized threats will appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((q) => (
            <SwipeRow
              key={q.id}
              label={`Quarantined threat ${q.threat_name}`}
              height={74}
              radius={14}
              actionWidth={92}
              disabled={busy}
              rowColor="var(--bg-panel-2)"
              drawerColor="#2a0d14"
              actionColor="#d7263d"
              textColor="var(--text)"
              actions={[
                { id: "delete", label: "Delete" },
                {
                  id: "restore",
                  label: "Restore",
                  icon: <Icon name="check" size={16} />,
                  onSelect: () => restore(q.id),
                },
              ]}
              onCommit={() => destroy(q.id)}
            >
              <span className="badge quarantined">{q.threat_name}</span>
              <span
                style={{
                  minWidth: 0,
                  fontSize: 13,
                  color: "var(--text)",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {q.original_path.split(/[\\/]/).pop()}
              </span>
              <span
                style={{
                  minWidth: 0,
                  fontSize: 11.5,
                  color: "var(--text-faint)",
                  fontFamily: "var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {q.original_path} · {q.sha256.slice(0, 12)}… · {q.quarantined_at}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <button
                  className="btn ghost"
                  style={{ padding: "4px 10px", height: "auto" }}
                  disabled={busy}
                  onClick={() => restore(q.id)}
                >
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
              </span>
            </SwipeRow>
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: 14,
          color: "var(--text-faint)",
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
        }}
      >
        swipe a row left → Delete destroys it forever · or use the buttons
      </div>
    </section>
  );
}
