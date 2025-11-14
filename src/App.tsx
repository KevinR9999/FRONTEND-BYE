// src/App.tsx
import { useEffect } from "react";
import { AppRouter } from "./router";
import { useAuthStore } from "./store/authStore";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    checkSession();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔐 Auth event:", event);
        
        if (event === "SIGNED_IN" && session) {
          console.log("✅ Usuario autenticado:", session.user.email);
          setAuthenticated(true);
        }
        
        if (event === "SIGNED_OUT") {
          setAuthenticated(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [checkSession, setAuthenticated]);

  return <AppRouter />;
}