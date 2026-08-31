const normalizarCabecalho = (valor) => String(valor ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim();

const numeroBrasileiro = (valor) => {
  if (typeof valor === "number") return valor;
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  if (!texto) return NaN;
  if (texto.includes(",")) return Number(texto.replace(/\./g, "").replace(",", "."));
  return Number(texto);
};

const placaNormalizada = (valor) => String(valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function aplicarMaiorKmPorPlaca(abastecimentos) {
  if (!Array.isArray(abastecimentos)) return [];

  const maiorKmPorPlaca = new Map();
  for (const item of abastecimentos) {
    const placa = placaNormalizada(item?.placa);
    const km = numeroBrasileiro(item?.km);
    maiorKmPorPlaca.set(placa, Math.max(maiorKmPorPlaca.get(placa) ?? -Infinity, km));
  }

  return abastecimentos.map((item) => {
    const placa = placaNormalizada(item?.placa);
    return { ...item, placa, km: maiorKmPorPlaca.get(placa) };
  });
}

export function normalizarAbastecimentos(linhas) {
  if (!Array.isArray(linhas) || !linhas.length) {
    throw new Error("A planilha está vazia.");
  }

  const indiceCabecalho = linhas.findIndex((linha) => {
    const cabecalhos = (linha || []).map(normalizarCabecalho);
    return ["PLACA", "KM", "COMBUSTIVEL", "LITROS"].every((nome) => cabecalhos.includes(nome));
  });
  if (indiceCabecalho < 0) {
    throw new Error("As colunas Placa, KM, Combustível e Litros não foram localizadas.");
  }

  const cabecalhos = linhas[indiceCabecalho].map(normalizarCabecalho);
  const indices = {
    placa: cabecalhos.indexOf("PLACA"),
    km: cabecalhos.indexOf("KM"),
    produto: cabecalhos.indexOf("COMBUSTIVEL"),
    litros: cabecalhos.indexOf("LITROS"),
  };
  const abastecimentos = [];
  const erros = [];

  linhas.slice(indiceCabecalho + 1).forEach((linha, indice) => {
    const valores = linha || [];
    const relevantes = [valores[indices.placa], valores[indices.km], valores[indices.produto], valores[indices.litros]];
    if (relevantes.every((valor) => valor == null || String(valor).trim() === "")) return;

    const numeroLinha = indiceCabecalho + indice + 2;
    const placa = placaNormalizada(valores[indices.placa]);
    const km = numeroBrasileiro(valores[indices.km]);
    const produto = String(valores[indices.produto] ?? "").replace(/\s+/g, " ").trim();
    const litros = numeroBrasileiro(valores[indices.litros]);
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) erros.push(`linha ${numeroLinha}: placa inválida`);
    if (!Number.isInteger(km) || km < 0) erros.push(`linha ${numeroLinha}: KM inválido`);
    if (!produto) erros.push(`linha ${numeroLinha}: combustível não informado`);
    if (!Number.isFinite(litros) || litros <= 0) erros.push(`linha ${numeroLinha}: litros inválidos`);
    abastecimentos.push({ placa, km, produto, litros });
  });

  if (erros.length) {
    throw new Error(`Corrija o XLSX antes de continuar: ${erros.slice(0, 5).join("; ")}${erros.length > 5 ? `; e mais ${erros.length - 5}` : ""}.`);
  }
  if (!abastecimentos.length) throw new Error("Nenhum abastecimento válido foi encontrado.");

  return aplicarMaiorKmPorPlaca(abastecimentos);
}

export async function lerAbastecimentosXlsx(arquivo, leitor = globalThis.XLSX) {
  if (!arquivo || !/\.xlsx$/i.test(arquivo.name || "")) {
    throw new Error("Selecione um arquivo XLSX.");
  }
  if (arquivo.size > 20 * 1024 * 1024) {
    throw new Error("O XLSX deve ter no máximo 20 MB.");
  }
  if (!leitor?.read || !leitor?.utils?.sheet_to_json) {
    throw new Error("O leitor XLSX da extensão não foi carregado.");
  }

  const pasta = leitor.read(await arquivo.arrayBuffer(), { type: "array" });
  let ultimoErro = null;
  for (const nome of pasta.SheetNames || []) {
    try {
      const linhas = leitor.utils.sheet_to_json(pasta.Sheets[nome], {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      });
      return normalizarAbastecimentos(linhas);
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro || new Error("Nenhuma aba válida foi encontrada no XLSX.");
}
