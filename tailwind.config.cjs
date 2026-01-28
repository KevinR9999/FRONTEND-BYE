/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      //  AGREGADO: Animación para el banner de instalación
      keyframes: {
        'slide-up': {
          '0%': {
            transform: 'translateY(100%)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1'
          },
        },
        'radioScale': {
          '0%': {
            transform: 'translate(-50%, -50%) scale(0)',
          },
          '100%': {
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'wordPlaced': {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '0',
          },
          '50%': {
            transform: 'scale(1.1)',
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1',
          },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out',
        'radioScale': 'radioScale 0.2s ease-out forwards',
        'wordPlaced': 'wordPlaced 0.3s ease-out',
      },
    },
  },
  plugins: [],
};