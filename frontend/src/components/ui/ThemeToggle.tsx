'use client';

import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Toggles the `dark` class on <html> and persists the choice to localStorage.
 * The initial class is set by the inline script in layout.tsx (no flash).
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setIsDark(next);
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`group transition-all duration-200 hover:scale-110 active:scale-90 ${
        className ??
        'h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
      }`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-500 group-hover:-rotate-12" />
      )}
    </button>
  );
};

export default ThemeToggle;
