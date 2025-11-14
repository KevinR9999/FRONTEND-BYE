// src/services/authService.ts
import { supabase } from "../lib/supabaseClient";

export const authService = {
  register: async (email: string, password: string, fullName: string) => {
    // Crear usuario en Supabase Auth con email/password
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // 👇 IMPORTANTE: de momento NO tocamos la tabla profiles aquí
    // La crearemos luego con trigger, o la usaremos solo cuando ya haya sesión.

    return data;
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data; // contiene session y user
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  loginWithProvider: async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider
    });

    if (error) {
      throw new Error(error.message);
    }
  },
};