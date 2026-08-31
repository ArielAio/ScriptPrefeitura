import test from "node:test";
import assert from "node:assert/strict";
import { selecionarAbaScpi } from "../scpi-tab.js";

test("localiza a aba ativa do SCPI mesmo quando o painel abre em outra janela", () => {
  const aba = selecionarAbaScpi([
    { id: 1, active: true, lastAccessed: 300, url: "chrome-extension://ext/popup.html" },
    { id: 2, active: true, lastAccessed: 200, url: "https://srv.sjduaspontes.sp.gov.br/scpi9/Compras/" },
    { id: 3, active: false, lastAccessed: 400, url: "https://srv.sjduaspontes.sp.gov.br/scpi9/Compras/" },
  ]);

  assert.equal(aba.id, 2);
});

test("prefere a aba ativa do SCPI acessada mais recentemente", () => {
  const aba = selecionarAbaScpi([
    { id: 4, active: true, lastAccessed: 100, url: "https://srv.sjduaspontes.sp.gov.br/scpi9/Compras/" },
    { id: 5, active: true, lastAccessed: 500, url: "https://srv.sjduaspontes.sp.gov.br/scpi9/Compras/" },
  ]);

  assert.equal(aba.id, 5);
});

test("não escolhe uma aba fora do SCPI", () => {
  assert.equal(selecionarAbaScpi([
    { id: 6, active: true, url: "https://example.com/" },
  ]), null);
});
