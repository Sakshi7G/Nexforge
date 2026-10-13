import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('nexforge_theme') as ThemeMode;
    return saved || 'dark'; // Default to rich dark mode
  });

  useEffect(() => {
    localStorage.setItem('nexforge_theme', theme);
    const root = document.documentElement;

    if (theme === 'dark') {
      root.style.setProperty('--bg-primary', '#0a0d14');
      root.style.setProperty('--bg-secondary', '#121824');
      root.style.setProperty('--bg-tertiary', '#1a2234');
      root.style.setProperty('--bg-hover', '#242f47');
      root.style.setProperty('--bg-active', '#2e3c5a');
      root.style.setProperty('--glass-bg', 'rgba(18, 24, 36, 0.85)');
      root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--glass-border-light', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--text-primary', '#f8fafc');
      root.style.setProperty('--text-secondary', '#94a3b8');
      root.style.setProperty('--text-muted', '#64748b');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--accent-primary', '#6366f1');
      root.style.setProperty('--accent-primary-hover', '#4f46e5');
      root.style.setProperty('--accent-secondary', '#06b6d4');
      root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)');
      root.style.setProperty('--accent-gradient-glow', '0 0 20px rgba(99, 102, 241, 0.35)');
    } else {
      root.style.setProperty('--bg-primary', '#f8fafc');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-tertiary', '#f1f5f9');
      root.style.setProperty('--bg-hover', '#e2e8f0');
      root.style.setProperty('--bg-active', '#e0e7ff');
      root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.9)');
      root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--glass-border-light', 'rgba(0, 0, 0, 0.12)');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--text-muted', '#64748b');
      root.style.setProperty('--border-color', '#e2e8f0');
      root.style.setProperty('--accent-primary', '#4f46e5');
      root.style.setProperty('--accent-primary-hover', '#4338ca');
      root.style.setProperty('--accent-secondary', '#0891b2');
      root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)');
      root.style.setProperty('--accent-gradient-glow', '0 4px 20px rgba(79, 70, 229, 0.2)');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
