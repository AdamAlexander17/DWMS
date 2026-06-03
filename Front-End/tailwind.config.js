/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg:          '#0d1117',
          hover:       '#161b22',
          border:      '#21262d',
          text:        '#8b949e',
          'text-active': '#0d1117',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark:    '#d97706',
          light:   '#fde68a',
          muted:   '#fef3c7',
        },
        surface: '#ffffff',
        bg:      '#f0f2f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgba(0,0,0,.07), 0 1px 2px -1px rgba(0,0,0,.05)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,.10)',
      },
    },
  },
  plugins: [],
}

