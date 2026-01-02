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
    // 1️⃣ Detectar si ya está instalada
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;

    if (isInstalled) {
      console.log('✅ App ya está instalada, no mostrar banner');
      return;
    }

    // 2️⃣ Verificar si el usuario eligió "No volver a mostrar"
    const neverShowAgain = localStorage.getItem('installPromptNeverShow');
    if (neverShowAgain === 'true') {
      console.log('🚫 Usuario eligió "No volver a mostrar"');
      return;
    }

    // 3️⃣ Verificar si el usuario eligió "Recordarme después" (esperar 3 días)
    const remindLater = localStorage.getItem('installPromptRemindLater');
    if (remindLater) {
      const remindTime = parseInt(remindLater);
      const now = Date.now();
      const daysPassed = (now - remindTime) / (1000 * 60 * 60 * 24);

      if (daysPassed < 3) {
        console.log(`⏰ Recordar después en ${Math.ceil(3 - daysPassed)} días`);
        return;
      } else {
        // Ya pasaron 3 días, limpiar el flag
        localStorage.removeItem('installPromptRemindLater');
      }
    }

    // 4️⃣ Escuchar el evento de instalación
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Mostrar banner después de 3 segundos
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // ✅ Botón "Instalar ahora"
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);

      if (outcome === 'accepted') {
        // Si aceptó, nunca volver a mostrar
        localStorage.setItem('installPromptNeverShow', 'true');
      }

      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error al instalar:', error);
    }
  };

  // 🚫 Botón "No volver a mostrar"
  const handleNeverShow = () => {
    localStorage.setItem('installPromptNeverShow', 'true');
    setShowInstallPrompt(false);
    console.log('🚫 Usuario eligió no volver a mostrar');
  };

  // ⏰ Botón "Recordarme después"
  const handleRemindLater = () => {
    const now = Date.now();
    localStorage.setItem('installPromptRemindLater', now.toString());
    setShowInstallPrompt(false);
    console.log('⏰ Recordar en 3 días');
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-2xl p-4 z-50 animate-slide-up">
      <button
        onClick={handleNeverShow}
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

          {/* Botones */}
          <div className="flex flex-col gap-2">
            {/* Botón principal: Instalar */}
            <button
              onClick={handleInstallClick}
              className="w-full bg-white text-purple-600 font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition shadow-md"
            >
              Instalar ahora
            </button>

            {/* Botones secundarios */}
            <div className="flex gap-2">
              <button
                onClick={handleRemindLater}
                className="flex-1 text-white/90 hover:text-white transition font-medium text-sm py-1"
              >
                Recordarme después
              </button>
              <button
                onClick={handleNeverShow}
                className="flex-1 text-white/70 hover:text-white/90 transition font-medium text-sm py-1"
              >
                No volver a mostrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}