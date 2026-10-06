import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Product typography: Inter (body/UI) + Roboto (display) — self-hosted via Fontsource.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./fonts.css";
import "./tailwind.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
