import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ["src", "supabase/functions"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".sql", ".toml", ".css"]);

const SUSPICIOUS_TOKENS = [
  "Ã¡",
  "Ã¢",
  "Ã£",
  "Ã¤",
  "Ã©",
  "Ãª",
  "Ã­",
  "Ã³",
  "Ã´",
  "Ãµ",
  "Ãº",
  "Ã§",
  "Ã",
  "Ã‰",
  "Ã“",
  "Ãš",
  "Ã‡",
  "Ãƒ",
  "Â©",
  "Â ",
  "\uFFFD",
];

const findings = [];

const shouldScanFile = (filePath) => EXTENSIONS.has(path.extname(filePath).toLowerCase());

const getLineAndColumn = (content, index) => {
  const before = content.slice(0, index);
  const line = before.split("\n").length;
  const lineStart = before.lastIndexOf("\n");
  const column = index - lineStart;
  return { line, column };
};

const scanFile = async (filePath) => {
  const content = await fs.readFile(filePath, "utf8");

  for (const token of SUSPICIOUS_TOKENS) {
    const index = content.indexOf(token);
    if (index === -1) continue;

    const { line, column } = getLineAndColumn(content, index);
    const excerpt = content.split("\n")[line - 1]?.trim() || "";
    findings.push({
      filePath,
      token,
      line,
      column,
      excerpt,
    });
  }
};

const walk = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!shouldScanFile(fullPath)) continue;
    await scanFile(fullPath);
  }
};

for (const relativeDir of TARGET_DIRS) {
  const fullDir = path.join(ROOT_DIR, relativeDir);
  try {
    await walk(fullDir);
  } catch {
    // Ignore missing directories in edge scenarios
  }
}

if (findings.length > 0) {
  console.error("[check:encoding] Possivel texto com codificacao quebrada encontrado:");
  for (const item of findings) {
    const rel = path.relative(ROOT_DIR, item.filePath);
    console.error(`- ${rel}:${item.line}:${item.column} token="${item.token}"`);
    if (item.excerpt) {
      console.error(`  ${item.excerpt}`);
    }
  }
  process.exit(1);
}

console.log("[check:encoding] OK - nenhum padrao de codificacao quebrada encontrado.");
