import { Fragment, useEffect, useState } from "react";
import {useDemoState, demoCall} from './demo-bridge';
import {canDragWindow} from './desktop-interactions';
import { ThreatProvider, useThreat } from "./state";
import Dashboard from "./views/Dashboard";
import ScanView from "./views/ScanView";
import PasswordManagerView from "./views/PasswordManagerView";
import QuarantineView from "./views/QuarantineView";
import ThreatLogView from "./views/ThreatLogView";
import WatchtowerView from "./views/WatchtowerView";
import UsbGuardView from "./features/usb/UsbGuardView";
import TextLoop from "./components/ui/TextLoop";
import "./components/text-loop.css";
import GradientASCII from "./components/ui/GradientASCII";
import Icon from "./components/Icon";
import LiquidSidebar from "./components/LiquidSidebar";
import "./theme.css";
import "./readability.css";

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
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [view, setView] = useState<ViewId>("dashboard");
  const { level, scanAlert } = useThreat();
  useBoxGlow();

  const statusLabel =
    scanAlert ? 'Scan finding · review required' : demo ? 'Connected · partial coverage' : level === "danger"
      ? "Preview · scenario alert"
      : level === "warn"
        ? "Preview · scenario attention"
        : "Preview · agent unavailable";



  return (
    <div className={`shell${view === "password" ? " password-shell" : ""}${sidebarCollapsed?" sidebar-collapsed":""}`}>
      <div className="window-actions"><button aria-label="Minimize to tray" onClick={()=>void import('./demo-bridge').then(m=>m.demoCall('window.hide')).catch(()=>{})}>−</button><button aria-label="Close to tray" onClick={()=>void import('./demo-bridge').then(m=>m.demoCall('window.hide')).catch(()=>{})}>×</button></div>
      {/* Owner-supplied ASCII backdrop; decoration never intercepts input. */}
      <div
        className="dither-bg"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          opacity: view === "password" ? 0.40 : 0.75,
        }}
      >
        <GradientASCII
          colors={["#1e3fd8","#f6f8ff","#a5d8ff","#38bdf8"]}
          shape="horizon" characters=" =+xX0S8#@" cellSize={18} density={0.8}
          dpr={1} maxFps={24} mouseInteraction={false} clickEffect="none"
        />
      </div>

      <LiquidSidebar collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(value=>!value)}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="shield" size={18} />
            <span className="brand-dot" />
          </div>
          <div className="brand-name">SENTINEL</div>
        </div>

        <nav className="sidebar-nav" aria-label="Sentinel pages">{NAV.map((n) => (
          <Fragment key={n.id}>
          {n.id === "dashboard" && <div className="nav-label">Protect</div>}
          {n.id === "password" && <div className="nav-label">Tools</div>}
          {n.id === "quarantine" && <div className="nav-label">System</div>}
          <button
            key={n.id}
            aria-label={n.label} title={n.label}
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
                  fontSize: "0.75rem",
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
        ))}</nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text" style={{ color: "rgba(232,241,255,0.55)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.18em" }}>
              THINK · PROTECT · DEFEND
            </div>
            <div className="sidebar-footer-ver" style={{ marginTop: 4 }}>
              v0.2 // Y2K CONSOLE BUILD
            </div>
          </div>
        </div>
      </LiquidSidebar>

      <main className="main">
        <header className="topbar" onMouseDown={event => { if(canDragWindow(event.target,event.button)){ event.preventDefault(); void demoCall('window.drag').catch(()=>{}); } }} style={{ position: "relative", zIndex: 2 }}>
          <h1>{VIEW_TITLES[view]}</h1>
          <div className="protection-pill">
            <span className="led" /> {statusLabel}
          </div>
        </header>

        <div
          className="content"
          style={{ position: "relative", zIndex: 1, background: "transparent" }}
        >
          {view === "dashboard" && <Dashboard onNavigate={setView} onViewAll={() => setView("log")} onOpenUsb={() => setView("usb")} />}
          {view === "scan" && <ScanView />}
          {view === "watchtower" && <WatchtowerView />}
          {view === "usb" && <UsbGuardView />}
          {view === "password" && <PasswordManagerView />}
          {view === "quarantine" && <QuarantineView />}
          {view === "log" && <ThreatLogView />}
        </div>
        <footer className="desktop-ribbon">
          <TextLoop text="Sentinel" shape="line" speed={135} direction="forward" separator="✦" curviness={90} tilt={0} fontSize={40} fontWeight={800} letterSpacing={1} uppercase ribbon ribbonColor="#414bff" ribbonWidth={76} edgeFade={0.1} cross={false} crossAngle={14} draggable scrollBoost={0} outline={false} pauseOnHover outlineWidth={1.5} color="#000000"/>
        </footer>
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
