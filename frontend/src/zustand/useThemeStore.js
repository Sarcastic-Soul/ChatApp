import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ACCENT } from "../theme";

const useThemeStore = create(
    persist(
        (set) => ({
            primaryColor: DEFAULT_ACCENT,
            setPrimaryColor: (color) => set({ primaryColor: color }),
        }),
        {
            name: "theme-storage",
            // v0 stored Mantine color names like "teal"; reset to the new accents
            version: 1,
            migrate: () => ({ primaryColor: DEFAULT_ACCENT }),
        },
    ),
);

export default useThemeStore;
