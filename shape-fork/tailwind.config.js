/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Google Sans", "Roboto", "Arial", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "SFMono-Regular", "ui-monospace", "monospace"]
      },
      animation: {
        "slow-spin": "spin 18s linear infinite"
      }
    }
  },
  plugins: []
};
