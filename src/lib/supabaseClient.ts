// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en tu .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // ✅ Usar localStorage en lugar de cookies (evita la advertencia de Chrome)
    storage: window.localStorage,
    
    // ✅ Mantener la sesión activa
    persistSession: true,
    
    // ✅ Refrescar el token automáticamente
    autoRefreshToken: true,
    
    // ✅ Detectar sesión en la URL (para OAuth)
    detectSessionInUrl: true,
    
    // ✅ Clave personalizada para el storage
    storageKey: 'bye-auth-token',
    
    // ✅ Comportamiento del flujo de autenticación
    flowType: 'pkce', // Más seguro que 'implicit'
  },
  
  // ✅ Headers globales para identificar tu app
  global: {
    headers: {
      'x-application-name': 'BYE-App',
    },
  },
  
  // ✅ Configuración de realtime (opcional, si usas subscriptions)
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
