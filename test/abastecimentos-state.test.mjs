import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAVES_ABASTECIMENTOS,
  rotuloAbastecimentos,
  vincularAbaAbastecimentos,
} from "../abastecimentos-state.js";

test("vincula o XLSX à primeira aba e recusa outra aba na retomada", () => {
  assert.equal(vincularAbaAbastecimentos(null, 12), 12);
  assert.equal(vincularAbaAbastecimentos(12, 12), 12);
  assert.throws(() => vincularAbaAbastecimentos(12, 13), /outra aba do SCPI/);
});

test("mantém pendências visíveis mesmo quando os índices chegaram ao final", () => {
  assert.equal(rotuloAbastecimentos(3, 3, 3, [{ etapa: "KM Atual" }]), "Continuar pendências (1)");
  assert.equal(rotuloAbastecimentos(3, 2, 3), "Continuar QTDs (2/3)");
  assert.equal(rotuloAbastecimentos(3, 3, 3), "Preenchimento concluído (3/3)");
});

test("lista todas as chaves removidas quando uma nova importação é invalidada", () => {
  assert.deepEqual(CHAVES_ABASTECIMENTOS, [
    "abastecimentosSaida",
    "indiceAbastecimento",
    "indiceQuantidadeAbastecimento",
    "centroCustoPendente",
    "arquivoAbastecimentos",
    "abaAbastecimentosId",
    "falhasAbastecimentos",
    "kmsIgnorados",
  ]);
});
