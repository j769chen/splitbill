/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#E6F7F5",
          100: "#B3E8E2",
          200: "#80D9CF",
          300: "#4DCABC",
          400: "#26BFA9",
          500: "#1B998B",
          600: "#177D72",
          700: "#126159",
          800: "#0D4540",
          900: "#082927",
        },
        accent: {
          500: "#FF6B6B",
          600: "#EE5A5A",
        },
        success: "#4CAF50",
        warning: "#FF9800",
        danger: "#F44336",
      },
    },
  },
  plugins: [],
};
