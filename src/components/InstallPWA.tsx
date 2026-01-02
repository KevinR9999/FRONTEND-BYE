import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. DETECTAR SI ESTÁ INSTALADA COMO PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    // 2. GUARDAR ESTADO DE INSTALACIÓN
    const wasInstalled = localStorage.getItem('pwaWasInstalled') === 'true';

    if (isStandalone) {
      // Está instalada AHORA → marcar como instalada
      console.log(' PWA actualmente instalada');
      localStorage.setItem('pwaWasInstalled', 'true');
      return; // No mostrar banner
    } else {
      // NO está instalada AHORA
      if (wasInstalled) {
        // Pero ANTES estaba instalada → fue desinstalada
        console.log('🔄 PWA fue desinstalada - limpiando flags');
        localStorage.removeItem('pwaWasInstalled');
        localStorage.removeItem('installPromptNeverShow');
        localStorage.removeItem('installPromptRemindLater');
      }
    }

    // 3. VERIFICAR FLAGS DE USUARIO
    const neverShow = localStorage.getItem('installPromptNeverShow');
    if (neverShow === 'true') {
      console.log(' Usuario dijo "No volver a mostrar"');
      return;
    }

    const remindLater = localStorage.getItem('installPromptRemindLater');
    if (remindLater) {
      const remindDate = new Date(remindLater);
      const now = new Date();
      const daysPassed = (now.getTime() - remindDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysPassed < 3) {
        console.log(` Recordar en ${Math.ceil(3 - daysPassed)} días`);
        return;
      }
      // Ya pasaron 3 días, limpiar
      localStorage.removeItem('installPromptRemindLater');
    }

    // 4. ESCUCHAR EVENTO beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log(' beforeinstallprompt capturado');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar banner después de 3 segundos
      setTimeout(() => {
        setShowBanner(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. DETECTAR CUANDO SE INSTALA
    const handleAppInstalled = () => {
      console.log(' App instalada exitosamente');
      localStorage.setItem('pwaWasInstalled', 'true');
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. CLEANUP
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handlers
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log(' Usuario aceptó instalar');
      localStorage.setItem('pwaWasInstalled', 'true');
    } else {
      console.log(' Usuario canceló la instalación');
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleRemindLater = () => {
    localStorage.setItem('installPromptRemindLater', new Date().toISOString());
    setShowBanner(false);
    console.log(' Recordar en 3 días');
  };

  const handleNeverShow = () => {
    localStorage.setItem('installPromptNeverShow', 'true');
    setShowBanner(false);
    console.log(' No volver a mostrar');
  };

  // No renderizar si no debe mostrarse
  if (!showBanner || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-purple-500 shadow-2xl z-50 animate-slide-up">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
              BYE
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Instalar BYE</h3>
              <p className="text-sm text-gray-600">Accede más rápido sin navegador</p>
            </div>
          </div>
          <button
            onClick={handleNeverShow}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleInstallClick}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
             Instalar ahora
          </button>
          
          <button
            onClick={handleRemindLater}
            className="w-full bg-gray-100 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
             Recordarme en 3 días
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;