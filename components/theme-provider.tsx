'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme } from 'next-themes'
import { THEMES, CUSTOM_THEME_KEY, type ThemeDefinition } from '@/lib/themes'

interface CustomThemeContextValue {
  themes: ThemeDefinition[];
  selectedIndex: number;
  setThemeByIndex: (index: number) => void;
}

const CustomThemeContext = React.createContext<CustomThemeContextValue | null>(null);

function CustomThemeManager({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(CUSTOM_THEME_KEY);
    const idx = stored !== null ? parseInt(stored, 10) : 0;
    return isNaN(idx) || idx < 0 || idx >= THEMES.length ? 0 : idx;
  });

  // Apply stored theme on mount
  React.useEffect(() => {
    const t = THEMES[selectedIndex];
    setTheme(t.colorScheme);
    document.documentElement.setAttribute('data-theme', t.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setThemeByIndex = React.useCallback((index: number) => {
    const t = THEMES[index];
    setSelectedIndex(index);
    setTheme(t.colorScheme);
    document.documentElement.setAttribute('data-theme', t.id);
    localStorage.setItem(CUSTOM_THEME_KEY, String(index));
  }, [setTheme]);

  return (
    <CustomThemeContext.Provider value={{ themes: THEMES, selectedIndex, setThemeByIndex }}>
      {children}
    </CustomThemeContext.Provider>
  );
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <CustomThemeManager>{children}</CustomThemeManager>
    </NextThemesProvider>
  );
}

export function useCustomTheme(): CustomThemeContextValue {
  const ctx = React.useContext(CustomThemeContext);
  if (!ctx) throw new Error('useCustomTheme must be used within ThemeProvider');
  return ctx;
}
