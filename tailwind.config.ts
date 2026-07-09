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
      },
    },
  },
  plugins: [],
}
export default config
