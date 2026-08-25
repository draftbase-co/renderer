import { readFileSync, writeFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const out = `// Generated from styles.css by scripts/generate-css-text.mjs — do not edit directly.
export const CSS_TEXT = ${JSON.stringify(css)};
`;

writeFileSync(new URL("../src/cssText.ts", import.meta.url), out);
