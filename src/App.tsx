import React from 'react';
import { useTheme } from './hooks/useTheme';

function App() {
  const theme = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
        color: isDark ? '#e5e7eb' : '#374151',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: isDark
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'linear-gradient(135deg, #818cf8, #a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          fontSize: 28,
          color: '#fff',
          fontWeight: 700,
        }}
      >
        O
      </div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          margin: '0 0 8px 0',
          letterSpacing: '-0.02em',
        }}
      >
        Welcome to OneDay
      </h1>
      <p
        style={{
          fontSize: 15,
          color: isDark ? '#9ca3af' : '#6b7280',
          margin: 0,
        }}
      >
        Start building something amazing.
      </p>
    </div>
  );
}

export default App;
