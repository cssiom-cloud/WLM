/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          mid: '#12263A'
        },
        gold: '#C4A35A',
        ivory: '#F7F5F0'
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sarabun: ['Sarabun', 'Tahoma', 'sans-serif']
      },
      boxShadow: {
        glass: '0 18px 48px rgba(11, 31, 58, 0.08)'
      }
    }
  },
  plugins: []
};
