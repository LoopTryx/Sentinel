import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";

export type ThreatLevel = "safe" | "warn" | "danger";

export interface TelemetryLine {
  kind: string;
  level: "info" | "warn" | "danger";
  message: string;
  detail: string | null;
  ts: string;
  seq: number;
}

interface ThreatCtx {
  level: ThreatLevel;
  feed: TelemetryLine[];
  setLevel: (l: ThreatLevel) => void;
  push: (l: Omit<TelemetryLine, "seq">) => void;
}

const Ctx = createContext<ThreatCtx>(null as unknown as ThreatCtx);

export const useThreat = () => useContext(Ctx);

export function ThreatProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevel] = useState<ThreatLevel>("safe");
  const [feed, setFeed] = useState<TelemetryLine[]>([]);
  const seq = useRef(0);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((l: Omit<TelemetryLine, "seq">) => {
    setFeed((f) => [{ ...l, seq: seq.current++ }, ...f].slice(0, 200));
  }, []);

  useEffect(() => {
    // A warn only holds the amber state for a while — if nothing worse
    // arrives it decays back to azure. danger keeps latching until reset.
    const WARN_DECAY_MS = 15000;
    const armWarnDecay = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => {
        setLevel((cur) => (cur === "warn" ? "safe" : cur));
        warnTimer.current = null;
      }, WARN_DECAY_MS);
    };

    const un = listen<TelemetryLine>("telemetry://event", (e) => {
      const line = e.payload;
      setFeed((f) => [{ ...line, seq: seq.current++ }, ...f].slice(0, 200));
      if (line.level === "danger") {
        if (warnTimer.current) {
          clearTimeout(warnTimer.current);
          warnTimer.current = null;
        }
        setLevel("danger");
      } else if (line.level === "warn") {
        setLevel((cur) => (cur === "safe" ? "warn" : cur));
        armWarnDecay();
      }
    });
    return () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      un.then((f) => f());
    };
  }, []);

  // Keep <body data-threat> in sync so the entire console recolors.
  useEffect(() => {
    document.body.dataset.threat = level;
  }, [level]);

  return (
    <Ctx.Provider value={{ level, feed, setLevel, push }}>{children}</Ctx.Provider>
  );
}

