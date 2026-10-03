import { useEffect, useRef } from "react";
import Icon from "./Icon";
import type { TelemetryLine } from "../state";

const ICONS: Record<string, string> = {
  "scan-started": "scan",
  "file-scanned": "check",
  "threat-found": "alert",
  quarantined: "vault",
  "scan-done": "check",
  system: "zap",
};

const VERBS: Record<string, string> = {
  "scan-started": "Scan started",
  "file-scanned": "File checked",
  "threat-found": "Threat detected",
  quarantined: "Neutralized",
  "scan-done": "Scan complete",
  system: "System",
};

/** Human-sentence activity feed: icon chip + message + mono timestamp. */
export default function TelemetryFeed({ feed }: { feed: TelemetryLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [feed]);

  if (feed.length === 0) {
    return (
      <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "8px 0" }}>
        No scenario activity. Live monitoring is unavailable.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", maxHeight: 340, overflowY: "auto" }} ref={ref}>
      {feed.slice(0, 40).map((l) => (
        <div className={`feed-line ${l.level}`} key={l.seq}>
          <span className="feed-ico">
            <Icon name={ICONS[l.kind] ?? "activity"} size={15} />
          </span>
          <span className="feed-msg">
            <b>{VERBS[l.kind] ?? "Event"}</b>
            {" — "}
            {l.message}
            {l.detail ? ` (${l.detail})` : ""}
          </span>
          <span className="feed-ts">{l.ts}</span>
        </div>
      ))}
    </div>
  );
}

