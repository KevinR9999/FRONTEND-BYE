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
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};