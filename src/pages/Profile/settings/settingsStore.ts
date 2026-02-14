import { create } from "zustand";
import type { UserSettings } from "./settingsService";
import { ensureMySettings, upsertMySettings } from "./settingsService";
import { applyTheme } from "./theme";

type SettingsState = {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  init: (userId: string) => Promise<void>;
  update: (patch: Partial<UserSettings>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  init: async (userId) => {
    set({ loading: true, error: null });
    try {
      const data = await ensureMySettings(userId);
      set({ settings: data, loading: false });
      applyTheme(data.theme);
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Error cargando settings" });
    }
  },

  update: async (patch) => {
    const current = get().settings;
    if (!current) return;

    const optimistic = { ...current, ...patch };
    set({ settings: optimistic, error: null });

    if (patch.theme) applyTheme(patch.theme as any);

    try {
      const saved = await upsertMySettings(optimistic);
      set({ settings: saved });
    } catch (e: any) {
      set({ settings: current, error: e?.message ?? "Error guardando settings" });
      applyTheme(current.theme);
    }
  },
}));
