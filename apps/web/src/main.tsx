import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Progressive web app: offline shell when served over http(s). Not used for file:// builds.
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("./sw.js", document.baseURI).href).catch(() => {
      /* offline support is optional */
    });
  });
}
