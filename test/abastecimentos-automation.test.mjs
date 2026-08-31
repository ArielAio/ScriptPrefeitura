import test from "node:test";
import assert from "node:assert/strict";
import { executarFaseNoFrame } from "../automation.js";

function elemento(rotulo = "", atributos = {}) {
  return {
    textContent: rotulo,
    innerText: rotulo,
    className: atributos.className || "",
    children: [],
    hidden: false,
    disabled: atributos.disabled ?? false,
    visible: atributos.visible ?? true,
    value: atributos.value || "",
    attributes: { ...atributos },
    getAttribute(nome) {
      if (nome === "aria-disabled") return this.disabled ? "true" : null;
      return this.attributes[nome] ?? null;
    },
    getBoundingClientRect() {
      return this.visible
        ? (atributos.rect || { left: 100, right: 200, top: 100, width: 100, height: 30 })
        : { left: 0, right: 0, top: 0, width: 0, height: 0 };
    },
    scrollIntoView() {},
    focus() {},
    blur() {},
    dispatchEvent() {},
    click() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function paginaAbastecimentos(
  centrosPorPlaca = {},
  produtosPedido = ["ÓLEO DIESEL S-10", "ETANOL HIDRATADO", "GASOLINA COMUM"],
  pedidoAbertoInicialmente = false,
  consultasVaziasAntesDoProduto = 0,
  itensIniciais = [],
  consultasVaziasAntesDoCentro = 0,
  pedirConfirmacaoDeVirada = false,
  {
    falhasAntesDoEditor = 0,
    editorSemRole = false,
    bloquearEditorQtd = false,
    bloquearEditorAtual = false,
    modalKmInicial = false,
    sujarGradeNaPrimeiraQtd = false,
    datasetForaDeEdicaoNaPrimeiraAtual = false,
    avisoKmMuitoAltaAoEditarAtual = false,
    bloquearEditorAtualIndices = [],
    falhasAntesDoMenuProduto = 0,
    ocultarPlacaNaDescricaoCentro = false,
    ignorarCliqueNaLinha = false,
    ajaxLentoAoSelecionarCentro = false,
    ajaxErrorAoConfirmarCentro = false,
    messageDlgAoCorrigirPlacaComVirada = false,
  } = {},
) {
  const cliques = [];
  const edicoes = [];
  const produtosItens = itensIniciais.map((item) => item.produto || "ETANOL HIDRATADO");
  const itens = itensIniciais.map(({ produto: _produto, ...item }) => ({ ...item }));
  const produtosConfirmados = [];
  let lado = "esquerda";
  let campoEditando = null;
  let textoInserido = false;
  let produtoSelecionado = null;
  let consultasProduto = 0;
  let falhasEditorRestantes = falhasAntesDoEditor;
  let gradeSujaDisparada = false;
  let datasetForaDeEdicaoDisparado = false;
  let falhasMenuProdutoRestantes = falhasAntesDoMenuProduto;
  let indiceSelecionado = Math.max(0, itens.length - 1);
  let ajaxCentroEmAndamento = false;

  const solicitacao = elemento("Solicitação", { "aria-level": "2" });
  const processo = elemento("Processo de Compra", { "aria-level": "2" });
  const abaItens = elemento("Itens da Saída", { role: "tab", "aria-selected": "true" });
  const f2 = elemento("F2 - Produto");
  const f3 = elemento("F3 - C.Custo");
  const novoItem = elemento("[Insert] Novo Item");
  const produtoPedido = elemento("Produto do Pedido", { visible: false });
  const opcaoPlaca = elemento("4 - Placa", { visible: false });

  const editor = elemento("", { role: "spinbutton", visible: false });
  editor.select = () => {};
  editor.dispatchEvent = (evento) => {
    if (evento.type === "input") textoInserido = true;
  };
  const abrirCampoEditor = (indice, campo) => {
    campoEditando = { indice, campo };
    editor.value = String(itens[indice][campo] ?? "").replace(".", ",");
    editor.visible = true;
    textoInserido = false;
  };
  const confirmarEdicao = () => {
    if (!campoEditando || !textoInserido) return;
    if (campoEditando.campo === "qtd" && sujarGradeNaPrimeiraQtd && !gradeSujaDisparada) {
      gradeSujaDisparada = true;
      globalThis.alert?.("Grid is in dirty state. No more updates can be applied.");
      editor.visible = false;
      campoEditando = null;
      textoInserido = false;
      return;
    }
    if (
      campoEditando.campo === "atual"
      && datasetForaDeEdicaoNaPrimeiraAtual
      && !datasetForaDeEdicaoDisparado
    ) {
      datasetForaDeEdicaoDisparado = true;
      globalThis.alert?.("cdslCadReq: Dataset not in edit or insert mode.");
      editor.visible = false;
      campoEditando = null;
      textoInserido = false;
      return;
    }
    itens[campoEditando.indice][campoEditando.campo] = editor.value === ""
      ? ""
      : Number(editor.value.replace(",", "."));
    edicoes.push(campoEditando.campo);
    if (campoEditando.campo === "atual" && pedirConfirmacaoDeVirada && editor.value !== "") modalKm.visible = true;
    if (campoEditando.campo === "atual" && avisoKmMuitoAltaAoEditarAtual && editor.value !== "") {
      modalKmMuitoAlta.visible = true;
    }
    editor.visible = false;
    campoEditando = null;
    textoInserido = false;
  };

  const grade = elemento("");
  grade.scrollWidth = 2000;
  grade.clientWidth = 800;
  grade.scrollLeft = 0;
  grade.dispatchEvent = () => { lado = grade.scrollLeft > 0 ? "direita" : "esquerda"; };
  const cabecalhosEsquerda = ["Descrição do Produto/Serviço", "QTD", "C.Custo", "Descrição do Centro de Custo"];
  const cabecalhosDireita = ["Placa (F9)", "Veículo", "Tipo", "Anterior", "Atual", "Marca"];
  grade.querySelectorAll = (seletor) => {
    if (seletor === ".x-column-header, th") {
      return (lado === "esquerda" ? cabecalhosEsquerda : cabecalhosDireita).map((nome) => elemento(nome));
    }
    if (seletor.includes(".x-grid-view")) return [];
    if (seletor !== ".x-grid-item, tr[role='row']") return [];
    return itens.map((item, indice) => {
      const valores = lado === "esquerda"
        ? [
          produtosItens[indice] || "ETANOL HIDRATADO",
          item.qtd,
          item.custo || "",
          item.placa && !ocultarPlacaNaDescricaoCentro ? `VEÍCULO PLACA ${item.placa}` : "",
        ]
        : [item.placa || "", "VEÍCULO", "Hodômetro", item.anterior || 0, item.atual ?? "", "Bandeira Branca"];
      const celulas = valores.map((valor, coluna) => {
        const celula = elemento(String(valor));
        celula.dispatchEvent = (evento) => {
          if (["mousedown", "click"].includes(evento.type)) indiceSelecionado = indice;
          if (evento.type === "dblclick") {
            const campo = lado === "esquerda" && coluna === 1 ? "qtd" : lado === "direita" && coluna === 4 ? "atual" : null;
            if (campo) {
              if (campo === "qtd" && bloquearEditorQtd) return;
              if (campo === "atual" && (bloquearEditorAtual || bloquearEditorAtualIndices.includes(indice))) return;
              if (falhasEditorRestantes > 0) {
                falhasEditorRestantes -= 1;
                return;
              }
              abrirCampoEditor(indice, campo);
            }
          }
          if (evento.type === "click") confirmarEdicao();
        };
        celula.click = confirmarEdicao;
        return celula;
      });
      const linha = elemento("");
      linha.attributes["data-recordindex"] = String(indice);
      Object.defineProperty(linha, "className", {
        get: () => indice === indiceSelecionado ? "x-grid-item-selected" : "",
      });
      const getAttributeOriginal = linha.getAttribute.bind(linha);
      linha.getAttribute = (nome) => nome === "aria-selected"
        ? (indice === indiceSelecionado ? "true" : "false")
        : getAttributeOriginal(nome);
      Object.defineProperty(linha, "innerText", {
        get: () => valores.join(" "),
      });
      linha.click = () => {
        if (!ignorarCliqueNaLinha) indiceSelecionado = indice;
      };
      linha.querySelectorAll = (seletorCelulas) => seletorCelulas === ".x-grid-cell, td" ? celulas : [];
      return linha;
    });
  };

  const janelaPedido = elemento("Pesquisa Pedido de Compra", {
    role: "dialog",
    visible: pedidoAbertoInicialmente,
  });
  const confirmarPedido = elemento("Confirmar", { visible: pedidoAbertoInicialmente });
  const cabecalhosPedido = ["Item", "Código", "Descrição do Produto/Serviço", "Unidade"]
    .map((nome) => elemento(nome));
  const alvosPedido = [];
  const linhasPedido = produtosPedido.map((produto, indice) => {
    const valores = [indice + 1, `012.004.00${indice + 1}`, produto, "LT"];
    const celulas = valores.map((valor) => elemento(String(valor)));
    const linha = elemento(valores.join(" "));
    linha.querySelectorAll = (seletor) =>
      ["[role='gridcell']", ".x-grid-cell, td, [role='gridcell']"].includes(seletor) ? celulas : [];
    linha.click = () => {
      produtoSelecionado = produto;
      confirmarPedido.disabled = false;
    };
    const alvo = elemento(produto);
    alvo.click = linha.click;
    alvosPedido.push(alvo);
    return linha;
  });
  confirmarPedido.click = () => {
    cliques.push("confirmar produto do pedido");
    produtosConfirmados.push(produtoSelecionado);
    itens.push({ qtd: 1791, placa: "", atual: "" });
    produtosItens.push(produtoSelecionado);
    janelaPedido.visible = false;
    confirmarPedido.visible = false;
    produtoSelecionado = null;
  };
  janelaPedido.querySelectorAll = (seletor) => {
    if (seletor === ".x-grid-cell-inner") {
      consultasProduto += 1;
      return consultasProduto <= consultasVaziasAntesDoProduto ? [] : alvosPedido;
    }
    if (seletor === ".x-column-header, th, [role='columnheader']") return cabecalhosPedido;
    if (seletor === "[role='row']") return linhasPedido;
    if (seletor === ".x-grid-item") return [elemento("interno 1"), elemento("interno 2"), elemento("interno 3"), elemento("interno 4")];
    if (seletor === ".x-grid-row") return linhasPedido;
    if (seletor === "button, [role='button'], a") return [confirmarPedido];
    return [];
  };

  const janelaCentro = elemento("Pesquisa Centro de Custo", { role: "dialog", visible: false });
  const modalKm = elemento("Confirme KM Atual menor que a KM Anterior. Confirma virada de velocímetro?", {
    role: "dialog",
    visible: modalKmInicial,
  });
  const simKm = elemento("Sim");
  simKm.click = () => {
    cliques.push("sim virada de velocímetro");
    modalKm.visible = false;
  };
  const naoKm = elemento("Não");
  naoKm.click = () => {
    cliques.push("não virada de velocímetro");
    modalKm.visible = false;
  };
  modalKm.querySelectorAll = (seletor) => seletor === 'button, [role="button"], a' ? [simKm, naoKm] : [];
  const modalKmMuitoAlta = elemento("Aviso Quilometragem MUITO ALTA. Verifique !", {
    role: "dialog",
    visible: false,
  });
  const okKmMuitoAlta = elemento("OK");
  okKmMuitoAlta.click = () => {
    cliques.push("ok quilometragem muito alta");
    modalKmMuitoAlta.visible = false;
  };
  modalKmMuitoAlta.querySelectorAll = (seletor) =>
    seletor === 'button, [role="button"], a' ? [okKmMuitoAlta] : [];
  const modalAjax = elemento("Ajax Error Cannot read properties of null (reading 'parentNode')", {
    role: "alertdialog",
    visible: false,
  });
  const okAjax = elemento("OK");
  okAjax.click = () => {
    cliques.push("ok ajax error");
    modalAjax.visible = false;
  };
  modalAjax.querySelectorAll = (seletor) =>
    seletor === 'button, [role="button"], a' ? [okAjax] : [];
  const campoPesquisa = elemento("", {
    tagName: "INPUT",
    rect: { left: 30, right: 450, top: 30, width: 420, height: 30 },
  });
  const pesquisarCentro = elemento("Pesquisar", {
    rect: { left: 470, right: 570, top: 30, width: 100, height: 30 },
  });
  const confirmarCentro = elemento("Confirmar", { disabled: true });
  const cancelarCentro = elemento("Cancelar");
  let resultadosCentro = [];
  let centroSelecionado = null;
  let consultasCentro = 0;
  pesquisarCentro.click = () => {
    cliques.push(`pesquisar centro ${campoPesquisa.value}`);
    resultadosCentro = centrosPorPlaca[campoPesquisa.value]
      || [`100 VEÍCULO PLACA ${campoPesquisa.value}`];
  };
  confirmarCentro.click = () => {
    cliques.push("confirmar centro de custo");
    if (ajaxCentroEmAndamento) {
      modalAjax.visible = true;
      return;
    }
    itens[indiceSelecionado].placa = campoPesquisa.value;
    itens[indiceSelecionado].custo = centroSelecionado;
    janelaCentro.visible = false;
    opcaoPlaca.visible = false;
    if (
      messageDlgAoCorrigirPlacaComVirada
      && Number(itens[indiceSelecionado].atual) < Number(itens[indiceSelecionado].anterior)
    ) {
      globalThis.alert?.("Blocking method MessageDlg() can not be called here.");
      modalKm.visible = true;
    }
    if (ajaxErrorAoConfirmarCentro) modalAjax.visible = true;
  };
  cancelarCentro.click = () => {
    cliques.push("cancelar centro de custo");
    janelaCentro.visible = false;
    opcaoPlaca.visible = false;
  };
  janelaCentro.querySelectorAll = (seletor) => {
    if (seletor === "button, [role='button'], a") {
      return [pesquisarCentro, confirmarCentro, cancelarCentro];
    }
    if (seletor !== ".x-grid-item") return [];
    consultasCentro += 1;
    if (consultasCentro <= consultasVaziasAntesDoCentro) return [];
    return resultadosCentro.map((nome) => {
      const linha = elemento(nome);
      linha.click = () => {
        centroSelecionado = nome;
        confirmarCentro.disabled = false;
        if (ajaxLentoAoSelecionarCentro) {
          ajaxCentroEmAndamento = true;
          setTimeout(() => { ajaxCentroEmAndamento = false; }, 50);
        }
      };
      return linha;
    });
  };

  f2.click = () => {
    cliques.push("f2 produto");
    if (falhasMenuProdutoRestantes > 0) {
      falhasMenuProdutoRestantes -= 1;
      return;
    }
    produtoPedido.visible = true;
  };
  novoItem.click = () => { cliques.push("novo item"); };
  produtoPedido.click = () => {
    cliques.push("produto do pedido");
    produtoPedido.visible = false;
    janelaPedido.visible = true;
    confirmarPedido.visible = true;
    confirmarPedido.disabled = true;
  };
  f3.click = () => {
    cliques.push("f3 centro de custo");
    janelaCentro.visible = true;
    opcaoPlaca.visible = true;
    resultadosCentro = [];
    confirmarCentro.disabled = true;
  };
  opcaoPlaca.click = () => { cliques.push("pesquisa por placa"); };

  const todosBotoes = [
    f2,
    f3,
    novoItem,
    pesquisarCentro,
    confirmarCentro,
    cancelarCentro,
    confirmarPedido,
  ];
  return {
    cliques,
    edicoes,
    itens,
    produtosConfirmados,
    abrirCampoEditor,
    ajaxCarregando: () => ajaxCentroEmAndamento,
    querySelectorAll(seletor) {
      if (seletor === 'tr[role="row"]') return [solicitacao, processo];
      if (seletor === '[role="grid"], .x-grid, table') return [grade];
      if (seletor === 'button, [role="button"], a') return todosBotoes;
      if (seletor === "body *") return [produtoPedido, opcaoPlaca];
      if (seletor === '[role="tab"]') return [abaItens];
      if (seletor === '[role="dialog"]' || seletor === '[role="dialog"], [role="alertdialog"]') {
        return [janelaPedido, janelaCentro, modalKm, modalKmMuitoAlta, modalAjax];
      }
      if ([".x-window", ".x-window, .x-message-box"].includes(seletor)) return [modalAjax];
      if (seletor === 'input[role="spinbutton"]') return editorSemRole ? [] : [editor];
      if (seletor === ".x-grid-editor input, .x-editor input") return editorSemRole ? [editor] : [];
      if (seletor === "input") return [campoPesquisa, editor];
      if (seletor.includes('[role="alert"]')) return [];
      return [];
    },
    execCommand(comando, _interface, valor) {
      if (comando !== "insertText" || !editor.visible) return false;
      editor.value = valor;
      textoInserido = true;
      return true;
    },
  };
}

globalThis.getComputedStyle = (item) => ({
  display: item.visible ? "block" : "none",
  visibility: item.visible ? "visible" : "hidden",
});

test("preenche litros, centro de custo e maior KM sem salvar", async () => {
  const pagina = paginaAbastecimentos();
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9876", litros: 20, km: 300, produto: "DIESEL" },
      { placa: "ABC1D23", litros: 15, km: 120, produto: "GASOLINA" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceAbastecimento, 3);
  assert.deepEqual(pagina.itens, [
    { qtd: 14, placa: "ABC1D23", atual: 120, custo: "100 VEÍCULO PLACA ABC1D23" },
    { qtd: 20, placa: "XYZ9876", atual: 300, custo: "100 VEÍCULO PLACA XYZ9876" },
    { qtd: 15, placa: "ABC1D23", atual: 120, custo: "100 VEÍCULO PLACA ABC1D23" },
  ]);
  assert.equal(pagina.cliques.filter((item) => item === "confirmar produto do pedido").length, 3);
  assert.equal(pagina.cliques.filter((item) => item === "novo item").length, 2);
  assert.deepEqual(pagina.produtosConfirmados, [
    "ETANOL HIDRATADO",
    "ÓLEO DIESEL S-10",
    "GASOLINA COMUM",
  ]);
  assert.deepEqual(pagina.edicoes, ["atual", "atual", "atual", "qtd", "qtd", "qtd"]);
  assert.equal(pagina.cliques.includes("salvar"), false);
});

test("seleciona a linha correta também na primeira importação completa", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 1, placa: "ERR0A00", atual: "", anterior: 100 },
      { qtd: 1, placa: "ERR0B00", atual: "", anterior: 200 },
      { qtd: 1, placa: "ERR0C00", atual: "", anterior: 300 },
    ],
    0,
    false,
    { ignorarCliqueNaLinha: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "UFG8C56", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "UDP0D49", litros: 21, km: 220, produto: "ETANOL HIDRATADO" },
      { placa: "QSQ1D27", litros: 18, km: 320, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.deepEqual(pagina.itens.map((item) => item.placa), ["UFG8C56", "UDP0D49", "QSQ1D27"]);
});

test("aguarda a seleção Ajax do centro de custo antes de confirmar", async () => {
  const pagina = paginaAbastecimentos(
    { UFG8C56: ["204 VOLKSWAGEN POLO (UFG8C56)"] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ERR0A00", atual: 120 }],
    0,
    false,
    { ajaxLentoAoSelecionarCentro: true },
  );
  globalThis.document = pagina;
  globalThis.Ext = { Ajax: { isLoading: pagina.ajaxCarregando } };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "conferir_placas",
      intervaloRequisicaoMs: 0,
      timeoutMs: 300,
      abastecimentos: [
        { placa: "UFG8C56", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.equal(pagina.itens[0].placa, "UFG8C56");
    assert.equal(pagina.cliques.includes("ok ajax error"), false);
  } finally {
    delete globalThis.Ext;
  }
});

test("fecha Ajax Error e interrompe a operação sem confirmar sucesso", async () => {
  const pagina = paginaAbastecimentos(
    { UFG8C56: ["204 VOLKSWAGEN POLO (UFG8C56)"] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ERR0A00", atual: 120 }],
    0,
    false,
    { ajaxErrorAoConfirmarCentro: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_placas",
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "UFG8C56", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, false);
  assert.equal(pagina.itens[0].placa, "UFG8C56");
  assert.equal(pagina.cliques.includes("ok ajax error"), true);
  assert.match(resultado.error, /operação atual não foi confirmada/);
  assert.match(resultado.etapas.join("\n"), /Ajax Error fechado; a execução será interrompida/);
});

test("pausa sem escolher quando a placa possui centros de custo duplicados", async () => {
  const pagina = paginaAbastecimentos({
    ABC1D23: ["100 VEÍCULO PLACA ABC1D23", "200 RESERVA PLACA ABC1D23"],
  });
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [{ placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" }],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.equal(resultado.indiceAbastecimento, 0);
  assert.equal(resultado.centroCustoPendente.placa, "ABC1D23");
  assert.equal(resultado.centroCustoPendente.opcoes.length, 2);
  assert.equal(pagina.itens[0].qtd, 1791);
  assert.equal(resultado.indiceQuantidadeAbastecimento, 0);
  assert.equal(pagina.itens[0].placa, "");
  assert.equal(pagina.cliques.includes("confirmar centro de custo"), false);
});

test("retoma pela pesquisa do pedido que já ficou aberta e seleciona o produto do XLSX", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ÓLEO DIESEL S-10", "ETANOL COMUM"],
    true,
    2,
  );
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 500,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.deepEqual(pagina.produtosConfirmados, ["ETANOL COMUM"]);
  assert.equal(pagina.cliques.includes("f2 produto"), false);
  assert.equal(pagina.cliques.includes("produto do pedido"), false);
});

test("retoma o primeiro abastecimento que já está na grade após uma pausa", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "", atual: "" }],
  );
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceAbastecimento, 1);
  assert.equal(pagina.cliques.includes("f2 produto"), false);
  assert.deepEqual(pagina.itens, [
    { qtd: 14, placa: "ABC1D23", atual: 120, custo: "100 VEÍCULO PLACA ABC1D23" },
  ]);
});

test("recusa retomar quando a grade pertence a outro combustível", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO", "ÓLEO DIESEL S-10"],
    false,
    0,
    [{ qtd: 14, placa: "ABC1D23", atual: 120, produto: "ÓLEO DIESEL S-10" }],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    indiceAbastecimentoInicial: 1,
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /LINHA_INCOMPATIVEL.*DIESEL.*ETANOL/);
  assert.deepEqual(pagina.edicoes, []);
});

test("recusa QTD quando a ordem das placas mudou", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 10, placa: "XYZ9Z99", atual: 200 },
      { qtd: 20, placa: "ABC1D23", atual: 100 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    indiceAbastecimentoInicial: 2,
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 10, km: 100, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 200, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /LINHA_INCOMPATIVEL.*item 1 pertence à placa XYZ9Z99/);
  assert.deepEqual(pagina.edicoes, []);
});

test("repete F2 Produto quando o SCPI ignora a primeira abertura do menu", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { falhasAntesDoMenuProduto: 1 },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 1200,
    abastecimentos: [
      { placa: "UDP0D49", litros: 21, km: 43745, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.cliques.filter((item) => item === "f2 produto").length, 2);
  assert.equal(pagina.itens[0].atual, 43745);
});

test("aguarda a placa aparecer na pesquisa de centro de custo", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    2,
  );
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 500,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceAbastecimento, 1);
  assert.equal(pagina.itens[0].placa, "ABC1D23");
});

test("pausa sem clicar quando o SCPI pede confirmação de virada", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    true,
  );
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.equal(resultado.indiceAbastecimento, 0);
  assert.equal(pagina.itens[0].atual, 120);
  assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
  assert.equal(pagina.cliques.includes("não virada de velocímetro"), false);
  assert.match(resultado.etapas.join("\n"), /Pausa: .*Escolha Sim ou Não/);
});

test("insere KM menor e pausa para a decisão humana de virada", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ABC1D23", atual: "", anterior: 400 }],
    0,
    true,
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 300, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.equal(pagina.itens[0].atual, 300);
  assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
  assert.equal(pagina.cliques.includes("não virada de velocímetro"), false);
  assert.match(resultado.etapas.join("\n"), /Escolha Sim ou Não/);
});

test("mantém KM menor sem alteração quando o modo conservador está ativo", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ABC1D23", atual: "", anterior: 400 }],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    permitirViradaKm: false,
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 300, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.itens[0].atual, "");
  assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
  assert.equal(resultado.kmsIgnorados.length, 1);
  assert.match(resultado.etapas.join("\n"), /mantido sem alteração por ser menor que o anterior 400/);
});

test("permite KM do XLSX igual ao KM Anterior", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ABC1D23", atual: "", anterior: 300 }],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    permitirViradaKm: false,
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 300, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(pagina.itens[0].atual, 300);
});

test("pausa no aviso de quilometragem muito alta", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { avisoKmMuitoAltaAoEditarAtual: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 900000, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.paused, true);
  assert.equal(pagina.itens[0].atual, 900000);
  assert.equal(pagina.cliques.includes("ok quilometragem muito alta"), false);
  assert.match(resultado.etapas.join("\n"), /quilometragem muito alta.*clique em OK manualmente/i);
});

test("mantém modal de virada pendente para decisão humana", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ABC1D23", atual: 300, anterior: 400 }],
    0,
    false,
    { bloquearEditorAtual: true, modalKmInicial: true },
  );
  globalThis.document = pagina;
  const colunas = ["placa", "veiculo", "tipo", "anterior", "atual", "marca"]
    .map((dataIndex) => ({ dataIndex, text: dataIndex }));
  const view = {
    getEl: () => ({ dom: { contains: () => true } }),
    getRecord: () => ({
      set(campo, valor) {
        pagina.itens[0][campo] = valor ?? "";
      },
    }),
    refreshNode() {},
  };
  globalThis.Ext = {
    ComponentQuery: { query: () => [{ getView: () => view, getVisibleColumnManager: () => ({ getColumns: () => colunas }) }] },
  };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "abastecimentos",
      intervaloRequisicaoMs: 0,
      timeoutMs: 150,
      abastecimentos: [
        { placa: "ABC1D23", litros: 14, km: 300, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.equal(resultado.paused, true);
    assert.equal(pagina.itens[0].atual, 300);
    assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
    assert.equal(pagina.cliques.includes("não virada de velocímetro"), false);
  } finally {
    delete globalThis.Ext;
  }
});

test("repete a abertura do editor e aceita o campo ExtJS sem role spinbutton", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { falhasAntesDoEditor: 1, editorSemRole: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 600,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceAbastecimento, 1);
  assert.equal(pagina.itens[0].qtd, 14);
});

test("grava KM e QTD diretamente pelo ExtJS quando as células não abrem editor", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 1642, placa: "ABC1D23", atual: "", anterior: 0 }],
    0,
    false,
    { bloquearEditorQtd: true, bloquearEditorAtual: true },
  );
  globalThis.document = pagina;
  const colunas = [
    ["Descrição do Produto/Serviço", "descricao"],
    ["QTD", "qtd"],
    ["C.Custo", "custo"],
    ["Descrição do Centro de Custo", "descricaoCusto"],
    ["Placa (F9)", "placa"],
    ["Veículo", "veiculo"],
    ["Tipo", "tipo"],
    ["Anterior", "anterior"],
    ["Atual", "atual"],
    ["Marca", "marca"],
  ].map(([text, dataIndex]) => ({ text, dataIndex }));
  const transacoes = [];
  const servidor = { ...pagina.itens[0] };
  const registroExt = {
    campoAlterado: null,
    beginEdit() {
      transacoes.push("begin");
    },
    set(campo, valor) {
      this.campoAlterado = campo;
      transacoes.push(`set:${campo}:${valor}`);
      pagina.itens[0][campo] = valor;
    },
    endEdit(silencioso, campos) {
      transacoes.push(`end:${silencioso}:${campos.join(",")}`);
      pagina.itens[0][this.campoAlterado] = servidor[this.campoAlterado];
    },
  };
  const view = {
    getEl: () => ({ dom: { contains: () => true } }),
    getRecord: () => registroExt,
    refreshNode() {},
  };
  let chamadasEditorInseguro = 0;
  const eventosEdicao = [];
  const plugin = {
    cancelEdit() {},
    startEditByPosition() {
      chamadasEditorInseguro += 1;
      throw new Error("Cannot read properties of null (reading 'value')");
    },
    completeEdit() {
      chamadasEditorInseguro += 1;
      throw new Error("Cannot read properties of null (reading 'style')");
    },
    fireEvent(nome, _plugin, contexto) {
      eventosEdicao.push(nome);
      if (nome === "edit") {
        servidor[contexto.field] = contexto.value;
        pagina.itens[0][contexto.field] = contexto.value;
      }
      return true;
    },
  };
  let pluginAtivo = plugin;
  globalThis.Ext = {
    ComponentQuery: {
      query: () => [{
        getView: () => view,
        findPlugin: () => pluginAtivo,
        getPlugins: () => pluginAtivo ? [pluginAtivo] : [],
        getVisibleColumnManager: () => ({ getColumns: () => colunas }),
      }],
    },
  };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "abastecimentos",
      intervaloRequisicaoMs: 0,
      timeoutMs: 150,
      abastecimentos: [
        { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.equal(pagina.itens[0].placa, "ABC1D23");
    assert.equal(pagina.itens[0].qtd, 14);
    assert.equal(pagina.itens[0].atual, 120);
    assert.deepEqual(transacoes, [
      "begin",
      "set:atual:120",
      "end:false:atual",
      "begin",
      "set:qtd:14",
      "end:false:qtd",
    ]);
    assert.equal(chamadasEditorInseguro, 0);
    assert.deepEqual(eventosEdicao, [
      "beforeedit", "validateedit", "edit",
      "beforeedit", "validateedit", "edit",
    ]);

    pluginAtivo = null;
    pagina.itens[0].atual = "";
    pagina.itens[0].qtd = 1642;
    servidor.atual = "";
    servidor.qtd = 1642;
    const semPlugin = await executarFaseNoFrame({
      fase: "abastecimentos",
      intervaloRequisicaoMs: 0,
      timeoutMs: 150,
      abastecimentos: [
        { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      ],
    });
    assert.equal(semPlugin.ok, true, semPlugin.error);
    assert.equal(semPlugin.partial, true);
    assert.equal(semPlugin.falhasAbastecimentos.length, 2);
    assert.equal(pagina.itens[0].atual, "");
    assert.equal(pagina.itens[0].qtd, 1642);
    assert.equal(transacoes.length, 6);
  } finally {
    delete globalThis.Ext;
  }
});

test("atualiza várias linhas sem reabrir o editor destruído pelo SCPI", async () => {
  const abastecimentos = [
    { placa: "CDM7I91", litros: 10, km: 343596, produto: "ETANOL HIDRATADO" },
    { placa: "QSQ1D27", litros: 20, km: 49918, produto: "ETANOL HIDRATADO" },
    { placa: "FXJ7498", litros: 30, km: 476763, produto: "ETANOL HIDRATADO" },
  ];
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    abastecimentos.map((item) => ({
      qtd: 1642,
      placa: item.placa,
      atual: 0,
      anterior: 0,
    })),
    0,
    false,
    { bloquearEditorQtd: true, bloquearEditorAtual: true },
  );
  globalThis.document = pagina;
  const colunas = [
    ["Descrição do Produto/Serviço", "descricao"],
    ["QTD", "qtd"],
    ["C.Custo", "custo"],
    ["Descrição do Centro de Custo", "descricaoCusto"],
    ["Placa (F9)", "placa"],
    ["Veículo", "veiculo"],
    ["Tipo", "tipo"],
    ["Anterior", "anterior"],
    ["Atual", "atual"],
    ["Marca", "marca"],
  ].map(([text, dataIndex]) => ({ text, dataIndex }));
  const servidor = pagina.itens.map((item) => ({ ...item }));
  const registros = pagina.itens.map((item, indice) => ({
    indice,
    campoAlterado: null,
    beginEdit() {},
    set(campo, valor) {
      this.campoAlterado = campo;
      item[campo] = valor;
    },
    endEdit() {
      // Reproduz a resposta do uniGUI restaurando o valor do servidor.
      item[this.campoAlterado] = servidor[indice][this.campoAlterado];
    },
  }));
  const view = {
    getEl: () => ({ dom: { contains: () => true } }),
    getRecord: (linha) => registros[Number(linha.getAttribute("data-recordindex"))],
    refreshNode() {},
  };
  let chamadasEditorInseguro = 0;
  const eventosEdicao = [];
  const plugin = {
    cancelEdit() {},
    startEditByPosition() {
      chamadasEditorInseguro += 1;
      throw new Error("Cannot read properties of null (reading 'value')");
    },
    completeEdit() {
      chamadasEditorInseguro += 1;
      throw new Error("Cannot read properties of null (reading 'style')");
    },
    fireEvent(nome, _plugin, contexto) {
      eventosEdicao.push(`${nome}:${contexto.rowIdx}:${contexto.field}`);
      if (nome === "edit") {
        servidor[contexto.record.indice][contexto.field] = contexto.value;
        pagina.itens[contexto.record.indice][contexto.field] = contexto.value;
      }
      return true;
    },
  };
  globalThis.Ext = {
    ComponentQuery: {
      query: () => [{
        getView: () => view,
        findPlugin: () => plugin,
        getPlugins: () => [plugin],
        getVisibleColumnManager: () => ({ getColumns: () => colunas }),
      }],
    },
  };

  try {
    const km = await executarFaseNoFrame({
      fase: "conferir_km",
      intervaloRequisicaoMs: 0,
      timeoutMs: 150,
      abastecimentos,
    });
    assert.equal(km.ok, true, km.error);
    assert.deepEqual(pagina.itens.map((item) => item.placa), abastecimentos.map((item) => item.placa));
    assert.deepEqual(pagina.itens.map((item) => item.atual), [343596, 49918, 476763]);

    const qtd = await executarFaseNoFrame({
      fase: "conferir_quantidades",
      intervaloRequisicaoMs: 0,
      timeoutMs: 150,
      abastecimentos,
    });
    assert.equal(qtd.ok, true, qtd.error);
    assert.deepEqual(pagina.itens.map((item) => item.qtd), [10, 20, 30]);
    assert.equal(chamadasEditorInseguro, 0);
    assert.equal(eventosEdicao.filter((evento) => evento.startsWith("beforeedit:")).length, 6);
    assert.equal(eventosEdicao.filter((evento) => evento.startsWith("validateedit:")).length, 6);
    assert.equal(eventosEdicao.filter((evento) => evento.startsWith("edit:")).length, 6);
  } finally {
    delete globalThis.Ext;
  }
});

test("preenche todas as QTDs somente depois de concluir os itens retomados", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 1642, placa: "ABC1D23", atual: 120, anterior: 100 },
      { qtd: 1642, placa: "XYZ9Z99", atual: "", anterior: 200 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 200,
    indiceAbastecimentoInicial: 1,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 35, km: 220, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.itens[0].qtd, 14);
  assert.equal(pagina.itens[1].qtd, 35);
});

test("retoma diretamente da próxima QTD pendente", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ABC1D23", atual: 120, anterior: 100 },
      { qtd: 1642, placa: "XYZ9Z99", atual: 220, anterior: 200 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 200,
    indiceAbastecimentoInicial: 2,
    indiceQuantidadeAbastecimentoInicial: 1,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 35, km: 220, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.indiceQuantidadeAbastecimento, 2);
  assert.equal(pagina.itens[0].qtd, 14);
  assert.equal(pagina.itens[1].qtd, 35);
  assert.deepEqual(pagina.edicoes, ["qtd"]);
});

test("aguarda a grade sair do dirty state e repete a QTD sem alerta nativo", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 1642, placa: "", atual: "", anterior: 0 }],
    0,
    false,
    { sujarGradeNaPrimeiraQtd: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 400,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.itens[0].qtd, 14);
  assert.match(resultado.etapas.join("\n"), /ainda estava atualizando a grade/);
  assert.equal(globalThis.alert, undefined);
});

test("reabre o KM quando o dataset ainda não entrou em modo de edição", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { datasetForaDeEdicaoNaPrimeiraAtual: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 500,
    abastecimentos: [
      { placa: "UFG8C56", litros: 6, km: 40933, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.itens[0].atual, 40933);
  assert.match(resultado.etapas.join("\n"), /dataset do SCPI ainda não estava em modo de edição/);
  assert.equal(globalThis.alert, undefined);
});

test("registra e pula a QTD quando ela não aceita edição", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 1642, placa: "", atual: "", anterior: 0 }],
    0,
    false,
    { bloquearEditorQtd: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.falhasAbastecimentos.length, 1);
  assert.equal(resultado.falhasAbastecimentos[0].etapa, "QTD");
  assert.match(resultado.falhasAbastecimentos[0].erro, /Valor esperado em QTD do item 1: 14/);
  assert.match(resultado.falhasAbastecimentos[0].erro, /valor exibido: 1642|valor exibido: 1\.642/);
  assert.match(resultado.etapas.join("\n"), /QTD 1\/1 não pôde ser preenchida e foi pulada/);
});

test("registra e pula o KM quando a edição falha", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { bloquearEditorAtual: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.falhasAbastecimentos.length, 1);
  assert.equal(resultado.falhasAbastecimentos[0].placa, "ABC1D23");
  assert.equal(resultado.falhasAbastecimentos[0].etapa, "KM Atual");
  assert.match(resultado.falhasAbastecimentos[0].erro, /Valor esperado em KM Atual do item 1: 120/);
  assert.match(resultado.etapas.join("\n"), /foi pulado/);
});

test("pula um KM irrecuperável e continua os itens e as QTDs", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [],
    0,
    false,
    { bloquearEditorAtualIndices: [0] },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "abastecimentos",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "UDP0D49", litros: 21, km: 43745, produto: "ETANOL HIDRATADO" },
      { placa: "ABC1D23", litros: 14, km: 50000, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.indiceAbastecimento, 0);
  assert.equal(resultado.indiceQuantidadeAbastecimento, 2);
  assert.equal(resultado.partial, true);
  assert.equal(resultado.falhasAbastecimentos.length, 1);
  assert.equal(pagina.itens[0].atual, "");
  assert.equal(pagina.itens[1].atual, 50000);
  assert.equal(pagina.itens[0].qtd, 21);
  assert.equal(pagina.itens[1].qtd, 14);
  assert.deepEqual(globalThis.__scriptPrefeituraProgresso, {
    fase: "abastecimentos",
    tipo: "Pendências",
    atual: 1,
    total: 2,
    etapa: "1 campo(s) pulado(s)",
  });
});

test("confere todas as QTDs e corrige somente as divergentes", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 999, placa: "ABC1D23", atual: 120 },
      { qtd: 20, placa: "XYZ9Z99", atual: 220 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_quantidades",
    intervaloRequisicaoMs: 0,
    timeoutMs: 200,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 220, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.deepEqual(pagina.itens.map((item) => item.qtd), [14, 20]);
  assert.equal(resultado.relatorioConferencia.corrigidas, 1);
  assert.equal(resultado.relatorioConferencia.falhas.length, 0);
  assert.deepEqual(pagina.edicoes, ["qtd"]);
});

test("detalha item, placa, etapa e motivo de cada falha da conferência", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 999, placa: "ABC1D23", atual: 120 }],
    0,
    false,
    { bloquearEditorQtd: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_quantidades",
    intervaloRequisicaoMs: 0,
    timeoutMs: 150,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.relatorioConferencia.falhas.length, 1);
  assert.match(
    resultado.relatorioConferencia.texto,
    /Detalhes das falhas:\nItem 1 \| Placa ABC1D23 \| Etapa QTD: .*Valor esperado em QTD do item 1: 14/,
  );
});

test("verifica KM Atual e pausa na primeira confirmação de virada", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ABC1D23", anterior: 400000, atual: 400000 },
      { qtd: 20, placa: "XYZ9Z99", anterior: 300000, atual: 300000 },
    ],
    0,
    true,
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_km",
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 343596, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 250000, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.paused, true);
  assert.deepEqual(pagina.itens.map((item) => item.atual), [343596, 300000]);
  assert.equal(pagina.cliques.filter((item) => item === "sim virada de velocímetro").length, 0);
  assert.match(resultado.etapas.join("\n"), /Escolha Sim ou Não/);
});

test("verifica KM em modo conservador sem reduzir o hodômetro", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ABC1D23", anterior: 400000, atual: 400000 },
      { qtd: 20, placa: "XYZ9Z99", anterior: 200000, atual: 200000 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_km",
    permitirViradaKm: false,
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 343596, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 250000, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.deepEqual(pagina.itens.map((item) => item.atual), [400000, 250000]);
  assert.equal(resultado.relatorioConferencia.corrigidos, 1);
  assert.equal(resultado.relatorioConferencia.ignoradosPorRegra.length, 1);
  assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
});

test("pula um KM que não aceita edição e verifica os seguintes", async () => {
  const pagina = paginaAbastecimentos(
    {},
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ABC1D23", anterior: 100, atual: 100 },
      { qtd: 20, placa: "XYZ9Z99", anterior: 200, atual: 200 },
    ],
    0,
    false,
    { bloquearEditorAtualIndices: [0] },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_km",
    intervaloRequisicaoMs: 0,
    timeoutMs: 200,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 150, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 250, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(pagina.itens[0].atual, 100);
  assert.equal(pagina.itens[1].atual, 250);
  assert.equal(resultado.relatorioConferencia.corrigidos, 1);
  assert.equal(resultado.relatorioConferencia.falhas.length, 1);
  assert.equal(resultado.relatorioConferencia.falhas[0].placa, "ABC1D23");
});

test("confere placas, atualiza divergentes e relata as não encontradas", async () => {
  const pagina = paginaAbastecimentos(
    { UFG8C56: [] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ABC1D23", atual: 120 },
      { qtd: 20, placa: "ERR0A00", atual: 220 },
      { qtd: 6, placa: "ERR0B00", atual: 300 },
    ],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_placas",
    intervaloRequisicaoMs: 0,
    timeoutMs: 250,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "XYZ9Z99", litros: 20, km: 220, produto: "ETANOL HIDRATADO" },
      { placa: "UFG8C56", litros: 6, km: 300, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.deepEqual(pagina.itens.map((item) => item.placa), ["ABC1D23", "XYZ9Z99", "ERR0B00"]);
  assert.equal(resultado.relatorioConferencia.atualizadas, 1);
  assert.deepEqual(resultado.placasNaoEncontradas, [{ indice: 3, placa: "UFG8C56" }]);
  assert.match(resultado.etapas.at(-1), /UFG8C56 \(item 3\)/);
  assert.equal(pagina.cliques.includes("cancelar centro de custo"), true);
});

test("confere a coluna Placa F9 mesmo quando a descrição à esquerda não contém a placa", async () => {
  const pagina = paginaAbastecimentos(
    {
      UDP0D49: ["205 VOLKSWAGEN POLO (UDP 0D49)"],
    },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "UFG8C56", atual: 120 },
      { qtd: 21, placa: "ERR0A00", atual: 220 },
    ],
    0,
    false,
    { ocultarPlacaNaDescricaoCentro: true },
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_placas",
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
    abastecimentos: [
      { placa: "UFG8C56", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
      { placa: "UDP0D49", litros: 21, km: 220, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.deepEqual(pagina.itens.map((item) => item.placa), ["UFG8C56", "UDP0D49"]);
  assert.equal(resultado.relatorioConferencia.atualizadas, 1);
  assert.equal(resultado.relatorioConferencia.falhas.length, 0);
  assert.equal(pagina.cliques.filter((clique) => clique === "f3 centro de custo").length, 1);
});

test("corrige placas por clique sem chamar seleção ExtJS bloqueante", async () => {
  const pagina = paginaAbastecimentos(
    {
      UFG8C56: ["204 VOLKSWAGEN POLO (UFG8C56)"],
      UDP0D49: ["205 VOLKSWAGEN POLO (UDP 0D49)"],
    },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [
      { qtd: 14, placa: "ERR0A00", atual: 120 },
      { qtd: 21, placa: "ERR0B00", atual: 220 },
      { qtd: 18, placa: "MANTER0", atual: 320 },
    ],
    0,
    false,
    { ignorarCliqueNaLinha: true },
  );
  globalThis.document = pagina;
  const alertas = [];
  let selecoesDiretas = 0;
  const coluna = { getText: () => "Descrição do Produto/Serviço" };
  const view = {
    getEl: () => ({ dom: { contains: () => true } }),
    getRecord: (linha) => linha,
    getStore: () => ({ indexOf: () => 0 }),
  };
  const gradeExt = {
    getView: () => view,
    getSelectionModel: () => ({
      isSelected: () => false,
      getSelection: () => [],
      select: () => {
        selecoesDiretas += 1;
        globalThis.alert?.("Blocking method MessageDlg() can not be called here.");
      },
    }),
    getColumnManager: () => ({ getColumns: () => [coluna] }),
    getVisibleColumnManager: () => ({ getColumns: () => [coluna] }),
    getStore: () => ({ isLoading: () => false, indexOf: () => 0 }),
  };
  globalThis.alert = (mensagem) => { alertas.push(mensagem); };
  globalThis.Ext = {
    Ajax: { isLoading: () => false },
    ComponentQuery: { query: () => [gradeExt] },
  };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "conferir_placas",
      intervaloRequisicaoMs: 0,
      timeoutMs: 300,
      abastecimentos: [
        { placa: "UFG8C56", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
        { placa: "UDP0D49", litros: 21, km: 220, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.deepEqual(pagina.itens.map((item) => item.placa), ["UFG8C56", "UDP0D49", "MANTER0"]);
    assert.equal(resultado.relatorioConferencia.atualizadas, 2);
    assert.equal(resultado.relatorioConferencia.falhas.length, 0);
    assert.equal(selecoesDiretas, 0);
    assert.deepEqual(alertas, []);
  } finally {
    delete globalThis.Ext;
    delete globalThis.alert;
  }
});

test("suprime MessageDlg bloqueante e pausa na virada ao corrigir a placa", async () => {
  const pagina = paginaAbastecimentos(
    { QSQ1D27: ["198 CHEVROLET SPIN (QSQ1D27)"] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 35, placa: "", atual: 49918, anterior: 400862 }],
    0,
    false,
    { messageDlgAoCorrigirPlacaComVirada: true },
  );
  const alertas = [];
  globalThis.document = pagina;
  globalThis.alert = (mensagem) => { alertas.push(mensagem); };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "conferir_placas",
      intervaloRequisicaoMs: 0,
      timeoutMs: 300,
      abastecimentos: [
        { placa: "QSQ1D27", litros: 35, km: 49918, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.equal(pagina.itens[0].placa, "QSQ1D27");
    assert.deepEqual(alertas, []);
    assert.equal(resultado.paused, true);
    assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
    assert.equal(pagina.cliques.includes("não virada de velocímetro"), false);
    assert.match(resultado.etapas.join("\n"), /Escolha Sim ou Não/);
  } finally {
    delete globalThis.alert;
  }
});

test("suprime MessageDlg e também pausa no modo conservador", async () => {
  const pagina = paginaAbastecimentos(
    { QSQ1D27: ["198 CHEVROLET SPIN (QSQ1D27)"] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 35, placa: "", atual: 49918, anterior: 400862 }],
    0,
    false,
    { messageDlgAoCorrigirPlacaComVirada: true },
  );
  const alertas = [];
  globalThis.document = pagina;
  globalThis.alert = (mensagem) => { alertas.push(mensagem); };

  try {
    const resultado = await executarFaseNoFrame({
      fase: "conferir_placas",
      permitirViradaKm: false,
      intervaloRequisicaoMs: 0,
      timeoutMs: 300,
      abastecimentos: [
        { placa: "QSQ1D27", litros: 35, km: 49918, produto: "ETANOL HIDRATADO" },
      ],
    });

    assert.equal(resultado.ok, true, resultado.error);
    assert.equal(pagina.itens[0].placa, "QSQ1D27");
    assert.deepEqual(alertas, []);
    assert.equal(resultado.paused, true);
    assert.equal(pagina.cliques.includes("não virada de velocímetro"), false);
    assert.equal(pagina.cliques.includes("sim virada de velocímetro"), false);
    assert.match(resultado.etapas.join("\n"), /Escolha Sim ou Não/);
  } finally {
    delete globalThis.alert;
  }
});

test("pausa a conferência quando a placa possui mais de um centro de custo", async () => {
  const pagina = paginaAbastecimentos(
    { ABC1D23: ["100 VEÍCULO PLACA ABC1D23", "200 RESERVA PLACA ABC1D23"] },
    ["ETANOL HIDRATADO"],
    false,
    0,
    [{ qtd: 14, placa: "ERR0A00", atual: 120 }],
  );
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "conferir_placas",
    intervaloRequisicaoMs: 0,
    timeoutMs: 200,
    abastecimentos: [
      { placa: "ABC1D23", litros: 14, km: 120, produto: "ETANOL HIDRATADO" },
    ],
  });

  assert.equal(resultado.ok, true, resultado.error);
  assert.equal(resultado.paused, true);
  assert.equal(resultado.centroCustoPendente.fase, "conferir_placas");
  assert.equal(resultado.centroCustoPendente.opcoes.length, 2);
});
