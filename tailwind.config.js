/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0E0F0E',
        canvas: '#F4F4F2',
        surface: '#F7F7F5',
        forest: '#1C4640',
        forestdeep: '#12302C',
        lime: '#D6F26E',
        limehover: '#E2F88A',
        muted: '#62675F',
        cream: '#E9E7DA',
        danger: '#C0362C',
        success: '#1F7A4D',
        caution: '#9A5B05',
      },
      fontFamily: {
        display: ['"Inter Tight"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,20,0.04), 0 12px 32px -12px rgba(16,24,20,0.10)',
        float: '0 30px 60px -20px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
