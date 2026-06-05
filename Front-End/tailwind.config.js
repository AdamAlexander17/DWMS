/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg:            '#ffffff',
          hover:         '#f1f5f9',
          border:        '#e2e8f0',
          text:          '#64748b',
          'text-active': '#ffffff',
        },
        accent: {
          DEFAULT: '#2563eb',
          dark:    '#1d4ed8',
          light:   '#93c5fd',
          muted:   '#eff6ff',
        },
        surface: '#ffffff',
        bg:      '#f1f5f9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:         '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-hover': '0 4px 12px 0 rgba(37,99,235,.12)',
      },
    },
  },
  plugins: [],
}

