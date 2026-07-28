/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans:  ['Outfit', 'system-ui', 'sans-serif'],
        poppins: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#EBF9F6',
          100: '#C0EDE6',
          200: '#7ED9CA',
          300: '#3CBFA8',
          400: '#1BA38C',
          500: '#158470',
          600: '#116B5A',
          700: '#0D5245',
          800: '#083D34',
          900: '#052E28',
          950: '#031F1B',
        },
      },
      keyframes: {
        modalIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        modalIn: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        fadeIn:  'fadeIn 0.3s ease',
      },
    },
  },
  plugins: [],
};
