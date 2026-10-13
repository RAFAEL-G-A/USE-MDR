import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["app", "components", "lib", "public"];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".mjs", ".svg", ".ts", ".tsx"]);
const forbidden = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /OTP_PEPPER/,
  /FINANCIAL_CRON_SECRET/,
  /RESEND_API_KEY/,
  /ADMIN_EMAIL/,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PASSWORD|PEPPER)/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

const files = (await Promise.all(roots.map(filesIn)))
  .flat()
  .filter((path) => textExtensions.has(extname(path).toLowerCase()));
const findings = [];

for (const path of files) {
  const content = await readFile(path, "utf8");
  if (forbidden.some((pattern) => pattern.test(content))) findings.push(relative(process.cwd(), path));
}

if (findings.length) {
  for (const path of findings) console.error(`Possível secret encontrado em caminho ${path}`);
  process.exitCode = 1;
} else {
  console.log(`Scanner preventivo concluído: ${files.length} arquivos públicos verificados.`);
}
