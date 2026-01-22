import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

// Hook para usar la lógica de instalación en cualquier componente
export const useInstallPWA = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    if (isStandalone) {
      localStorage.setItem('pwaWasInstalled', 'true');
      setIsInstalled(true);
      return;
    }

    // Si estaba instalada pero ahora no (desinstalada), limpiar flags
    const wasInstalled = localStorage.getItem('pwaWasInstalled') === 'true';
    if (wasInstalled) {
      localStorage.removeItem('pwaWasInstalled');
      localStorage.removeItem('installBannerDismissedAt');
    }

    // Verificar si el usuario ya descartó el banner (recordar en 3 días)
    const dismissedAt = localStorage.getItem('installBannerDismissedAt');
    if (dismissedAt) {
      const dismissDate = new Date(dismissedAt);
      const now = new Date();
      const daysPassed = (now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysPassed < 3) {
        return;
      }
      localStorage.removeItem('installBannerDismissedAt');
    }

    // Verificar si ya hay un prompt disponible (capturado en main.tsx)
    if (window.deferredPWAPrompt) {
      console.log('✅ PWA: Prompt encontrado en window.deferredPWAPrompt');
      setCanInstall(true);
    }

    // También escuchar por si llega después
    const handleBeforeInstallPrompt = () => {
      console.log('✅ PWA: Prompt capturado en componente');
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const prompt = window.deferredPWAPrompt;

    if (!prompt) {
      console.log('❌ PWA: No hay prompt disponible');
      return false;
    }

    try {
      console.log('🚀 PWA: Mostrando prompt de instalación...');
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      console.log('📊 PWA: Usuario eligió:', outcome);

      if (outcome === 'accepted') {
        localStorage.setItem('pwaWasInstalled', 'true');
        setIsInstalled(true);
        setCanInstall(false);
      }

      window.deferredPWAPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('❌ PWA: Error al instalar:', error);
      return false;
    }
  };

  const dismiss = () => {
    localStorage.setItem('installBannerDismissedAt', new Date().toISOString());
    setCanInstall(false);
  };

  return {
    canInstall: canInstall && !isInstalled,
    isInstalled,
    install,
    dismiss,
  };
};

// Componente de Banner para usar en Dashboard
export const InstallBanner = () => {
  const { canInstall, install, dismiss } = useInstallPWA();

  if (!canInstall) {
    return null;
  }

  const handleInstall = async () => {
    await install();
  };

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <Download size={20} className="text-white" />
        </div>
        <div className="space-y-0.5 flex-1">
          <p className="text-sm sm:text-base font-semibold text-white">Instalar App</p>
          <p className="text-[11px] sm:text-xs text-white/80">
            Acceso rápido sin navegador
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="bg-white text-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-all shadow-sm"
        >
          Instalar
        </button>
        <button
          onClick={dismiss}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} className="text-white/80" />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
