/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'light-purple': '#d8b4fe',
        'dark-purple': '#a78bfa',
      },
    },
  },
  plugins: [],
};

