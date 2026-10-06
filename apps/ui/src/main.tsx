import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
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
