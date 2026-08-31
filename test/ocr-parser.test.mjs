import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanProductDescription,
  isValidCnpj,
  maskCnpj,
  parseDocument,
  parseMoney,
} from "../ocr-parser.js";

function line(text, x, y, width = 0.2) {
  return { text, x, y, width, height: 0.02, confidence: 0.99 };
}

test("valida CNPJ numérico e rejeita dígito incorreto", () => {
  assert.equal(isValidCnpj("45.116.712/0001-09"), true);
  assert.equal(isValidCnpj("45.116.712/0001-08"), false);
});

test("aplica a máscara do CNPJ durante a digitação", () => {
  assert.equal(maskCnpj("47"), "47");
  assert.equal(maskCnpj("477688"), "47.768.8");
  assert.equal(maskCnpj("47768882000101"), "47.768.882/0001-01");
  assert.equal(maskCnpj("47.768.882/0001-0199"), "47.768.882/0001-01");
});

test("nunca usa o CNPJ da prefeitura como fornecedor", () => {
  const result = parseDocument([
    line("CNPJ 45.116.712/0001-09", 0.1, 0.9),
    line("PNEU 175/70 R14", 0.1, 0.7, 0.3),
    line("4 UN", 0.5, 0.7),
    line("R$ 389,90", 0.65, 0.7),
    line("R$ 1.559,60", 0.82, 0.7),
  ]);

  assert.equal(result.cnpj, "");
  assert.equal(result.cnpjValid, false);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    description: "PNEU 175/70 R14",
    quantity: 4,
    quantitySource: "ocr",
    unit: "UN",
    unitCents: 38990,
    totalCents: 155960,
    consistent: true,
    confidence: 0.99,
    raw: "PNEU 175/70 R14 4 UN R$ 389,90 R$ 1.559,60",
  });
});

test("seleciona o CNPJ diferente da prefeitura e corrige erro comum do OCR", () => {
  const supplier = parseDocument([
    line("CNPJ: 47.768.882/0001-01", 0.1, 0.9),
    line("CNPJ/CPF: 45.116.712/0001-09", 0.1, 0.8),
  ]);
  const corrected = parseDocument([
    line("47.843.8P1/0001-01", 0.1, 0.9),
    line("CNPJ/CPF: 45.116.712/0001-09", 0.1, 0.8),
  ]);

  assert.equal(supplier.cnpj, "47768882000101");
  assert.equal(supplier.cnpjValid, true);
  assert.equal(corrected.cnpj, "47843891000101");
  assert.equal(corrected.cnpjValid, true);
});

test("remove código inicial e funcionário do nome usado na pesquisa", () => {
  assert.equal(
    cleanProductDescription("000001 CONFECCIONAR 01 BOCAL C/TAMPA EM TEQUINIL 0-< NENHUM >"),
    "CONFECCIONAR 01 BOCAL C/TAMPA EM TEQUINIL",
  );
  assert.equal(
    cleanProductDescription("039.001.060 REBITE MOLA 7/16X1"),
    "REBITE MOLA 7/16X1",
  );
  assert.equal(cleanProductDescription("- CHAVE SELETORA"), "CHAVE SELETORA");
  assert.equal(cleanProductDescription("Item 12 - PLACA SLEEK"), "PLACA SLEEK");
  assert.equal(cleanProductDescription("Itens 3: CABO PP"), "CABO PP");
});

test("ignora a linha que informa somente a quantidade de itens", () => {
  const result = parseDocument([
    line("Qtde. Itens: 16", 0.1, 0.7, 0.3),
    line("R$ 2.469,64", 0.7, 0.7, 0.1),
    line("R$ 0,00", 0.84, 0.7, 0.1),
  ]);
  assert.equal(result.items.length, 0);
});

test("usa cabeçalhos abreviados para identificar a coluna de quantidade", () => {
  for (const header of ["Quant.", "QTD", "QTDE", "QD", "QDE", "QTE", "QNTD"]) {
    const result = parseDocument([
      line("Descrição", 0.1, 0.8, 0.25),
      line(header, 0.52, 0.8, 0.06),
      line("Valor", 0.8, 0.8, 0.1),
      line("FILTRO DE ÓLEO", 0.1, 0.7, 0.3),
      line("3", 0.53, 0.7, 0.03),
      line("R$ 75,00", 0.8, 0.7, 0.1),
    ]);

    assert.equal(result.items.length, 1, header);
    assert.equal(result.items[0].quantity, 3, header);
    assert.equal(result.items[0].quantitySource, "ocr", header);
  }
});

test("calcula a quantidade quando o OCR lê somente os valores", () => {
  const result = parseDocument([
    line("REPARO CUICA MASTER", 0.1, 0.7, 0.3),
    line("R$ 28,95", 0.7, 0.7, 0.1),
    line("R$ 57,90", 0.84, 0.7, 0.1),
  ]);

  assert.equal(result.items[0].quantity, 2);
  assert.equal(result.items[0].quantitySource, "calculated");
  assert.equal(result.items[0].consistent, true);
});

test("reconhece o Pedido de Empenho fotografado e confere o total", () => {
  const expectedItems = [
    ["039.001.060", "REBITE MOLA 7/16X1", "PC", 1, "2,58", "2,58"],
    ["039.001.061", "BRAÇADEIRA MOLA 100X40", "PC", 1, "34,00", "34,00"],
    ["015.001.089", "PINO CENTRO 12/X4", "PC", 1, "18,00", "18,00"],
    ["015.001.392", "PORCA 1/2", "UN", 1, "2,60", "2,60"],
    ["008.014.045", "PARAFUSO 3/8X5", "PC", 1, "7,58", "7,58"],
    ["002.012.413", "PORCA 3/8", "UN", 1, "2,09", "2,09"],
    ["002.076.182", "MOLA DIANTEIRA", "UND", 1, "1.400,00", "1.400,00"],
    ["012.008.086", "OLEO 15W40", "LT", 3, "33,63", "100,89"],
    ["005.012.001", "SERV MECÂNICO EM GERAL", "SERV", 1, "400,00", "400,00"],
  ];
  const quantityReadByOcr = new Set([3, 7, 8]);
  const lines = [
    line("CNPJ: 45.116.712/0001-09", 0.15, 0.9),
    line("Fornecedor 7913 WILTON DE FIGUEIREDO LTDA", 0.15, 0.49, 0.48),
    line("CNPJ: 47.843.891/0001-01", 0.76, 0.49, 0.2),
    line("Cod Prod", 0.15, 0.44, 0.08),
    line("Nome/Descrição", 0.23, 0.44, 0.2),
    line("Unid", 0.69, 0.44, 0.04),
    line("Quant Unitário $", 0.73, 0.44, 0.12),
    line("Valor", 0.87, 0.44, 0.05),
  ];

  expectedItems.forEach(([code, description, unit, quantity, unitValue, total], index) => {
    const y = 0.4 - index * 0.035;
    lines.push(line(`${code} ${description}`, 0.15, y, 0.45));
    lines.push(line(unit, 0.69, y + 0.01, 0.025));
    if (quantityReadByOcr.has(index)) lines.push(line(String(quantity), 0.75, y + 0.01, 0.015));
    lines.push(line(unitValue, 0.79, y + 0.01, 0.065));
    lines.push(line(total, 0.87, y + 0.01, 0.07));
    lines.push(line("CAM. INTER (FQK-2B76)", 0.6, y - 0.013, 0.2));
  });
  lines.push(line("Total Pedido", 0.84, 0.075, 0.1));
  lines.push(line("R$1.967,74", 0.84, 0.05, 0.1));

  const result = parseDocument(lines);

  assert.equal(result.cnpj, "47843891000101");
  assert.equal(result.cnpjValid, true);
  assert.equal(result.items.length, 9);
  assert.deepEqual(result.items.map((item) => ({
    code: item.code,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitCents: item.unitCents,
    totalCents: item.totalCents,
  })), expectedItems.map(([code, description, unit, quantity, unitValue, total]) => ({
    code,
    description,
    unit: unit === "PC" ? "PÇ" : unit,
    quantity,
    unitCents: parseMoney(unitValue),
    totalCents: parseMoney(total),
  })));
  assert.equal(result.documentTotalCents, 196774);
  assert.equal(result.itemsTotalCents, 196774);
  assert.equal(result.totalsConsistent, true);
});

test("converte valor brasileiro em centavos", () => {
  assert.equal(parseMoney("R$ 1.234,56"), 123456);
});
