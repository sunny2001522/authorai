/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          light: '#f3e5ab',
          DEFAULT: '#d4af37',
          dark: '#aa8a2e',
        },
        dark: {
          DEFAULT: '#0a0806',
          surface: '#111111',
          card: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
}
