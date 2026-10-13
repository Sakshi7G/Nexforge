import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'full' | 'icon' | 'compact';
  showLabel?: boolean;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'compact',
  showLabel = false,
  size = 15,
  style,
  className
}) => {
  const { theme, toggleTheme } = useTheme();

  const isLight = theme === 'light';

  if (variant === 'full' || showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className={className || 'btn-secondary'}
        style={{
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          ...style
        }}
        title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
      >
        {isLight ? <Moon size={size} color="var(--accent-primary)" /> : <Sun size={size} color="#f59e0b" />}
        <span style={{ fontSize: '12px', fontWeight: 600 }}>
          {isLight ? 'Dark Mode' : 'Light Mode'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={className || 'btn-secondary'}
      style={{
        padding: '5px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        ...style
      }}
      title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
    >
      {isLight ? <Moon size={size} color="var(--accent-primary)" /> : <Sun size={size} color="#f59e0b" />}
    </button>
  );
};
