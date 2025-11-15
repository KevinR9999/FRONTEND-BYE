// src/App.tsx
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { AppRouter } from "./router";
import { useAuthStore } from "./store/authStore";

const MIN_LOADING_TIME = 1000; // ⏱ 1 segundo mínimo de pantalla de carga

// Pantalla de carga con Tailwind (responsive + barra con progreso)
function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div
        className="
        w-full 
        max-w-sm sm:max-w-md 
        bg-white 
        rounded-[2.5rem] 
        shadow-2xl 
        px-6 sm:px-8 
        py-6 sm:py-8 
        flex flex-col 
        justify-between 
        h-[80vh] 
        max-h-[720px]
      "
      >
        {/* Contenido principal */}
        <div className="flex flex-col items-center mt-2 sm:mt-4">
          {/* Logo */}
          <div
            className="
            w-24 h-24 
            sm:w-32 sm:h-32 
            rounded-[2rem] 
            bg-gradient-to-br from-violet-500 to-fuchsia-500 
            shadow-xl 
            flex items-center justify-center 
            mb-6 sm:mb-8
          "
          >
            <span className="text-3xl sm:text-4xl font-bold text-white">
              LS
            </span>
          </div>

          {/* Títulos */}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 text-center">
            Boost Your English
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 text-center max-w-xs sm:max-w-sm">
            Aprende inglés de forma divertida y efectiva
          </p>

          {/* Barra de progreso que se llena hasta el 100% */}
          <div className="w-full mt-8 sm:mt-10">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-100"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] sm:text-xs text-slate-400 text-center">
              Preparando tu experiencia...
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] sm:text-[11px] text-slate-400 text-center mt-4">
          © 2024 Let&apos;s Speak
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const [isInitializing, setIsInitializing] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    // 🔹 Intervalo para actualizar la barra de 0 → 100% en MIN_LOADING_TIME
    const progressInterval = window.setInterval(() => {
      if (!isMounted) return;

      const elapsed = Date.now() - startTime;
      const percentage = Math.min((elapsed / MIN_LOADING_TIME) * 100, 100);
      setProgress(percentage);

      if (percentage >= 100) {
        window.clearInterval(progressInterval);
      }
    }, 50);

    const init = async () => {
      try {
        // Comprueba la sesión (como antes)
        await checkSession();
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = MIN_LOADING_TIME - elapsed;

        if (!isMounted) return;

        if (remaining > 0) {
          // Espera el tiempo restante para llegar al mínimo
          setTimeout(() => {
            if (isMounted) {
              setIsInitializing(false);
            }
          }, remaining);
        } else {
          // Ya pasó suficiente tiempo
          setIsInitializing(false);
        }
      }
    };

    init();

    // Escuchar cambios de autenticación (igual que antes)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔐 Auth event:", event);

      if (event === "SIGNED_IN" && session) {
        console.log("✅ Usuario autenticado:", session.user?.email);
        setAuthenticated(true);
      }

      if (event === "SIGNED_OUT") {
        setAuthenticated(false);
      }
    });

    return () => {
      isMounted = false;
      window.clearInterval(progressInterval);
      subscription.unsubscribe();
    };
  }, [checkSession, setAuthenticated]);

  // 🔸 Mientras se inicializa (con tiempo mínimo), mostramos la pantalla de carga
  if (isInitializing) {
    return <LoadingScreen progress={progress} />;
  }

  // 🔸 Después de eso, se renderiza la app normal
  return <AppRouter />;
}
