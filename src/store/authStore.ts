// src/store/authStore.ts
import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";

interface AuthState {
  isAuthenticated: boolean;
  initialized: boolean;
  setAuthenticated: (value: boolean) => void;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  initialized: false,

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  checkSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error obteniendo la sesión:", error.message);
      set({ isAuthenticated: false, initialized: true });
      return;
    }

    set({ isAuthenticated: !!data.session, initialized: true });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ isAuthenticated: false });
  },
}));
