module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        vintage: {
          paper: '#F5EFE6',
          dark: '#3E3E3E',
          brown: '#8B7355',
          red: '#C84B31',
          border: '#D4C4B0',
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      }
    }
  },
  plugins: []
};
