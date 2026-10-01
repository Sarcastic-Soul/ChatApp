import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ACCENT, type AccentName } from "../theme";

interface ThemeState {
    primaryColor: AccentName;
    setPrimaryColor: (color: AccentName) => void;
}

const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            primaryColor: DEFAULT_ACCENT,
            setPrimaryColor: (color) => set({ primaryColor: color }),
        }),
        {
            name: "theme-storage",
            // Save only the color (JSON drops the setter anyway)
            partialize: (state) => ({ primaryColor: state.primaryColor }),
            // v0 stored Mantine color names like "teal"; reset to the new accents
            version: 1,
            migrate: () => ({ primaryColor: DEFAULT_ACCENT }),
        },
    ),
);

export default useThemeStore;
