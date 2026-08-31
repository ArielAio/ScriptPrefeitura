const CNPJ_WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
];
const MUNICIPALITY_CNPJ = "45116712000109";
const OCR_CNPJ_DIGITS = {
  B: "8", D: "0", G: "6", I: "1", L: "1",
  O: "0", P: "9", Q: "0", S: "5", T: "7", Z: "2",
};

const moneyPattern = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}/gi;
const quantityHeaders = new Set([
  "QD", "QDE", "QNT", "QNTD", "QT", "QTD", "QTDE", "QTE",
  "QTY", "QUANT", "QUANTID", "QUANTIDADE",
]);
const productCodePattern = /^\s*(\d{3}(?:\.\d{3}){2})\s+(.+?)\s*$/;
const exactMoneyPattern = /^(?:R\$\s*)?\d+(?:\.\d{3})*,\d{2}$/i;
const unitNames = new Set(["UN", "UND", "UNID", "PC", "PCS", "CX", "KG", "L", "LT", "M", "SERV"]);

function cnpjDigit(values, weights) {
  const remainder = values.reduce((sum, value, index) => sum + value * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCnpj(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function maskCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function isValidCnpj(value) {
  const normalized = normalizeCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(normalized) || /^(.)(\1){13}$/.test(normalized)) return false;

  const values = [...normalized.slice(0, 12)].map((character) => character.charCodeAt(0) - 48);
  const first = cnpjDigit(values, CNPJ_WEIGHTS[0]);
  const second = cnpjDigit([...values, first], CNPJ_WEIGHTS[1]);
  return normalized.endsWith(`${first}${second}`);
}

export function formatCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return value || "Não identificado";
  if (/^\d{14}$/.test(cnpj)) return maskCnpj(cnpj);
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function cleanProductDescription(value) {
  return String(value || "")
    .replace(/^\s*[-–—•·]+\s*/, "")
    .replace(/^\s*(?:ITEM|ITENS?)\s*(?:N[º°O.]?\s*)?\d+\s*[-–—:.)]?\s*/i, "")
    .replace(/^\s*[-–—•·]+\s*/, "")
    .replace(/^\s*(?:\d{4,}|\d{2,}(?:\.\d{2,})+)\s+/, "")
    .replace(/\s+\d+\s*-\s*<\s*NENHUM\s*>\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCnpjs(text) {
  const candidates = [];
  const patterns = [
    /[A-Z0-9]{2}[.\s]?[A-Z0-9]{3}[.\s]?[A-Z0-9]{3}[\s/]?[A-Z0-9]{4}[\s-]?\d{2}/gi,
    /[A-Z0-9]{14}/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const normalized = normalizeCnpj(match[0]);
      if (!candidates.includes(normalized)) candidates.push(normalized);
    }
  }
  return candidates;
}

function correctOcrCnpj(value) {
  const normalized = normalizeCnpj(value);
  const corrected = normalized.replace(/[A-Z]/g, (character) => OCR_CNPJ_DIGITS[character] || character);
  return /^\d{14}$/.test(corrected) && isValidCnpj(corrected) ? corrected : normalized;
}

function supplierCnpjs(candidates) {
  return candidates
    .map(correctOcrCnpj)
    .filter((candidate) => candidate !== MUNICIPALITY_CNPJ);
}

function extractSupplierCnpj(rows, fullText) {
  const supplierRow = rows.find((row) => /\bFORNECEDOR\b/i.test(row.text));
  const supplierCandidates = supplierCnpjs(supplierRow ? extractCnpjs(supplierRow.text) : []);
  const allCandidates = supplierCnpjs(extractCnpjs(fullText));
  return supplierCandidates.find(isValidCnpj)
    || supplierCandidates[0]
    || allCandidates.filter(isValidCnpj).at(-1)
    || allCandidates.at(-1)
    || "";
}

export function parseMoney(value) {
  const normalized = String(value || "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

export function formatMoney(cents) {
  if (!Number.isInteger(cents)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function groupRows(lines) {
  const sorted = [...lines].sort((a, b) => (b.y + b.height / 2) - (a.y + a.height / 2));
  const rows = [];

  for (const line of sorted) {
    const center = line.y + line.height / 2;
    const row = rows.find((candidate) => Math.abs(candidate.center - center) <= Math.max(line.height, candidate.height) * 0.65);
    if (row) {
      row.lines.push(line);
      row.center = (row.center * (row.lines.length - 1) + center) / row.lines.length;
      row.height = Math.max(row.height, line.height);
    } else {
      rows.push({ center, height: line.height, lines: [line] });
    }
  }

  return rows.map((row) => {
    const ordered = row.lines.sort((a, b) => a.x - b.x);
    return {
      text: ordered.map((line) => line.text).join(" ").replace(/\s+/g, " ").trim(),
      confidence: Math.min(...ordered.map((line) => line.confidence ?? 0)),
      center: row.center,
      lines: ordered,
    };
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function findQuantityHeader(rows) {
  for (const row of rows) {
    for (const line of row.lines) {
      if (quantityHeaders.has(normalizeHeader(line.text))) {
        return { detected: true, center: line.x + line.width / 2, y: row.center, width: line.width };
      }
    }
    if (row.text.split(/\s+/).some((word) => quantityHeaders.has(normalizeHeader(word)))) {
      return { detected: true, center: null, y: row.center, width: 0 };
    }
  }
  return { detected: false, center: null, y: null, width: 0 };
}

function quantityInColumn(row, header) {
  if (header.center == null || row.center >= header.y) return null;
  const tolerance = Math.max(header.width, 0.06);
  const line = row.lines.find((candidate) => {
    const center = candidate.x + candidate.width / 2;
    return Math.abs(center - header.center) <= tolerance && /^\d+(?:[.,]\d+)?(?:\s*[A-ZÇ]{1,4})?$/i.test(candidate.text.trim());
  });
  if (!line) return null;
  const match = line.text.trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-ZÇ]{1,4})?$/i);
  return match ? { value: Number(match[1].replace(",", ".")), unit: match[2]?.toUpperCase() || "", raw: line.text.trim() } : null;
}

function completeQuantity(extractedQuantity, unitCents, totalCents) {
  const ratio = extractedQuantity == null && unitCents > 0 && totalCents != null
    ? Math.round((totalCents / unitCents) * 1000) / 1000
    : null;
  const inferredQuantity = ratio != null && ratio > 0 && Math.abs(Math.round(ratio * unitCents) - totalCents) <= 1
    ? ratio
    : null;
  const quantity = extractedQuantity ?? inferredQuantity;
  const calculatedCents = quantity != null && unitCents != null ? Math.round(quantity * unitCents) : null;
  return {
    quantity,
    quantitySource: extractedQuantity != null ? "ocr" : inferredQuantity != null ? "calculated" : null,
    consistent: calculatedCents == null || totalCents == null
      ? null
      : Math.abs(calculatedCents - totalCents) <= 1,
  };
}

function parseItem(row, quantityHeader) {
  const amounts = [...row.text.matchAll(moneyPattern)];
  if (!amounts.length || !/[A-ZÀ-Ú]/i.test(row.text)) return null;
  if (/\b(?:SUBTOTAL|TOTAL|FRETE|DESCONTO|IMPOSTO|VALOR\s+TOTAL)\b/i.test(row.text)) return null;
  if (/^\s*(?:QTD(?:E)?|QUANT(?:IDADE)?)\.?\s*(?:DE\s+)?ITENS?\b/i.test(row.text)) return null;

  const beforeMoney = row.text.slice(0, amounts[0].index).trim();
  const quantityMatch = beforeMoney.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(UN|UND|UNID|PC|PÇ|CX|KG|L|M)?\s*$/i);
  const columnQuantity = quantityInColumn(row, quantityHeader);
  const hasEnoughEvidence = amounts.length >= 2 || Boolean(quantityMatch?.[2]) || Boolean(columnQuantity) || (quantityHeader.detected && Boolean(quantityMatch));
  if (!hasEnoughEvidence) return null;

  const extractedQuantity = columnQuantity?.value ?? (quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : null);
  const description = cleanProductDescription(quantityMatch
    ? beforeMoney.slice(0, quantityMatch.index).trim()
    : columnQuantity
      ? beforeMoney.replace(columnQuantity.raw, "").trim()
      : beforeMoney);
  if (description.length < 2) return null;

  const cents = amounts.map((match) => parseMoney(match[0])).filter(Number.isInteger);
  const totalCents = cents.at(-1) ?? null;
  const unitCents = cents.length >= 2 ? cents.at(-2) : null;
  const completed = completeQuantity(extractedQuantity, unitCents, totalCents);

  return {
    description,
    quantity: completed.quantity,
    quantitySource: completed.quantitySource,
    unit: columnQuantity?.unit || quantityMatch?.[2]?.toUpperCase() || "",
    unitCents,
    totalCents,
    consistent: completed.consistent,
    confidence: row.confidence,
    raw: row.text,
  };
}

function lineCenter(line) {
  return line.y + line.height / 2;
}

function normalizeUnit(value) {
  const normalized = normalizeHeader(value);
  if (normalized === "PC") return "PÇ";
  if (normalized === "PCS") return "PÇS";
  return normalized;
}

function parseCodedItems(lines) {
  const products = lines
    .map((line) => ({ line, match: line.text.trim().match(productCodePattern), center: lineCenter(line) }))
    .filter((entry) => entry.match)
    .sort((a, b) => b.center - a.center);
  if (products.length < 2) return [];

  return products.map((product, index) => {
    const previous = products[index - 1];
    const next = products[index + 1];
    const upper = previous
      ? (previous.center + product.center) / 2
      : product.center + (product.center - next.center) / 2;
    const lower = next
      ? (product.center + next.center) / 2
      : product.center - (previous.center - product.center) / 2;
    const band = lines.filter((line) => {
      const center = lineCenter(line);
      return center <= upper && center > lower;
    });
    const amounts = band
      .filter((line) => line.x > 0.68 && exactMoneyPattern.test(line.text.trim()))
      .sort((a, b) => a.x - b.x)
      .slice(-2);
    const unitCents = amounts.length >= 2 ? parseMoney(amounts[0].text) : null;
    const totalCents = amounts.length >= 2 ? parseMoney(amounts[1].text) : null;
    const firstAmountX = amounts[0]?.x ?? 1;
    const unitLine = band.find((line) => {
      const unit = normalizeHeader(line.text);
      return line.x > 0.55 && line.x < firstAmountX && unitNames.has(unit);
    });
    const unitRight = unitLine ? unitLine.x + unitLine.width : 0.68;
    const quantityLine = band
      .filter((line) => line.x >= unitRight - 0.01 && line.x < firstAmountX && /^\d+(?:[.,]\d+)?$/.test(line.text.trim()))
      .sort((a, b) => b.x - a.x)[0];
    const extractedQuantity = quantityLine ? Number(quantityLine.text.trim().replace(",", ".")) : null;
    const completed = completeQuantity(extractedQuantity, unitCents, totalCents);
    const evidence = [product.line, unitLine, quantityLine, ...amounts].filter(Boolean);

    return {
      code: product.match[1],
      description: cleanProductDescription(product.match[2]),
      quantity: completed.quantity,
      quantitySource: completed.quantitySource,
      unit: unitLine ? normalizeUnit(unitLine.text) : "",
      unitCents,
      totalCents,
      consistent: completed.consistent,
      confidence: Math.min(...evidence.map((line) => line.confidence ?? 0)),
      raw: evidence.sort((a, b) => a.x - b.x).map((line) => line.text).join(" "),
    };
  });
}

function extractDocumentTotal(lines) {
  const label = lines.find((line) => /\bTOTAL\s+(?:DO\s+)?PEDIDO\b/i.test(line.text));
  if (!label) return null;
  const directAmount = [...label.text.matchAll(moneyPattern)].at(-1);
  if (directAmount) return parseMoney(directAmount[0]);

  const labelCenter = lineCenter(label);
  const amount = lines
    .filter((line) => lineCenter(line) < labelCenter && labelCenter - lineCenter(line) < 0.08)
    .filter((line) => line.x > Math.max(0.65, label.x - 0.08) && exactMoneyPattern.test(line.text.trim()))
    .sort((a, b) => Math.abs(lineCenter(a) - labelCenter) - Math.abs(lineCenter(b) - labelCenter))[0];
  return amount ? parseMoney(amount.text) : null;
}

export function parseDocument(lines) {
  const cleanLines = lines.filter((line) => line?.text?.trim());
  const rows = groupRows(cleanLines);
  const quantityHeader = findQuantityHeader(rows);
  const fullText = rows.map((row) => row.text).join("\n");
  const cnpj = extractSupplierCnpj(rows, fullText);
  const codedItems = parseCodedItems(cleanLines);
  const items = codedItems.length ? codedItems : rows.map((row) => parseItem(row, quantityHeader)).filter(Boolean);
  const documentTotalCents = extractDocumentTotal(cleanLines);
  const itemTotals = items.map((item) => item.totalCents);
  const itemsTotalCents = itemTotals.every(Number.isInteger)
    ? itemTotals.reduce((sum, value) => sum + value, 0)
    : null;
  return {
    cnpj,
    cnpjValid: Boolean(cnpj) && isValidCnpj(cnpj),
    items,
    documentTotalCents,
    itemsTotalCents,
    totalsConsistent: documentTotalCents == null || itemsTotalCents == null
      ? null
      : Math.abs(documentTotalCents - itemsTotalCents) <= 1,
    rows,
    fullText,
  };
}
