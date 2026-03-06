/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      spacing: {
        "app-header-compact": "3.5rem",
        "app-header": "4rem",
        "app-header-large": "7rem",
        "app-header-large-md": "8rem",
      },
      zIndex: {
        header: "40",
      },
    },
  },
  plugins: [],
};
