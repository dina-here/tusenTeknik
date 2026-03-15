/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Helvetica", "Arial", "sans-serif"],
      },
      colors: {
        millet: {
          accent:      "#F3C63F",
          interactive: "#0170B9",
          muted:       "#4E4E4E",
          surface:     "#F5F5F5",
          border:      "#DDDDDD",
          text:        "#1e1e1e",
        },
      },
      boxShadow: {
        millet: "0 0 4px rgba(0,0,0,.15)",
      },
      maxWidth: {
        millet: "1080px",
      },
    },
  },
  plugins: [],
};
