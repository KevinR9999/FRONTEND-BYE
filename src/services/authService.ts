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

    // Crear perfil del usuario con el nombre completo
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          level: 'A1',
          xp_total: 0,
          streak_days: 0,
          lessons_completed: 0,
          is_private: false,
          diagnostic_completed: false,
          role: 'user'
        });

      if (profileError) {
        console.error('Error creando perfil:', profileError);
        // No lanzamos error aquí porque el usuario ya se creó en auth
        // El perfil se puede crear después con el trigger o en el login
      }
    }

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

  // ✅ NUEVO: Solicitar recuperación de contraseña
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  // ✅ NUEVO: Actualizar contraseña
  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  },
};