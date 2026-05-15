/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Lifted dark surfaces (~15 lightness points up from original) ──
        "surface-container":         "#1e2820",
        "surface":                   "#141f16",
        "surface-dim":               "#141f16",
        "background":                "#141f16",
        "surface-container-lowest":  "#0f1710",
        "surface-container-low":     "#192119",
        "surface-container-high":    "#242e25",
        "surface-container-highest": "#2b3530",
        "surface-bright":            "#303d32",
        "surface-variant":           "#2b3530",

        // ── Accents — unchanged ──
        "primary":                   "#bd9dff",
        "primary-fixed":             "#b28cfe",
        "primary-fixed-dim":         "#a47fef",
        "primary-dim":               "#af89fb",
        "on-primary":                "#3b0a82",
        "on-primary-fixed":          "#000000",
        "on-primary-fixed-variant":  "#390480",
        "on-primary-container":      "#2e006c",
        "primary-container":         "#b28cfe",
        "inverse-primary":           "#6e49b6",
        "surface-tint":              "#bd9dff",

        "secondary":                 "#69f6b8",
        "secondary-dim":             "#58e7ab",
        "secondary-container":       "#006c49",
        "secondary-fixed":           "#69f6b8",
        "secondary-fixed-dim":       "#58e7ab",
        "on-secondary":              "#005a3c",
        "on-secondary-container":    "#e1ffec",
        "on-secondary-fixed":        "#00452d",
        "on-secondary-fixed-variant":"#006544",

        "tertiary":                  "#e7fff3",
        "tertiary-container":        "#b8f9de",
        "tertiary-fixed":            "#b8f9de",
        "tertiary-fixed-dim":        "#aaead0",
        "tertiary-dim":              "#9ddcc2",
        "on-tertiary":               "#2c6a55",
        "on-tertiary-container":     "#22614d",
        "on-tertiary-fixed":         "#074e3b",
        "on-tertiary-fixed-variant": "#2e6b57",

        // ── Text ──
        "on-surface":                "#d8e8d6",
        "on-surface-variant":        "#b0b8af",
        "on-background":             "#d8e8d6",
        "inverse-surface":           "#f5fbf3",
        "inverse-on-surface":        "#515751",

        // ── Outline ──
        "outline":                   "#7a807a",
        "outline-variant":           "#4a514b",

        // ── Error ──
        "error":                     "#ff6e84",
        "error-dim":                 "#d73357",
        "error-container":           "#a70138",
        "on-error":                  "#490013",
        "on-error-container":        "#ffb2b9",
      },
    },
  },
  plugins: [],
}
