// src/App.tsx
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { AppRouter } from "./router";
import { useAuthStore } from "./store/authStore";

//  AJUSTA ESTA RUTA a donde realmente está tu settingsStore.ts
// Por tu estructura, probablemente sea algo así:
import { useSettingsStore } from "./pages/Profile/settings/settingsStore";

const MIN_LOADING_TIME = 2000; // ⏱ 1 segundo mínimo de pantalla de carga

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.08) 40%, transparent 70%)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute w-72 h-72 rounded-full blur-[100px] opacity-30"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
          top: "10%",
          left: "-5%",
          animation: "floatOrb1 6s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-56 h-56 rounded-full blur-[80px] opacity-20"
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          bottom: "15%",
          right: "-5%",
          animation: "floatOrb2 7s ease-in-out infinite",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Logo with glow */}
        <div className="relative mb-6" style={{ animation: "fadeUp 0.8s ease-out both" }}>
          <div
            className="absolute inset-0 rounded-[1.8rem] blur-2xl opacity-50"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
              transform: "scale(1.3)",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          />
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[1.8rem] overflow-hidden shadow-2xl ring-1 ring-white/10">
            <img
              src="/icon-192.png"
              alt="BYE Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* App name */}
        <h1
          className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1"
          style={{ animation: "fadeUp 0.8s ease-out 0.15s both" }}
        >
          BYE
        </h1>

        {/* Tagline */}
        <p
          className="text-sm sm:text-base font-medium text-violet-300/80 mb-1"
          style={{ animation: "fadeUp 0.8s ease-out 0.3s both" }}
        >
          Boost Your English
        </p>
        <p
          className="text-xs sm:text-sm text-slate-500 text-center max-w-[260px]"
          style={{ animation: "fadeUp 0.8s ease-out 0.45s both" }}
        >
          Aprende inglés de forma divertida y efectiva
        </p>

        {/* Progress bar with glow */}
        <div
          className="w-56 sm:w-64 mt-10"
          style={{ animation: "fadeUp 0.8s ease-out 0.6s both" }}
        >
          <div className="relative">
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full rounded-full transition-[width] duration-150 relative"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #d946ef, #8b5cf6)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s linear infinite",
                }}
              />
            </div>
            {/* Glow under progress */}
            <div
              className="absolute top-0 h-1.5 rounded-full blur-md opacity-50 transition-[width] duration-150"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: "linear-gradient(90deg, #8b5cf6, #d946ef)",
              }}
            />
          </div>
          <p className="mt-4 text-[11px] sm:text-xs text-slate-500 text-center tracking-wide">
            Preparando tu experiencia...
          </p>
        </div>
      </div>

      {/* Footer */}
      <p
        className="absolute bottom-6 text-[10px] sm:text-[11px] text-slate-600"
        style={{ animation: "fadeUp 0.8s ease-out 0.8s both" }}
      >
        © 2025 Let&apos;s Speak
      </p>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1.3); }
          50% { opacity: 0.6; transform: scale(1.5); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 15px); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  // ✅ NUEVO: init settings (no cambia tu lógica, solo inicializa)
  const initSettings = useSettingsStore((s) => s.init);

  const [isInitializing, setIsInitializing] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

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
        // 1) Mantienes tu checkSession tal cual
        await checkSession();

        // 2) ✅ Después de validar, si aún existe sesión, inicializa settings
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user?.id) {
          // NO bloquea tu loading
          void initSettings(session.user.id);
        }
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = MIN_LOADING_TIME - elapsed;

        if (!isMounted) return;

        if (remaining > 0) {
          setTimeout(() => {
            if (isMounted) setIsInitializing(false);
          }, remaining);
        } else {
          setIsInitializing(false);
        }
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 Auth event:", event);

      if (event === "SIGNED_IN" && session) {
        console.log("✅ Usuario autenticado:", session.user?.email);

        // Mantienes tu validación de is_active
        checkSession().then(async () => {
          // ✅ solo si sigue habiendo sesión después de la validación
          const {
            data: { session: s2 },
          } = await supabase.auth.getSession();

          if (s2?.user?.id) {
            void initSettings(s2.user.id);
          }
        });
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
  }, [checkSession, setAuthenticated, initSettings]);

  if (isInitializing) {
    return <LoadingScreen progress={progress} />;
  }

  return <AppRouter />;
}
