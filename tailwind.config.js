/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        sans: ['Noto Sans KR', 'sans-serif'],
      },
      colors: {
        accent: '#ff4d1c',
        cream: '#f0ede4',
        dark: '#0a0a0a',
      },
    },
  },
  plugins: [],
}
