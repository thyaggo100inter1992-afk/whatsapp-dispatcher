/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7f0',
          100: '#c2ead9',
          200: '#9adcc1',
          300: '#72cda8',
          400: '#4fc094',
          500: '#2bb381',
          600: '#259e71',
          700: '#1d875f',
          800: '#16714d',
          900: '#0d4b33',
        },
        dark: {
          50: '#f0f4f3',
          100: '#d9e3e0',
          200: '#b3c7c1',
          300: '#8caba2',
          400: '#669083',
          500: '#407464',
          600: '#335d50',
          700: '#26463c',
          800: '#1a2f28',
          900: '#0d1814',
        },
      },
    },
  },
  plugins: [],
}


