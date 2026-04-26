export interface ThemeDefinition {
  /** Value stored in data-theme attribute (empty string = no override) */
  id: string;
  label: string;
  /** next-themes color scheme to apply */
  colorScheme: 'light' | 'dark' | 'system';
}

export const THEMES: ThemeDefinition[] = [
  { id: '',              label: '☀️ Light',         colorScheme: 'light'  },
  { id: '',              label: '🌙 Dark',          colorScheme: 'dark'   },
  { id: 'high-contrast', label: '⬛ High Contrast', colorScheme: 'light'  },
  { id: 'ocean',         label: '🌊 Ocean',         colorScheme: 'light'  },
];

/** localStorage key for persisting the selected theme index */
export const CUSTOM_THEME_KEY = 'ajo-custom-theme';
