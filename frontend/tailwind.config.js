/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        'subtle-border': 'var(--border-subtle)',
        cream: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        accent: {
          DEFAULT: 'var(--accent-main)',
          light: 'var(--accent-light)',
          dark: 'var(--accent-dark)'
        },
        // Data viz palette (slate, violet, amber, coral, teal)
        data: {
          slate: '#7C8DA6',    // Noise
          violet: '#B48CF2',   // Sensor Failure
          amber: '#F2B84B',    // Isolated Incident / Prepare
          coral: '#FF6B5E',    // Cascade / Critical
          teal: '#2DD4BF',     // Verified / Online
          blue: '#5AA9E6',     // Watch
          orange: '#F28C38',   // Alert
          red: '#E5484D',      // Escalate
          green: '#3FB950',    // Approved / Normal
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '8px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      }
    },
  },
  plugins: [],
}
