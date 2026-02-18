// src/store/authStore.ts
import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import { updateLastSeen } from "../services/adminService";

interface UserProfile {
  id: string;
  email: string;
  role: 'student' | 'admin';
  full_name?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  initialized: boolean;
  user: UserProfile | null;
  isAdmin: boolean;
  blockedMessage: string | null;
  setAuthenticated: (value: boolean) => void;
  clearBlockedMessage: () => void;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  initialized: false,
  user: null,
  isAdmin: false,
  blockedMessage: null,

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  clearBlockedMessage: () => set({ blockedMessage: null }),

  checkSession: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error obteniendo la sesión:", error.message);
        set({ isAuthenticated: false, initialized: true, user: null, isAdmin: false });
        return;
      }

      const isAuth = !!data.session;

      if (isAuth && data.session?.user) {
        // Obtener el perfil del usuario para verificar su rol y estado
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, role, level, full_name, email, is_active')
          .eq('user_id', data.session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error obteniendo perfil:", profileError);
          set({
            isAuthenticated: isAuth,
            initialized: true,
            user: {
              id: data.session.user.id,
              email: data.session.user.email || '',
              role: 'student'
            },
            isAdmin: false
          });
          return;
        }

        // Verificar si el usuario está deshabilitado
        if (profile && profile.is_active === false) {
          console.warn("Usuario deshabilitado, cerrando sesión...");
          await supabase.auth.signOut();
          set({
            isAuthenticated: false,
            initialized: true,
            user: null,
            isAdmin: false,
            blockedMessage: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.'
          });
          return;
        }

        // Si no existe perfil, crearlo automáticamente
        if (!profile) {
          console.log("Creando perfil para usuario nuevo...");
          const fullNameFromMetadata = data.session.user.user_metadata?.full_name;
          const emailFromAuth = data.session.user.email || '';

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.session.user.id,
              role: 'student',
              full_name: fullNameFromMetadata || emailFromAuth,
              email: emailFromAuth
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creando perfil:", createError);
            set({
              isAuthenticated: isAuth,
              initialized: true,
              user: {
                id: data.session.user.id,
                email: emailFromAuth,
                role: 'student',
                full_name: fullNameFromMetadata
              },
              isAdmin: false
            });
            return;
          }

          const userProfile: UserProfile = {
            id: data.session.user.id,
            email: emailFromAuth,
            role: newProfile.role || 'student',
            full_name: newProfile.full_name || fullNameFromMetadata
          };

          set({
            isAuthenticated: isAuth,
            initialized: true,
            user: userProfile,
            isAdmin: false
          });
          return;
        }

        // Si el perfil no tiene nombre pero los metadatos sí, actualizarlo
        const fullNameFromMetadata = data.session.user.user_metadata?.full_name;
        if (!profile.full_name && fullNameFromMetadata) {
          console.log("Actualizando nombre desde metadatos...");
          await supabase
            .from('profiles')
            .update({ full_name: fullNameFromMetadata })
            .eq('user_id', data.session.user.id);
        }

        const userProfile: UserProfile = {
          id: data.session.user.id,
          email: profile.email || data.session.user.email || '',
          role: profile.role || 'student',
          full_name: profile.full_name || fullNameFromMetadata
        };

        // Actualizar última conexión (fire-and-forget)
        updateLastSeen(data.session.user.id).catch(() => {});

        // Si el perfil no tiene email pero la sesión sí, actualizarlo
        if (!profile.email && data.session.user.email) {
          supabase
            .from('profiles')
            .update({ email: data.session.user.email })
            .eq('user_id', data.session.user.id)
            .then(() => {});
        }

        set({
          isAuthenticated: isAuth,
          initialized: true,
          user: userProfile,
          isAdmin: userProfile.role === 'admin'
        });
      } else {
        set({ isAuthenticated: false, initialized: true, user: null, isAdmin: false });
      }
    } catch (error) {
      console.error("Error en checkSession:", error);
      set({ isAuthenticated: false, initialized: true, user: null, isAdmin: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ isAuthenticated: false, user: null, isAdmin: false });
  },
}));
