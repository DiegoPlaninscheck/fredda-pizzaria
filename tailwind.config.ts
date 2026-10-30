import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7f3',
          100: '#dbeee2',
          200: '#b8ddc7',
          300: '#8bc4a5',
          400: '#5aa47f',
          500: '#3d8563',
          600: '#2b6b4d',
          700: '#1f5439',
          800: '#17402c',
          900: '#0f231a',
        },
        // Tons das artes da marca (texto creme sobre o verde-escuro)
        creme: {
          50: '#fbf8f0',
          100: '#f6f0de',
          200: '#e9dcb4',
          300: '#d8ceb0',
          400: '#b9b096',
          500: '#8f8670',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
