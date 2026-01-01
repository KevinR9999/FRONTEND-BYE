import { useEffect, useState } from 'react';

// Tipo para el evento de instalación
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;

    // Si ya está instalada, no hacer nada
    if (isInstalled) {
      return;
    }

    // Verificar si el usuario ya rechazó el banner antes
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed === 'true') {
      return;
    }

    // Escuchar el evento de instalación
    const handler = (e: Event) => {
      // Prevenir que Chrome muestre su propio prompt automático
      e.preventDefault();
      
      // Guardar el evento para usarlo después
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar nuestro banner personalizado después de 3 segundos
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar el prompt de instalación nativo
    await deferredPrompt.prompt();

    // Esperar a que el usuario responda
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);

    // Limpiar el prompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    
    // Guardar en localStorage que el usuario rechazó
    localStorage.setItem('installPromptDismissed', 'true');
  };

  // No mostrar nada si no hay prompt disponible
  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-2xl p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-white/80 hover:text-white transition"
        aria-label="Cerrar"
      >
        ✕
      </button>

      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            BYE
          </span>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">¡Instala BYE!</h3>
          <p className="text-sm text-white/90 mb-3">
            Accede más rápido, recibe notificaciones y úsala sin conexión
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-white text-purple-600 font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition shadow-md"
            >
              Instalar ahora
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-white/90 hover:text-white transition font-medium"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}