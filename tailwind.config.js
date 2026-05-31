/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./services.html",
    "./industries.html",
    "./contact.html",
    "./about.html",
    "./privacy-policy.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'trust-navy': '#0B2545',
        'crimson-burgundy': '#7A1C28',
        'slate-tint': '#F8FAFC',
        'variant-red': '#5C151E',
        'variant-blue': '#102F54',
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'asia-map': "url('/asia-map.svg')",
      }
    },
  },
  plugins: [],
}
