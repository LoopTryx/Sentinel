import { Fragment, useEffect, useState } from "react";
import {useDemoState} from './demo-bridge';
import { ThreatProvider, useThreat } from "./state";
import Dashboard from "./views/Dashboard";
import ScanView from "./views/ScanView";
import PasswordManagerView from "./views/PasswordManagerView";
import QuarantineView from "./views/QuarantineView";
import ThreatLogView from "./views/ThreatLogView";
import WatchtowerView from "./views/WatchtowerView";
import UsbGuardView from "./features/usb/UsbGuardView";
import Dither from "./components/ui/Dither";
import Icon from "./components/Icon";
import "./theme.css";

type ViewId =
  | "dashboard"
  | "scan"
  | "watchtower"
  | "usb"
  | "password"
  | "quarantine"
  | "log";

const NAV: { id: ViewId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Console", icon: "shield" },
  { id: "scan", label: "Scan & Detect", icon: "scan" },
  { id: "watchtower", label: "Watchtower", icon: "wifi" },
  { id: "usb", label: "USB Guard", icon: "shield" },
  { id: "password", label: "Passwords", icon: "key" },
  { id: "quarantine", label: "Quarantine", icon: "vault" },
  { id: "log", label: "Threat Log", icon: "list" },
];

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: "Console",
  scan: "Scan & Detect",
  watchtower: "Watchtower",
  usb: "USB Guard",
  password: "Passwords",
  quarantine: "Quarantine",
  log: "Threat Log",
};

/** Dither wave colors follow the global threat state: azure when calm,
 *  soft coral when something is wrong. Azure = theme accent #2f89e3. */
function ditherColors(level: string): {
  wave: [number, number, number];
  bg: [number, number, number];
} {
  if (level === "danger")
    return { wave: [1.0, 0.54, 0.48], bg: [0.09, 0.03, 0.04] };
  if (level === "warn")
    return { wave: [1.0, 0.77, 0.42], bg: [0.09, 0.06, 0.02] };
  return { wave: [0.184, 0.537, 0.89], bg: [0.02, 0.03, 0.1] };
}

/** MagicBento-style border glow for EVERY panel and stat box: a cyan light
 *  that slides along the nearest box edges as the cursor moves. Drives the
 *  same --glow-x / --glow-y / --glow-intensity custom properties the bento
 *  cards use, so all boxes share one coherent animation. */
function useBoxGlow() {
  useEffect(() => {
    const RADIUS = 300;
    const proximity = RADIUS * 0.5;
    const fadeDistance = RADIUS * 0.75;
    let raf = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>(".panel, .stat").forEach((box) => {
        const rect = box.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.max(
          0,
          Math.hypot(x - centerX, y - centerY) - Math.max(rect.width, rect.height) / 2
        );
        let intensity = 0;
        if (distance <= proximity) intensity = 1;
        else if (distance <= fadeDistance)
          intensity = (fadeDistance - distance) / (fadeDistance - proximity);

        box.style.setProperty("--glow-x", `${((x - rect.left) / rect.width) * 100}%`);
        box.style.setProperty("--glow-y", `${((y - rect.top) / rect.height) * 100}%`);
        box.style.setProperty("--glow-intensity", intensity.toFixed(3));
      });
    };

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      document
        .querySelectorAll<HTMLElement>(".panel, .stat")
        .forEach((box) => box.style.setProperty("--glow-intensity", "0"));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

function Shell() {
  const {state:demo}=useDemoState();
  const [view, setView] = useState<ViewId>("dashboard");
  const { level } = useThreat();
  useBoxGlow();

  const statusLabel =
    demo ? 'Connected demo · partial coverage' : level === "danger"
      ? "Preview · scenario alert"
      : level === "warn"
        ? "Preview · scenario attention"
        : "Preview · agent unavailable";

  const { wave, bg } = ditherColors(level);

  return (
    <div className={`shell${view === "password" ? " password-shell" : ""}`}>
      {/* Living dither backdrop — spans the WHOLE app (sidebar included) and
          recolors with the threat state. The sidebar's liquid glass blurs it. */}
      <div
        className="dither-bg"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          opacity: view === "password" ? 0.12 : 0.45,
        }}
      >
        <Dither
          waveColor={wave}
          backgroundColor={bg}
          colorNum={4}
          pixelSize={5}
          enableMouseInteraction={false}
        />
      </div>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="shield" size={18} />
            <span className="brand-dot" />
          </div>
          <div className="brand-name">SENTINEL</div>
        </div>

        {NAV.map((n) => (
          <Fragment key={n.id}>
          {n.id === "dashboard" && <div className="nav-label">Protect</div>}
          {n.id === "password" && <div className="nav-label">Tools</div>}
          {n.id === "quarantine" && <div className="nav-label">System</div>}
          <button
            key={n.id}
            aria-current={view === n.id ? "page" : undefined} className={`nav-btn${view === n.id ? " active" : ""}`}
            onClick={() => setView(n.id)}
          >
            <Icon name={n.icon} size={16} />
            {n.label}
            {n.id === "watchtower" && level !== "preview" && (
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  padding: "1.5px 7px",
                  borderRadius: 99,
                  background: "var(--state-dim)",
                  color: "var(--state)",
                  border: "1px solid var(--state)",
                }}
              >
                !
              </span>
            )}
          </button>
          </Fragment>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-footer-text" style={{ color: "rgba(232,241,255,0.55)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.18em" }}>
              THINK · PROTECT · DEFEND
            </div>
            <div className="sidebar-footer-ver" style={{ marginTop: 4 }}>
              v0.2 // Y2K CONSOLE BUILD
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar" style={{ position: "relative", zIndex: 2 }}>
          <h1>{VIEW_TITLES[view]}</h1>
          <div className="protection-pill">
            <span className="led" /> {statusLabel}
          </div>
        </header>
        <div
          className="content"
          style={{ position: "relative", zIndex: 1, background: "transparent" }}
        >
          {view === "dashboard" && <Dashboard onViewAll={() => setView("log")} onOpenUsb={() => setView("usb")} />}
          {view === "scan" && <ScanView />}
          {view === "watchtower" && <WatchtowerView />}
          {view === "usb" && <UsbGuardView onOpenScan={() => setView("scan")} />}
          {view === "password" && <PasswordManagerView />}
          {view === "quarantine" && <QuarantineView />}
          {view === "log" && <ThreatLogView />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThreatProvider>
      <Shell />
    </ThreatProvider>
  );
}

