export const CHAVES_ABASTECIMENTOS = [
  "abastecimentosSaida",
  "indiceAbastecimento",
  "indiceQuantidadeAbastecimento",
  "centroCustoPendente",
  "arquivoAbastecimentos",
  "abaAbastecimentosId",
  "falhasAbastecimentos",
  "kmsIgnorados",
];

export function vincularAbaAbastecimentos(abaSalva, abaAtual) {
  if (!Number.isInteger(abaAtual) || abaAtual <= 0) {
    throw new Error("A aba do SCPI usada para os abastecimentos não é válida.");
  }
  if (abaSalva != null && abaSalva !== abaAtual) {
    throw new Error(
      "Este XLSX já foi iniciado em outra aba do SCPI. Volte à aba original ou importe novamente a planilha para começar outra requisição.",
    );
  }
  return abaAtual;
}

export function rotuloAbastecimentos(indiceItens, indiceQuantidades, total, falhas = []) {
  if (falhas.length) return `Continuar pendências (${falhas.length})`;
  if (indiceItens < total) return `Continuar abastecimentos (${indiceItens}/${total})`;
  if (indiceQuantidades < total) return `Continuar QTDs (${indiceQuantidades}/${total})`;
  return `Preenchimento concluído (${total}/${total})`;
}
