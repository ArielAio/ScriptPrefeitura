import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("encaminha o OCR pelo service worker", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
  const reader = await readFile(new URL("../leitor.js", import.meta.url), "utf8");
  const readerHtml = await readFile(new URL("../leitor.html", import.meta.url), "utf8");
  const background = await readFile(new URL("../background.js", import.meta.url), "utf8");
  const popupHtml = await readFile(new URL("../popup.html", import.meta.url), "utf8");
  const popupJs = await readFile(new URL("../popup.js", import.meta.url), "utf8");
  const automation = await readFile(new URL("../automation.js", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));

  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.version, packageJson.version);
  assert.ok(manifest.permissions.includes("storage"));
  assert.match(reader, /chrome\.runtime\.sendMessage/);
  assert.match(reader, /chrome\.storage\.local\.set/);
  assert.match(reader, /fornecedoresCotacao: suppliers/);
  assert.match(reader, /\+ Adicionar item/);
  assert.match(reader, /remove\.textContent = "Excluir"/);
  assert.match(readerHtml, /id="drop-zone"/);
  assert.match(reader, /addEventListener\("drop"/);
  assert.match(reader, /analyzeFiles\(\[\.\.\.event\.dataTransfer\.files\]\)/);
  assert.doesNotMatch(reader, /sendNativeMessage/);
  assert.match(background, /chrome\.runtime\.sendNativeMessage/);
  assert.match(popupHtml, /id="resetar-cache"/);
  assert.match(popupHtml, /id="atualizar-extensao"/);
  assert.match(popupHtml, /id="progresso-execucao"/);
  assert.match(popupHtml, /id="conferir-quantidades"/);
  assert.match(popupHtml, /id="conferir-placas"/);
  assert.match(popupHtml, /id="conferir-km"/);
  assert.match(popupHtml, /id="permitir-virada-km"/);
  assert.match(popupHtml, /id="finalizar-processo"/);
  assert.match(popupHtml, /id="versao"/);
  assert.match(popupHtml, /data-fase="fornecedores"/);
  assert.match(popupJs, /chrome\.storage\.local\.clear\(\)/);
  assert.match(
    popupJs,
    /const configuracao = permitirViradaKm\.checked;[\s\S]*chrome\.storage\.local\.clear\(\);[\s\S]*chrome\.storage\.local\.set\(\{ permitirViradaKm: configuracao \}\)/,
  );
  assert.match(popupJs, /chrome\.runtime\.reload\(\)/);
  assert.match(popupJs, /__scriptPrefeituraProgresso/);
  assert.match(popupJs, /if \(await existeExecucaoNaAba\(\)\)/);
  assert.match(popupJs, /intervaloRapidoMs: 250/);
  assert.match(popupJs, /executar\("conferir_km"\)/);
  assert.match(popupJs, /permitirViradaKm: permitirViradaKm\.checked/);
  assert.match(popupJs, /chrome\.storage\.local\.set\(\{ permitirViradaKm:/);
  assert.match(popupJs, /aplicarMaiorKmPorPlaca\(abastecimentosSalvos\)/);
  assert.match(popupJs, /cacheKmDesatualizado/);
  assert.match(automation, /alreadyRunning: true/);
  assert.match(automation, /Date\.now\(\) < modoConservadorAte/);
  assert.match(automation, /id = "script-prefeitura-painel"/);
  assert.match(automation, /@keyframes script-prefeitura-girar/);
  assert.match(automation, /Detalhes das falhas/);
  assert.match(automation, /white-space:pre-line/);
  assert.match(automation, /globalThis\.__scriptPrefeituraControle = vaiPausar \? "pausar" : null/);
  assert.match(automation, /globalThis\.__scriptPrefeituraControle = "cancelar"/);
  assert.match(automation, /globalThis\.__scriptPrefeituraControle = "finalizar"/);
  assert.equal((popupJs.match(/world: "MAIN"/g) || []).length, 4);

  let listener;
  let nativeCall;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener(callback) { listener = callback; } },
      sendNativeMessage(host, payload, callback) {
        nativeCall = { host, payload };
        callback({ ok: true, lines: [] });
      },
    },
  };
  await import(`../background.js?test=${Date.now()}`);

  let response;
  assert.equal(listener({ type: "ocr", payload: { imageBase64: "abc" } }, null, (value) => { response = value; }), true);
  assert.equal(nativeCall.host, "br.gov.sjduaspontes.scriptprefeitura.ocr");
  assert.deepEqual(response, { ok: true, lines: [] });
  delete globalThis.chrome;
});
