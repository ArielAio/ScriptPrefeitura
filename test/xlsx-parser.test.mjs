import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarMaiorKmPorPlaca,
  lerAbastecimentosXlsx,
  normalizarAbastecimentos,
} from "../xlsx-parser.js";

test("extrai produto, placa, litros e o maior KM de cada placa", () => {
  const resultado = normalizarAbastecimentos([
    ["Ordem", "Arquivo", "Placa", "KM", "Combustível", "Litros", "Total R$"],
    [1, "a.jpg", "abc-1d23", 120, "ETANOL", 14, 55.86],
    [2, "b.jpg", "XYZ9876", 300, "ETANOL", "20,5", 81.8],
    [3, "c.jpg", "ABC1D23", 110, "ETANOL", 15, 59.85],
  ]);

  assert.deepEqual(resultado, [
    { placa: "ABC1D23", km: 120, litros: 14, produto: "ETANOL" },
    { placa: "XYZ9876", km: 300, litros: 20.5, produto: "ETANOL" },
    { placa: "ABC1D23", km: 120, litros: 15, produto: "ETANOL" },
  ]);
  assert.deepEqual(Object.keys(resultado[0]).sort(), ["km", "litros", "placa", "produto"]);
});

test("rejeita a planilha inteira quando uma linha relevante é inválida", () => {
  assert.throws(() => normalizarAbastecimentos([
    ["Placa", "KM", "Combustível", "Litros"],
    ["ABC1D23", 100, "ETANOL", 10],
    ["placa ruim", 90.5, "", 0],
  ]), /linha 3: placa inválida.*KM inválido.*combustível não informado.*litros inválidos/);
});

test("recalcula o maior KM por placa em dados antigos armazenados", () => {
  assert.deepEqual(aplicarMaiorKmPorPlaca([
    { placa: "abc-1d23", km: 50, litros: 10, produto: "ETANOL" },
    { placa: "ABC1D23", km: 80, litros: 20, produto: "ETANOL" },
    { placa: "abc 1d23", km: 60, litros: 30, produto: "ETANOL" },
  ]), [
    { placa: "ABC1D23", km: 80, litros: 10, produto: "ETANOL" },
    { placa: "ABC1D23", km: 80, litros: 20, produto: "ETANOL" },
    { placa: "ABC1D23", km: 80, litros: 30, produto: "ETANOL" },
  ]);
});

test("lê a primeira aba com as quatro colunas obrigatórias", async () => {
  const leitor = {
    read: () => ({ SheetNames: ["Resumo", "Abastecimentos"], Sheets: { Resumo: 1, Abastecimentos: 2 } }),
    utils: {
      sheet_to_json: (aba) => aba === 1
        ? [["Total"], [10]]
        : [["Placa", "KM", "Combustível", "Litros"], ["ABC1D23", 100, "ETANOL HIDRATADO", 12]],
    },
  };
  const arquivo = { name: "dados.xlsx", size: 100, arrayBuffer: async () => new ArrayBuffer(0) };
  assert.deepEqual(await lerAbastecimentosXlsx(arquivo, leitor), [
    { placa: "ABC1D23", km: 100, litros: 12, produto: "ETANOL HIDRATADO" },
  ]);
});
