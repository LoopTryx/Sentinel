import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./fonts.css";
import "./tailwind.css";
import "./desktop-glass.css";
import { configureDesktopPresentation } from "./desktop-presentation";

configureDesktopPresentation(window.location.search, document.documentElement);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
