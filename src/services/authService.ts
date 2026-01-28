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

    // Crear o actualizar perfil del usuario con el nombre completo
    if (data.user) {
      // Primero intentamos insertar
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          level: 'A1',
          xp_total: 0,
          streak_days: 0,
          lessons_completed: 0,
          is_private: false,
          diagnostic_completed: false,
          role: 'student'
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Error creando/actualizando perfil:', profileError);
        // Si falla el upsert, intentamos solo actualizar el nombre
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ full_name: fullName, email: email })
          .eq('user_id', data.user.id);

        if (updateError) {
          console.error('Error actualizando nombre:', updateError);
        }
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

    // Verificar si el usuario está activo
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error verificando estado del usuario:', profileError);
      }

      // Si el usuario está deshabilitado, cerrar sesión y lanzar error
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta ha sido deshabilitada. Contacta al administrador.');
      }
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