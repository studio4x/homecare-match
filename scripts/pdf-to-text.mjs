import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

function toOutputPath(inputPath, outputArg) {
  if (outputArg) {
    return path.resolve(outputArg);
  }

  const resolvedInput = path.resolve(inputPath);
  const parsed = path.parse(resolvedInput);
  return path.join(parsed.dir, `${parsed.name}.txt`);
}

function usage() {
  console.error("Uso: node scripts/pdf-to-text.mjs <arquivo.pdf> [saida.txt]");
  console.error("Ex.: npm run pdf:to-text -- ./documento.pdf");
}

function normalizeTextItems(items) {
  const lines = [];
  let currentLine = "";

  for (const item of items) {
    if (!("str" in item) || !item.str) {
      continue;
    }

    currentLine = currentLine ? `${currentLine} ${item.str}` : item.str;

    if (item.hasEOL) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n");
}

async function extractTextFromPdf(inputPath) {
  const pdfBuffer = await fs.readFile(inputPath);
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    verbosity: 0,
  });
  const pdfDocument = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(normalizeTextItems(textContent.items));
  }

  await pdfDocument.cleanup();
  return {
    pageCount: pdfDocument.numPages,
    text: pages.join("\n\n"),
  };
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = toOutputPath(inputPath, outputArg);

  try {
    await fs.access(inputPath);
  } catch {
    console.error(`Arquivo nao encontrado: ${inputPath}`);
    process.exit(1);
  }

  try {
    const { pageCount, text } = await extractTextFromPdf(inputPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, text, "utf8");
    console.log(`Conversao concluida: ${pageCount} pagina(s).`);
    console.log(`Arquivo de saida: ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Erro ao converter PDF: ${message}`);
    process.exit(1);
  }
}

await main();
