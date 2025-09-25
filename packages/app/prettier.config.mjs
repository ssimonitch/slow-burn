/** @type {import("prettier").Config} */
const config = {
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  tabWidth: 2,
  semi: true,
  printWidth: 120,
  bracketSpacing: true,
  endOfLine: 'auto',
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
