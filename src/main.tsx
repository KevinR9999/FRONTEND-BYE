import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";
import "./index.css";

// ========== PWA Install Prompt - Capturar ANTES de que React cargue ==========
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Guardar el prompt globalmente en window
declare global {
  interface Window {
    deferredPWAPrompt: BeforeInstallPromptEvent | null;
  }
}

window.deferredPWAPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAPrompt = e as BeforeInstallPromptEvent;
  console.log('✅ PWA: Prompt de instalación capturado (main.tsx)');
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA: App instalada exitosamente');
  window.deferredPWAPrompt = null;
  localStorage.setItem('pwaWasInstalled', 'true');
});
// =============================================================================

// Registrar el Service Worker automáticamente
const updateSW = registerSW({
  immediate: true,
  onRegistered(r) {
    console.log('✅ SW Registered:', r);
  },
  onRegisterError(error) {
    console.error('❌ SW registration error:', error);
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
