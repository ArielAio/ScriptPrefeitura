import { executarFaseNoFrame } from "./automation.js";
import { cleanProductDescription } from "./ocr-parser.js";
import { selecionarAbaScpi } from "./scpi-tab.js";
import { aplicarMaiorKmPorPlaca, lerAbastecimentosXlsx } from "./xlsx-parser.js";

const botoes = [...document.querySelectorAll("button[data-fase]")];
const confirmarProduto = document.querySelector("#confirmar-produto");
const arquivoAbastecimentos = document.querySelector("#arquivo-abastecimentos");
const importarAbastecimentos = document.querySelector("#importar-abastecimentos");
const conferirQuantidades = document.querySelector("#conferir-quantidades");
const conferirPlacas = document.querySelector("#conferir-placas");
const conferirKm = document.querySelector("#conferir-km");
const permitirViradaKm = document.querySelector("#permitir-virada-km");
const confirmarCentroCusto = document.querySelector("#confirmar-centro-custo");
const pausarProcesso = document.querySelector("#pausar-processo");
const finalizarProcesso = document.querySelector("#finalizar-processo");
const cancelarProcesso = document.querySelector("#cancelar-processo");
const atualizarExtensao = document.querySelector("#atualizar-extensao");
const resetarCache = document.querySelector("#resetar-cache");
const progressoExecucao = document.querySelector("#progresso-execucao");
const status = document.querySelector("#status");
const telaInicio = document.querySelector("#tela-inicio");
const paineis = {
  solicitacoes: document.querySelector("#painel-solicitacoes"),
  abastecimentos: document.querySelector("#painel-abastecimentos"),
};
document.querySelector("#versao").textContent = `v${chrome.runtime.getManifest().version}`;
let executando = false;
let pausado = false;
let cancelando = false;
let finalizando = false;
let temAbastecimentos = false;

function abrirPainel(nome) {
  telaInicio.hidden = Boolean(nome);
  Object.entries(paineis).forEach(([chave, painel]) => {
    painel.hidden = chave !== nome;
  });
  globalThis.scrollTo?.({ top: 0, behavior: "auto" });
}

document.querySelectorAll("[data-abrir-painel]").forEach((botao) => {
  botao.addEventListener("click", () => abrirPainel(botao.dataset.abrirPainel));
});

document.querySelectorAll("[data-voltar]").forEach((botao) => {
  botao.addEventListener("click", () => abrirPainel(null));
});

document.querySelector("#abrir-leitor").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("leitor.html") });
});

function mostrar(mensagem, tipo = "") {
  status.textContent = mensagem;
  status.dataset.tipo = tipo;
}

function mostrarProgresso(progresso) {
  if (!progresso?.total) {
    progressoExecucao.hidden = true;
    progressoExecucao.textContent = "";
    return;
  }
  progressoExecucao.hidden = false;
  progressoExecucao.textContent = `${progresso.tipo}: ${progresso.atual} de ${progresso.total} — ${progresso.etapa}`;
}

async function lerProgressoAbastecimentos(tabId) {
  const resultados = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: "MAIN",
    func: () => globalThis.__scriptPrefeituraProgresso || null,
  });
  return resultados.map((item) => item.result).find((item) =>
    ["abastecimentos", "conferir_quantidades", "conferir_placas", "conferir_km"].includes(item?.fase)) || null;
}

function mostrarProdutoPendente(produto) {
  confirmarProduto.hidden = !produto;
  if (produto) confirmarProduto.textContent = `Já inseri “${cleanProductDescription(produto.description)}” — continuar`;
}

function mostrarCentroCustoPendente(pendente) {
  confirmarCentroCusto.hidden = !pendente;
  if (pendente) confirmarCentroCusto.textContent = `Já escolhi a placa ${pendente.placa} — continuar`;
}

function bloquearImportacao(bloqueado) {
  permitirViradaKm.disabled = bloqueado;
  arquivoAbastecimentos.disabled = bloqueado;
  importarAbastecimentos.disabled = bloqueado || !temAbastecimentos;
  conferirQuantidades.disabled = bloqueado || !temAbastecimentos;
  conferirPlacas.disabled = bloqueado || !temAbastecimentos;
  conferirKm.disabled = bloqueado || !temAbastecimentos;
}

async function limparDadosExtensao() {
  const configuracao = permitirViradaKm.checked;
  await chrome.storage.local.clear();
  await chrome.storage.local.set({ permitirViradaKm: configuracao });
  temAbastecimentos = false;
  arquivoAbastecimentos.value = "";
  importarAbastecimentos.textContent = "Importar XLSX e preencher";
  bloquearImportacao(false);
  mostrarProdutoPendente(null);
  mostrarCentroCustoPendente(null);
  mostrarProgresso(null);
}

function rotuloAbastecimentos(indiceItens, indiceQuantidades, total) {
  if (indiceItens < total) return `Continuar abastecimentos (${indiceItens}/${total})`;
  if (indiceQuantidades < total) return `Continuar QTDs (${indiceQuantidades}/${total})`;
  return `Preenchimento concluído (${total}/${total})`;
}

async function enviarControle(controle) {
  const aba = selecionarAbaScpi(await chrome.tabs.query({}));
  if (!aba) {
    throw new Error("A aba ativa do SCPI 9.0 não foi localizada.");
  }

  const resultados = await chrome.scripting.executeScript({
    target: { tabId: aba.id, allFrames: true },
    world: "MAIN",
    func: (novoControle) => {
      if (!globalThis.__scriptPrefeituraExecutando) return false;
      globalThis.__scriptPrefeituraControle = novoControle;
      return true;
    },
    args: [controle],
  });
  return resultados.some((item) => item.result === true);
}

async function existeExecucaoNaAba() {
  const aba = selecionarAbaScpi(await chrome.tabs.query({}));
  if (!aba) return false;
  const resultados = await chrome.scripting.executeScript({
    target: { tabId: aba.id, allFrames: true },
    world: "MAIN",
    func: () => Boolean(globalThis.__scriptPrefeituraExecutando),
  });
  return resultados.some((item) => item.result === true);
}

async function executar(fase) {
  botoes.forEach((botao) => { botao.disabled = true; });
  executando = true;
  pausado = false;
  cancelando = false;
  finalizando = false;
  pausarProcesso.disabled = false;
  pausarProcesso.textContent = "Pausar";
  finalizarProcesso.disabled = false;
  cancelarProcesso.disabled = false;
  atualizarExtensao.disabled = true;
  resetarCache.disabled = true;
  bloquearImportacao(true);
  mostrar(["produtos", "fornecedores", "abastecimentos"].includes(fase)
    ? "Pesquisando em modo adaptativo e aguardando cada resposta do SCPI..."
    : "Executando e conferindo cada etapa...");

  try {
    if (await existeExecucaoNaAba()) {
      throw new Error(
        "Já existe uma execução do Fluxo SCPI nesta página. Use o painel fixo para pausar, finalizar ou cancelar antes de iniciar outra.",
      );
    }
    const dados = await chrome.storage.local.get([
      "produtosSolicitacao",
      "indiceProduto",
      "produtoPendente",
      "fornecedoresCotacao",
      "abastecimentosSaida",
      "indiceAbastecimento",
      "indiceQuantidadeAbastecimento",
      "centroCustoPendente",
    ]);
    const produtos = (dados.produtosSolicitacao || []).map((produto) => ({
      description: cleanProductDescription(produto.description),
      quantity: produto.quantity,
    }));
    const indiceInicial = dados.indiceProduto || 0;
    const fornecedores = dados.fornecedoresCotacao || [];
    const abastecimentosSalvos = dados.abastecimentosSaida || [];
    const abastecimentos = aplicarMaiorKmPorPlaca(abastecimentosSalvos);
    const cacheKmDesatualizado = abastecimentos.some((item, indice) =>
      item.placa !== abastecimentosSalvos[indice]?.placa
      || item.km !== abastecimentosSalvos[indice]?.km);
    let indiceAbastecimentoInicial = dados.indiceAbastecimento || 0;
    let indiceQuantidadeAbastecimentoInicial = dados.indiceQuantidadeAbastecimento || 0;
    if (cacheKmDesatualizado) {
      indiceAbastecimentoInicial = 0;
      indiceQuantidadeAbastecimentoInicial = 0;
      await chrome.storage.local.set({
        abastecimentosSaida: abastecimentos,
        indiceAbastecimento: 0,
        indiceQuantidadeAbastecimento: 0,
        centroCustoPendente: null,
      });
    }
    if (fase === "produtos" && !produtos.length) {
      throw new Error("Extraia, confira e envie os produtos pelo leitor antes deste passo.");
    }
    if (fase === "fornecedores" && !fornecedores.length) {
      throw new Error("Extraia e confira os CNPJs dos fornecedores no leitor antes deste passo.");
    }
    if (["abastecimentos", "conferir_quantidades", "conferir_placas", "conferir_km"].includes(fase) && !abastecimentos.length) {
      throw new Error("Selecione e valide um XLSX de abastecimentos antes de começar.");
    }

    const aba = selecionarAbaScpi(await chrome.tabs.query({}));
    if (!aba) {
      throw new Error("Abra o SCPI 9.0 antes de executar.");
    }

    const promessaExecucao = chrome.scripting.executeScript({
      target: { tabId: aba.id, allFrames: true },
      world: "MAIN",
      func: executarFaseNoFrame,
      args: [{
        fase,
        timeoutMs: 10000,
        responsavel: "GUSTAVO ALVIZI FELTRIN",
        descricao: "AQUISIÇÃO DE -- PARA VEÍCULO PLACA -- SETOR --",
        produtos,
        fornecedores,
        indiceInicial,
        abastecimentos,
        permitirViradaKm: permitirViradaKm.checked,
        indiceAbastecimentoInicial,
        indiceQuantidadeAbastecimentoInicial,
        intervaloRequisicaoMs: 1000,
        intervaloRapidoMs: 250,
        maxPaginasPorConsulta: 3,
      }],
    });
    let acompanhamentoAtivo = ["abastecimentos", "conferir_quantidades", "conferir_placas", "conferir_km"].includes(fase);
    let temporizadorProgresso = null;
    const acompanhar = async () => {
      if (!acompanhamentoAtivo) return;
      try {
        mostrarProgresso(await lerProgressoAbastecimentos(aba.id));
      } catch {
        // A execução principal continua mesmo se uma leitura de progresso falhar.
      }
      if (acompanhamentoAtivo) temporizadorProgresso = setTimeout(acompanhar, 300);
    };
    if (acompanhamentoAtivo) acompanhar();
    let resultados;
    try {
      resultados = await promessaExecucao;
    } finally {
      acompanhamentoAtivo = false;
      if (temporizadorProgresso) clearTimeout(temporizadorProgresso);
    }

    const resultado = resultados.map((item) => item.result).find((item) => item?.matched);
    if (!resultado) throw new Error("O módulo Compras não foi localizado.");
    if (fase === "abastecimentos") {
      const progresso = resultado.indiceAbastecimento ?? indiceAbastecimentoInicial;
      const progressoQuantidades = resultado.indiceQuantidadeAbastecimento
        ?? indiceQuantidadeAbastecimentoInicial;
      await chrome.storage.local.set({
        indiceAbastecimento: progresso,
        indiceQuantidadeAbastecimento: progressoQuantidades,
        centroCustoPendente: resultado.centroCustoPendente || null,
      });
      importarAbastecimentos.textContent = rotuloAbastecimentos(
        progresso,
        progressoQuantidades,
        abastecimentos.length,
      );
      mostrarCentroCustoPendente(resultado.centroCustoPendente);
      const quantidadesConcluidas = progressoQuantidades >= abastecimentos.length;
      const itensConcluidos = progresso >= abastecimentos.length;
      mostrarProgresso({
        tipo: quantidadesConcluidas ? "Concluído" : itensConcluidos ? "QTD" : "Item",
        atual: quantidadesConcluidas
          ? abastecimentos.length
          : Math.min((itensConcluidos ? progressoQuantidades : progresso) + 1, abastecimentos.length),
        total: abastecimentos.length,
        etapa: resultado.falhasAbastecimentos?.length
          ? `${resultado.falhasAbastecimentos.length} campo(s) pulado(s)`
          : resultado.paused ? "aguardando confirmação" : "processamento finalizado",
      });
    }
    if (fase === "conferir_placas") {
      await chrome.storage.local.set({
        centroCustoPendente: resultado.centroCustoPendente || null,
      });
      mostrarCentroCustoPendente(resultado.centroCustoPendente);
    }
    if (!resultado.ok) throw new Error(resultado.error || "O sistema exibiu uma tela inesperada.");

    if (fase === "produtos") {
      await chrome.storage.local.set({
        indiceProduto: resultado.indiceProduto,
        produtoPendente: resultado.produtoPendente || null,
      });
      mostrarProdutoPendente(resultado.produtoPendente);
    }
    mostrar(
      resultado.etapas.join("\n"),
      resultado.paused
        || resultado.canceled
        || resultado.finalized
        || resultado.falhasAbastecimentos?.length
        || resultado.placasNaoEncontradas?.length
        ? "aviso"
        : "sucesso",
    );
  } catch (erro) {
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  } finally {
    executando = false;
    pausado = false;
    cancelando = false;
    finalizando = false;
    pausarProcesso.disabled = true;
    pausarProcesso.textContent = "Pausar";
    finalizarProcesso.disabled = true;
    cancelarProcesso.disabled = true;
    atualizarExtensao.disabled = false;
    resetarCache.disabled = false;
    bloquearImportacao(false);
    botoes.forEach((botao) => { botao.disabled = false; });
  }
}

pausarProcesso.addEventListener("click", async () => {
  if (!executando || cancelando || finalizando) return;
  pausarProcesso.disabled = true;
  try {
    const vaiPausar = !pausado;
    if (!await enviarControle(vaiPausar ? "pausar" : null)) {
      throw new Error("Nenhuma execução está em andamento.");
    }
    pausado = vaiPausar;
    pausarProcesso.textContent = pausado ? "Continuar" : "Pausar";
    mostrar(
      pausado
        ? "Execução pausada. Confira a tela e clique em Continuar para retomar."
        : "Execução retomada.",
      "aviso",
    );
  } catch (erro) {
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  } finally {
    if (executando && !cancelando && !finalizando) pausarProcesso.disabled = false;
  }
});

finalizarProcesso.addEventListener("click", async () => {
  if (!executando || cancelando || finalizando) return;
  finalizando = true;
  pausarProcesso.disabled = true;
  finalizarProcesso.disabled = true;
  cancelarProcesso.disabled = true;
  try {
    if (!await enviarControle("finalizar")) {
      throw new Error("Nenhuma execução está em andamento.");
    }
    mostrar("Finalizando a execução e preparando o relatório parcial...", "aviso");
  } catch (erro) {
    finalizando = false;
    if (executando) {
      pausarProcesso.disabled = false;
      finalizarProcesso.disabled = false;
      cancelarProcesso.disabled = false;
    }
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  }
});

cancelarProcesso.addEventListener("click", async () => {
  if (!executando || cancelando || finalizando) return;
  cancelando = true;
  pausarProcesso.disabled = true;
  finalizarProcesso.disabled = true;
  cancelarProcesso.disabled = true;
  try {
    if (!await enviarControle("cancelar")) {
      throw new Error("Nenhuma execução está em andamento.");
    }
    mostrar("Cancelando a execução atual...", "aviso");
  } catch (erro) {
    cancelando = false;
    if (executando) {
      pausarProcesso.disabled = false;
      finalizarProcesso.disabled = false;
      cancelarProcesso.disabled = false;
    }
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  }
});

atualizarExtensao.addEventListener("click", async () => {
  if (executando) return;
  atualizarExtensao.disabled = true;
  resetarCache.disabled = true;
  botoes.forEach((botao) => { botao.disabled = true; });
  try {
    if (await existeExecucaoNaAba()) {
      throw new Error("Cancele ou aguarde a execução atual antes de atualizar a extensão.");
    }
    const confirmou = globalThis.confirm(
      "Atualizar a extensão agora? Os dados locais, o XLSX e o progresso anteriores serão apagados. Isso não altera dados do SCPI.",
    );
    if (!confirmou) return;
    mostrar("Limpando os dados antigos e atualizando a extensão...", "aviso");
    await limparDadosExtensao();
    chrome.runtime.reload();
  } catch (erro) {
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  } finally {
    atualizarExtensao.disabled = false;
    resetarCache.disabled = false;
    botoes.forEach((botao) => { botao.disabled = false; });
  }
});

resetarCache.addEventListener("click", async () => {
  if (executando) return;
  resetarCache.disabled = true;
  botoes.forEach((botao) => { botao.disabled = true; });
  try {
    if (await existeExecucaoNaAba()) {
      throw new Error("Cancele ou aguarde a execução atual antes de resetar os dados.");
    }
    const confirmou = globalThis.confirm(
      "Apagar produtos, fornecedores, progresso e itens pendentes da extensão? Isso não altera dados do SCPI.",
    );
    if (!confirmou) return;
    await limparDadosExtensao();
    mostrar("Dados da extensão apagados. Você pode atualizar o SCPI e começar do zero.", "sucesso");
  } catch (erro) {
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  } finally {
    resetarCache.disabled = false;
    botoes.forEach((botao) => { botao.disabled = false; });
  }
});

arquivoAbastecimentos.addEventListener("change", async () => {
  temAbastecimentos = false;
  bloquearImportacao(true);
  mostrarCentroCustoPendente(null);
  try {
    const arquivo = arquivoAbastecimentos.files?.[0];
    const abastecimentos = await lerAbastecimentosXlsx(arquivo);
    const placas = new Set(abastecimentos.map((item) => item.placa));
    await chrome.storage.local.set({
      abastecimentosSaida: abastecimentos,
      indiceAbastecimento: 0,
      indiceQuantidadeAbastecimento: 0,
      centroCustoPendente: null,
      arquivoAbastecimentos: arquivo.name,
    });
    temAbastecimentos = true;
    importarAbastecimentos.textContent = `Preencher ${abastecimentos.length} abastecimentos`;
    mostrar(`${arquivo.name}: ${abastecimentos.length} lançamento(s), ${placas.size} placa(s). Confira a Requisição de Saída antes de começar.`, "sucesso");
  } catch (erro) {
    mostrar(erro instanceof Error ? erro.message : String(erro), "erro");
  } finally {
    bloquearImportacao(false);
  }
});

permitirViradaKm.addEventListener("change", async () => {
  await chrome.storage.local.set({ permitirViradaKm: permitirViradaKm.checked });
  mostrar(
    permitirViradaKm.checked
      ? "Virada de velocímetro ativada: KM menor será inserido e confirmado com Sim."
      : "Modo conservador ativado: KM menor que o anterior será mantido sem alteração.",
    "sucesso",
  );
});

importarAbastecimentos.addEventListener("click", () => executar("abastecimentos"));
conferirQuantidades.addEventListener("click", () => executar("conferir_quantidades"));
conferirPlacas.addEventListener("click", () => executar("conferir_placas"));
conferirKm.addEventListener("click", () => executar("conferir_km"));

confirmarCentroCusto.addEventListener("click", async () => {
  const dados = await chrome.storage.local.get(["centroCustoPendente"]);
  if (!dados.centroCustoPendente) return;
  const fase = dados.centroCustoPendente.fase || "abastecimentos";
  await chrome.storage.local.set({ centroCustoPendente: null });
  mostrarCentroCustoPendente(null);
  await executar(fase);
});

confirmarProduto.addEventListener("click", async () => {
  const dados = await chrome.storage.local.get(["indiceProduto", "produtoPendente"]);
  if (!dados.produtoPendente) return;
  await chrome.storage.local.set({
    indiceProduto: (dados.indiceProduto || 0) + 1,
    produtoPendente: null,
  });
  mostrarProdutoPendente(null);
  await executar("produtos");
});

chrome.storage.local.get([
  "produtoPendente",
  "centroCustoPendente",
  "abastecimentosSaida",
  "indiceAbastecimento",
  "indiceQuantidadeAbastecimento",
  "arquivoAbastecimentos",
  "permitirViradaKm",
]).then((dados) => {
  const { produtoPendente, centroCustoPendente, abastecimentosSaida = [] } = dados;
  mostrarProdutoPendente(produtoPendente);
  mostrarCentroCustoPendente(centroCustoPendente);
  permitirViradaKm.checked = dados.permitirViradaKm !== false;
  const dadosComProduto = abastecimentosSaida.every((item) => String(item?.produto || "").trim());
  temAbastecimentos = abastecimentosSaida.length > 0 && dadosComProduto;
  if (temAbastecimentos) {
    importarAbastecimentos.textContent = rotuloAbastecimentos(
      dados.indiceAbastecimento || 0,
      dados.indiceQuantidadeAbastecimento || 0,
      abastecimentosSaida.length,
    );
  }
  bloquearImportacao(false);
  if (produtoPendente) {
    abrirPainel("solicitacoes");
    mostrar(`Pausa mantida em: ${produtoPendente.description}.`, "aviso");
  } else if (centroCustoPendente) {
    abrirPainel("abastecimentos");
    mostrar(`Escolha manualmente o centro de custo da placa ${centroCustoPendente.placa} e confirme no SCPI.`, "aviso");
  } else if (temAbastecimentos) mostrar(`${dados.arquivoAbastecimentos || "XLSX"}: dados prontos para continuar.`, "sucesso");
  else if (abastecimentosSaida.length) mostrar("Selecione novamente o XLSX para carregar também a coluna Combustível.", "aviso");
});

botoes.forEach((botao) => {
  botao.addEventListener("click", () => executar(botao.dataset.fase));
});
