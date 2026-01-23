import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

// Detectar si es iOS/Safari
const isIOS = () => {
  const ua = window.navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIOSStandalone = (window.navigator as any).standalone === true;

  // Detectar Safari en iOS (no Chrome u otros navegadores)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);

  return isIOSDevice && !isIOSStandalone && isSafari;
};

// Hook para usar la lógica de instalación en cualquier componente
export const useInstallPWA = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada (modo standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    if (isStandalone) {
      // App instalada: guardar flag y ocultar banner
      localStorage.setItem('pwaWasInstalled', 'true');
      setIsInstalled(true);
      console.log('✅ PWA: App detectada como instalada (modo standalone)');
      return;
    }

    // Si estaba instalada pero ahora no (usuario la desinstaló), limpiar TODOS los flags
    const wasInstalled = localStorage.getItem('pwaWasInstalled') === 'true';
    if (wasInstalled) {
      console.log('🔄 PWA: App fue desinstalada, mostrando banner nuevamente');
      localStorage.removeItem('pwaWasInstalled');
      localStorage.removeItem('installBannerDismissedAt');
      // Continuar para mostrar el banner de nuevo
    }

    // Verificar si el usuario ya descartó el banner (solo si NO fue desinstalada)
    if (!wasInstalled) {
      const dismissedAt = localStorage.getItem('installBannerDismissedAt');
      if (dismissedAt) {
        const dismissDate = new Date(dismissedAt);
        const now = new Date();
        const daysPassed = (now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysPassed < 3) {
          console.log(`⏸️ PWA: Banner descartado hace ${Math.floor(daysPassed)} días, esperando 3 días`);
          return;
        }
        localStorage.removeItem('installBannerDismissedAt');
      }
    }

    // Detectar iOS
    const isiOS = isIOS();
    setIsIOSDevice(isiOS);

    if (isiOS) {
      // En iOS, mostrar siempre el banner con instrucciones
      console.log('✅ PWA: Dispositivo iOS detectado');
      setCanInstall(true);
      return;
    }

    // Para Android/Chrome: Verificar si ya hay un prompt disponible
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
    // En iOS, no hacer nada (solo mostrar instrucciones)
    if (isIOSDevice) {
      return false;
    }

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
    isIOSDevice,
    install,
    dismiss,
  };
};

// Componente de Banner para usar en Dashboard
export const InstallBanner = () => {
  const { canInstall, isIOSDevice, install, dismiss } = useInstallPWA();

  if (!canInstall) {
    return null;
  }

  const handleInstall = async () => {
    await install();
  };

  // Banner para iOS con instrucciones
  if (isIOSDevice) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download size={20} className="text-white" />
            </div>
            <div className="space-y-0.5 flex-1">
              <p className="text-sm sm:text-base font-semibold text-white">Instalar App</p>
              <p className="text-[11px] sm:text-xs text-white/80">
                Acceso rápido desde tu pantalla de inicio
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} className="text-white/80" />
          </button>
        </div>

        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex items-start gap-2 mb-2">
            <div className="bg-white/20 rounded-lg p-1.5 flex-shrink-0">
              <Share size={16} className="text-white" />
            </div>
            <div className="text-[11px] sm:text-xs text-white/90 leading-relaxed">
              <strong className="block mb-1">Para instalar:</strong>
              1. Toca el botón <strong>Compartir</strong> <Share className="inline w-3 h-3" /> en la barra inferior de Safari<br />
              2. Selecciona <strong>"Agregar a pantalla de inicio"</strong><br />
              3. Confirma tocando <strong>"Agregar"</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner para Android/Chrome con botón automático
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
