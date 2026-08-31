import test from "node:test";
import assert from "node:assert/strict";
import { executarFaseNoFrame } from "../automation.js";

function elemento(texto, atributos = {}) {
  return {
    id: atributos.id || "",
    htmlFor: atributos.htmlFor || "",
    tagName: atributos.tagName || "DIV",
    textContent: texto,
    innerText: texto,
    className: atributos.className || "",
    children: atributos.children || [],
    title: atributos.title || "",
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
      if (atributos.rect) return this.visible ? atributos.rect : { left: 0, right: 0, top: 0, width: 0, height: 0 };
      return this.visible
        ? { left: 100, right: 200, top: 100, width: 100, height: 30 }
        : { left: 0, right: 0, top: 0, width: 0, height: 0 };
    },
    scrollIntoView() {},
    focus() {},
    blur() {},
    dispatchEvent() {},
    closest() { return atributos.closest || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    click() {},
  };
}

function paginaDoScpi(
  catalogo = ["REBITE MOLA 7/16X1", "OLEO 15W40"],
  tamanhoPagina = 20,
  catalogoFornecedores = ["47768882000101", "47843891000101", "04940445000102"],
) {
  const cliques = [];
  const requisicoes = [];
  const acoesProduto = [];
  const solicitacaoPai = elemento("Solicitação", {
    "aria-level": "2",
    "aria-expanded": "false",
  });
  const solicitacaoFilho = elemento("Solicitação", { "aria-level": "3" });
  const processoPai = elemento("Processo de Compra", {
    "aria-level": "2",
    "aria-expanded": "false",
  });
  const cotacaoFilho = elemento("Cotação", { "aria-level": "3" });

  const inserirSolicitacao = elemento("Inserir", { disabled: true, visible: false });
  const inserirCotacao = elemento("Inserir", { disabled: true, visible: false });
  const incluirSolicitacao = elemento("Incluir", { disabled: true, visible: false });
  const incluirFornecedor = elemento("Incluir", { disabled: false, visible: false });
  const salvar = elemento("Salvar", { disabled: true, visible: false });
  const cancelar = elemento("Cancelar", { disabled: true, visible: false });
  const nova = elemento("Nova", { visible: false });
  const novaCotacao = elemento("1 - Nova Cotação", { visible: false });
  const produtoBotao = elemento("Produto", { disabled: false, visible: false });
  const novoItem = elemento("[Insert] Novo Item", { disabled: false, visible: false });
  const produtoAvulso = elemento("Produto Avulso", { visible: false });
  const barraPaginacao = elemento("Página de 1", { visible: false });
  const campoPagina = elemento("", { tagName: "INPUT", visible: false, value: "1" });
  const containerPagina = elemento("", { visible: false, closest: barraPaginacao });
  containerPagina.querySelector = (seletor) => seletor === "input" ? campoPagina : null;
  const proximaPagina = elemento("", {
    disabled: true,
    visible: false,
    title: "Próxima Página",
    role: "button",
  });
  const iconeProximaPagina = elemento("", { visible: false, closest: proximaPagina });
  const paginaAnterior = elemento("", {
    disabled: true,
    visible: false,
    title: "Página Anterior",
    role: "button",
  });
  const iconePaginaAnterior = elemento("", { visible: false, closest: paginaAnterior });
  const cabecalhoProduto = elemento("Produto", { visible: false });
  const campoPesquisaProduto = elemento("", {
    tagName: "INPUT",
    visible: false,
    rect: { left: 30, right: 450, top: 30, width: 420, height: 30 },
  });
  let linhasProduto = [];
  let resultadosProduto = [];
  let paginaProduto = 0;
  let indiceItemAtual = 0;
  let produtoSelecionado = "";
  const produtosIncluidos = [];
  const quantidadesIncluidas = [];
  let indiceQuantidadeEditando = -1;
  let textoInseridoNoEditor = false;
  const editorQuantidade = elemento("", {
    tagName: "INPUT",
    role: "spinbutton",
    visible: false,
  });
  const confirmarEdicaoQuantidade = () => {
    if (indiceQuantidadeEditando < 0 || !textoInseridoNoEditor) return;
    quantidadesIncluidas[indiceQuantidadeEditando] = Number(editorQuantidade.value.replace(",", "."));
    editorQuantidade.visible = false;
    indiceQuantidadeEditando = -1;
    textoInseridoNoEditor = false;
  };
  editorQuantidade.select = () => {};
  editorQuantidade.blur = () => {};
  editorQuantidade.dispatchEvent = () => {};
  const gradeItens = elemento("", { visible: false });
  const cabecalhosItens = [
    elemento("Item"),
    elemento("Código"),
    elemento("Descrição do Produto"),
    elemento("Unidade"),
    elemento("Quantidade"),
  ];
  gradeItens.querySelectorAll = (seletor) => {
    if (seletor === ".x-column-header, th") return cabecalhosItens;
    if (seletor !== ".x-grid-item, tr[role='row']") return [];
    return produtosIncluidos.filter(Boolean).map((nome, indice) => {
      const descricaoProduto = elemento(nome);
      descricaoProduto.dispatchEvent = (evento) => {
        if (evento.type === "click") confirmarEdicaoQuantidade();
      };
      const quantidade = elemento(String(quantidadesIncluidas[indice] ?? 1));
      quantidade.dispatchEvent = (evento) => {
        if (evento.type !== "dblclick") return;
        indiceQuantidadeEditando = indice;
        textoInseridoNoEditor = false;
        editorQuantidade.value = String(quantidadesIncluidas[indice] ?? 1).replace(".", ",");
        editorQuantidade.visible = true;
      };
      const celulas = [
        elemento(String(indice + 1)),
        elemento("001"),
        descricaoProduto,
        elemento("PÇ"),
        quantidade,
      ];
      const linha = elemento(nome);
      linha.querySelectorAll = (seletorCelulas) =>
        seletorCelulas === ".x-grid-cell, td" ? celulas : [];
      return linha;
    });
  };
  const janelaProduto = elemento("Pesquisa de Produtos", { role: "dialog", visible: false });
  const pesquisarProduto = elemento("Pesquisar", {
    disabled: false,
    visible: false,
    closest: janelaProduto,
    rect: { left: 470, right: 570, top: 30, width: 100, height: 30 },
  });
  const confirmarProduto = elemento("Confirmar", { disabled: false, visible: false });

  const fornecedoresIncluidos = [];
  const fornecedoresTab = elemento("Fornecedores", {
    role: "tab",
    "aria-selected": "false",
    visible: true,
  });
  const gradeFornecedores = elemento("", { visible: false });
  const cabecalhosFornecedores = [elemento("Código"), elemento("Documento"), elemento("Fornecedor")];
  gradeFornecedores.querySelectorAll = (seletor) => {
    if (seletor === ".x-column-header, th") return cabecalhosFornecedores;
    if (seletor !== ".x-grid-item, tr[role='row']") return [];
    return fornecedoresIncluidos.map((cnpj, indice) => {
      const linha = elemento(cnpj);
      linha.querySelectorAll = (seletorCelulas) => seletorCelulas === ".x-grid-cell, td"
        ? [elemento(String(indice + 1)), elemento(cnpj), elemento(`FORNECEDOR ${indice + 1}`)]
        : [];
      return linha;
    });
  };
  const janelaFornecedor = elemento("Pesquisa Fornecedor", { role: "dialog", visible: false });
  const opcaoCnpj = elemento("4 - CNPJ/CPF", { visible: false });
  const campoPesquisaFornecedor = elemento("", {
    tagName: "INPUT",
    visible: false,
    rect: { left: 30, right: 450, top: 30, width: 420, height: 30 },
  });
  const pesquisarFornecedor = elemento("Pesquisar", {
    disabled: false,
    visible: false,
    closest: janelaFornecedor,
    rect: { left: 470, right: 570, top: 30, width: 100, height: 30 },
  });
  const confirmarFornecedor = elemento("Confirmar", { disabled: true, visible: false });
  const cabecalhosPesquisaFornecedor = [
    elemento("?"), elemento("Código"), elemento("Razão Social"), elemento("Nome Fantasia"), elemento("Documento"),
  ];
  let resultadosFornecedores = [];
  let fornecedorSelecionado = "";

  const dados = elemento("Dados da Solicitação", {
    role: "tab",
    "aria-selected": "false",
    visible: false,
  });
  const itens = elemento("Itens da Solicitação", {
    role: "tab",
    "aria-selected": "false",
    visible: false,
  });
  const cotacaoTab = elemento("Cotação Fechar", {
    role: "tab",
    "aria-selected": "false",
    visible: false,
  });
  const responsavel = elemento("", { id: "responsavel", tagName: "INPUT", visible: false });
  const descricao = elemento("", { id: "descricao", tagName: "INPUT", visible: false });
  const rotuloResponsavel = elemento("Responsável:", {
    tagName: "LABEL",
    htmlFor: "responsavel",
    visible: false,
  });
  const rotuloDescricao = elemento("Descrição:", {
    tagName: "LABEL",
    htmlFor: "descricao",
    visible: false,
  });
  const pesquisa = elemento("Pesquisa Solicitações de Materiais / Serviços", {
    role: "dialog",
    visible: false,
  });
  const solicitacoesParaCotacao = elemento("Solicitações a serem cotadas", {
    role: "dialog",
    visible: false,
  });

  solicitacaoPai.click = () => {
    cliques.push("solicitação");
    solicitacaoPai.attributes["aria-expanded"] = "true";
  };
  solicitacaoFilho.click = () => {
    cliques.push("opção solicitação");
    inserirSolicitacao.visible = true;
    inserirSolicitacao.disabled = false;
    dados.visible = true;
    dados.attributes["aria-selected"] = "true";
    itens.visible = true;
  };
  inserirSolicitacao.click = () => {
    cliques.push("inserir solicitação");
    nova.visible = true;
  };
  nova.click = () => {
    cliques.push("nova");
    nova.visible = false;
    inserirSolicitacao.disabled = true;
    salvar.visible = true;
    salvar.disabled = false;
    cancelar.visible = true;
    cancelar.disabled = false;
    responsavel.visible = true;
    descricao.visible = true;
    rotuloResponsavel.visible = true;
    rotuloDescricao.visible = true;
  };
  itens.click = () => {
    cliques.push("itens");
    dados.attributes["aria-selected"] = "false";
    itens.attributes["aria-selected"] = "true";
    gradeItens.visible = true;
    produtoBotao.visible = true;
    novoItem.visible = true;
  };
  novoItem.click = () => {
    cliques.push("novo item");
    indiceItemAtual += 1;
  };
  produtoBotao.click = () => {
    cliques.push("produto");
    produtoAvulso.visible = true;
  };
  produtoAvulso.click = () => {
    cliques.push("produto avulso");
    produtoAvulso.visible = false;
    janelaProduto.visible = true;
    pesquisarProduto.visible = true;
    campoPesquisaProduto.visible = true;
    cabecalhoProduto.visible = true;
    proximaPagina.visible = true;
    iconeProximaPagina.visible = true;
    paginaAnterior.visible = true;
    iconePaginaAnterior.visible = true;
    barraPaginacao.visible = true;
    containerPagina.visible = true;
    campoPagina.visible = true;
  };
  const atualizarLinhasProduto = () => {
    linhasProduto = resultadosProduto
      .slice(paginaProduto * tamanhoPagina, (paginaProduto + 1) * tamanhoPagina)
      .map((nome) => {
        const celula = elemento(nome);
        const linha = elemento(nome);
        linha.querySelectorAll = (seletor) => seletor === ".x-grid-cell, td" ? [celula] : [];
        linha.click = () => {
          acoesProduto.push({ acao: "selecionar", instante: Date.now() });
          produtoSelecionado = nome;
          confirmarProduto.visible = true;
        };
        return linha;
      });
    proximaPagina.disabled = (paginaProduto + 1) * tamanhoPagina >= resultadosProduto.length;
    paginaAnterior.disabled = paginaProduto === 0;
    const totalPaginas = Math.ceil(resultadosProduto.length / tamanhoPagina);
    campoPagina.value = String(totalPaginas ? paginaProduto + 1 : 0);
    barraPaginacao.textContent = `Página de ${totalPaginas}`;
    barraPaginacao.innerText = `Página de ${totalPaginas}`;
  };
  pesquisarProduto.click = () => {
    cliques.push(`pesquisar ${campoPesquisaProduto.value}`);
    requisicoes.push({ acao: "pesquisar", instante: Date.now() });
    resultadosProduto = catalogo.filter((nome) => nome.includes(campoPesquisaProduto.value));
    paginaProduto = 0;
    atualizarLinhasProduto();
  };
  proximaPagina.click = () => {
    cliques.push("próxima página");
    requisicoes.push({ acao: "próxima página", instante: Date.now() });
    paginaProduto += 1;
    atualizarLinhasProduto();
  };
  paginaAnterior.click = () => {
    cliques.push("página anterior");
    requisicoes.push({ acao: "página anterior", instante: Date.now() });
    paginaProduto -= 1;
    atualizarLinhasProduto();
  };
  confirmarProduto.click = () => {
    acoesProduto.push({ acao: "confirmar", instante: Date.now() });
    cliques.push("selecionar produto");
    produtosIncluidos[indiceItemAtual] = produtoSelecionado;
    quantidadesIncluidas[indiceItemAtual] ??= 1;
    janelaProduto.visible = false;
    pesquisarProduto.visible = false;
    campoPesquisaProduto.visible = false;
    cabecalhoProduto.visible = false;
    proximaPagina.visible = false;
    iconeProximaPagina.visible = false;
    paginaAnterior.visible = false;
    iconePaginaAnterior.visible = false;
    barraPaginacao.visible = false;
    containerPagina.visible = false;
    campoPagina.visible = false;
    confirmarProduto.visible = false;
  };
  janelaProduto.querySelector = (seletor) => {
    if (seletor === ".x-tbar-page-next") return iconeProximaPagina;
    if (seletor === ".x-tbar-page-prev") return iconePaginaAnterior;
    if (seletor === ".x-tbar-page-number") return containerPagina;
    return null;
  };
  janelaProduto.querySelectorAll = (seletor) => {
    if (seletor === ".x-column-header, th") return [cabecalhoProduto];
    if (seletor === ".x-grid-item, tr[role='row']") return linhasProduto;
    if (seletor === "button, [role='button'], a") return [confirmarProduto];
    return [];
  };
  processoPai.click = () => {
    cliques.push("processo de compra");
    processoPai.attributes["aria-expanded"] = "true";
  };
  cotacaoFilho.click = () => {
    cliques.push("cotação");
    dados.visible = false;
    itens.visible = false;
    inserirSolicitacao.visible = false;
    cotacaoTab.visible = true;
    cotacaoTab.attributes["aria-selected"] = "true";
    inserirCotacao.visible = true;
    inserirCotacao.disabled = false;
    salvar.visible = false;
    cancelar.visible = false;
  };
  inserirCotacao.click = () => {
    cliques.push("inserir cotação");
    novaCotacao.visible = true;
  };
  novaCotacao.click = () => {
    cliques.push("nova cotação");
    novaCotacao.visible = false;
    inserirCotacao.disabled = true;
    incluirSolicitacao.visible = true;
    incluirSolicitacao.disabled = false;
    solicitacoesParaCotacao.visible = true;
    salvar.visible = true;
    salvar.disabled = false;
    cancelar.visible = true;
    cancelar.disabled = false;
  };
  incluirSolicitacao.click = () => {
    cliques.push("incluir solicitação");
    solicitacoesParaCotacao.visible = false;
    incluirSolicitacao.visible = false;
    pesquisa.visible = true;
  };
  fornecedoresTab.click = () => {
    cliques.push("fornecedores");
    fornecedoresTab.attributes["aria-selected"] = "true";
    gradeFornecedores.visible = true;
    incluirFornecedor.visible = true;
  };
  incluirFornecedor.click = () => {
    cliques.push("incluir fornecedor");
    janelaFornecedor.visible = true;
    opcaoCnpj.visible = true;
    campoPesquisaFornecedor.visible = true;
    pesquisarFornecedor.visible = true;
    confirmarFornecedor.visible = true;
    confirmarFornecedor.disabled = true;
    resultadosFornecedores = [];
  };
  opcaoCnpj.click = () => { cliques.push("pesquisar por cnpj"); };
  pesquisarFornecedor.click = () => {
    const procurado = campoPesquisaFornecedor.value.replace(/\D/g, "");
    cliques.push(`pesquisar fornecedor ${procurado}`);
    requisicoes.push({ acao: "pesquisar fornecedor", instante: Date.now() });
    resultadosFornecedores = catalogoFornecedores.filter((cnpj) => cnpj === procurado);
  };
  confirmarFornecedor.click = () => {
    cliques.push("confirmar fornecedor");
    fornecedoresIncluidos.push(fornecedorSelecionado);
    janelaFornecedor.visible = false;
    opcaoCnpj.visible = false;
    campoPesquisaFornecedor.visible = false;
    pesquisarFornecedor.visible = false;
    confirmarFornecedor.visible = false;
  };
  janelaFornecedor.querySelectorAll = (seletor) => {
    if (seletor === ".x-column-header, th") return cabecalhosPesquisaFornecedor;
    if (seletor === "button, [role='button'], a") return [pesquisarFornecedor, confirmarFornecedor];
    if (seletor !== ".x-grid-item, tr[role='row']") return [];
    return resultadosFornecedores.map((cnpj) => {
      const linha = elemento(cnpj);
      linha.querySelectorAll = (seletorCelulas) => seletorCelulas === ".x-grid-cell, td"
        ? [elemento(""), elemento("1"), elemento("EMPRESA"), elemento("EMPRESA"), elemento(cnpj)]
        : [];
      linha.click = () => {
        fornecedorSelecionado = cnpj;
        confirmarFornecedor.disabled = false;
      };
      return linha;
    });
  };

  const todos = [
    solicitacaoPai,
    solicitacaoFilho,
    processoPai,
    cotacaoFilho,
    inserirSolicitacao,
    inserirCotacao,
    incluirSolicitacao,
    incluirFornecedor,
    salvar,
    cancelar,
    nova,
    novaCotacao,
    produtoBotao,
    novoItem,
    produtoAvulso,
    pesquisarProduto,
    confirmarProduto,
    pesquisarFornecedor,
    confirmarFornecedor,
    editorQuantidade,
    campoPesquisaProduto,
    janelaProduto,
    cabecalhoProduto,
    proximaPagina,
    paginaAnterior,
    gradeItens,
    dados,
    itens,
    cotacaoTab,
    fornecedoresTab,
    gradeFornecedores,
    janelaFornecedor,
    opcaoCnpj,
    campoPesquisaFornecedor,
    responsavel,
    descricao,
    rotuloResponsavel,
    rotuloDescricao,
    solicitacoesParaCotacao,
    pesquisa,
  ];

  return {
    cliques,
    requisicoes,
    acoesProduto,
    produtosIncluidos,
    quantidadesIncluidas,
    fornecedoresIncluidos,
    abrirEditorQuantidade(indice, valor) {
      indiceQuantidadeEditando = indice;
      editorQuantidade.value = String(valor).replace(".", ",");
      editorQuantidade.visible = true;
      textoInseridoNoEditor = true;
    },
    campos: { responsavel, descricao },
    getElementById(id) {
      return todos.find((item) => item.id === id) || null;
    },
    querySelectorAll(seletor) {
      if (seletor === 'tr[role="row"]') {
        return [
          solicitacaoPai,
          ...(solicitacaoPai.getAttribute("aria-expanded") === "true" ? [solicitacaoFilho] : []),
          processoPai,
          ...(processoPai.getAttribute("aria-expanded") === "true" ? [cotacaoFilho] : []),
        ];
      }
      if (seletor === '[role="grid"], .x-grid, table') return [gradeItens, gradeFornecedores];
      if (seletor === 'input[role="spinbutton"]') return [editorQuantidade];
      if (seletor === 'button, [role="button"], a') {
        return [
          inserirSolicitacao,
          inserirCotacao,
          incluirSolicitacao,
          incluirFornecedor,
          salvar,
          cancelar,
          produtoBotao,
          novoItem,
          pesquisarProduto,
          confirmarProduto,
          pesquisarFornecedor,
          confirmarFornecedor,
        ];
      }
      if (seletor === "body *") return [nova, novaCotacao, produtoAvulso, opcaoCnpj];
      if (seletor === '[role="tab"]') return [dados, itens, cotacaoTab, fornecedoresTab];
      if (seletor === '[role="dialog"]') return [solicitacoesParaCotacao, pesquisa, janelaFornecedor];
      if (seletor === 'label, .x-form-item-label, [data-ref="labelEl"]') {
        return [rotuloResponsavel, rotuloDescricao];
      }
      if (seletor === "input, textarea") return [responsavel, descricao, campoPesquisaProduto, campoPesquisaFornecedor];
      if (seletor === "input") return [responsavel, descricao, campoPesquisaProduto, campoPesquisaFornecedor];
      return [];
    },
    execCommand(comando, _interface, valor) {
      if (comando !== "insertText" || !editorQuantidade.visible) return false;
      editorQuantidade.value = valor;
      textoInseridoNoEditor = true;
      return true;
    },
  };
}

globalThis.getComputedStyle = (item) => ({
  display: item.visible ? "block" : "none",
  visibility: item.visible ? "visible" : "hidden",
});

test("executa as quatro fases, incluindo os produtos, e não salva", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;

  const primeira = await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  assert.equal(primeira.ok, true);
  assert.equal(primeira.proximaFase, "itens");
  assert.equal(pagina.campos.responsavel.value, "GUSTAVO ALVIZI FELTRIN");
  assert.equal(
    pagina.campos.descricao.value,
    "AQUISIÇÃO DE -- PARA VEÍCULO PLACA -- SETOR --",
  );

  const segunda = await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });
  assert.equal(segunda.ok, true);
  assert.equal(segunda.proximaFase, "produtos");

  const terceira = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [
      { description: "REBITE MOLA 7/16X1", quantity: 1 },
      { description: "OLEO 15W40", quantity: 3 },
    ],
    timeoutMs: 100,
  });
  assert.equal(terceira.ok, true);
  assert.equal(terceira.proximaFase, "cotacao");
  assert.equal(terceira.indiceProduto, 2);
  assert.deepEqual(pagina.produtosIncluidos, ["REBITE MOLA 7/16X1", "OLEO 15W40"]);
  assert.deepEqual(pagina.quantidadesIncluidas, [1, 3]);

  const quarta = await executarFaseNoFrame({ fase: "cotacao", timeoutMs: 100 });
  assert.equal(quarta.ok, true);
  assert.equal(quarta.proximaFase, "fornecedores");
  assert.deepEqual(pagina.cliques, [
    "solicitação",
    "opção solicitação",
    "inserir solicitação",
    "nova",
    "itens",
    "produto",
    "produto avulso",
    "pesquisar REBITE MOLA 7/16X1",
    "selecionar produto",
    "novo item",
    "produto",
    "produto avulso",
    "pesquisar OLEO 15W40",
    "selecionar produto",
    "processo de compra",
    "cotação",
    "inserir cotação",
    "nova cotação",
    "incluir solicitação",
  ]);
});

test("para a paginação assim que localiza um produto exato", async () => {
  const pagina = paginaDoScpi(["MOLA TRASEIRA", "MOLA"], 1);
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [{ description: "MOLA", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceProduto, 1);
  assert.equal(pagina.cliques.filter((item) => item === "próxima página").length, 1);
  assert.equal(pagina.cliques.filter((item) => item.startsWith("pesquisar ")).length, 1);
});

test("reinicia os produtos quando a página atualizada está com a grade vazia", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    indiceInicial: 2,
    produtos: [
      { description: "REBITE MOLA 7/16X1", quantity: 1 },
      { description: "OLEO 15W40", quantity: 3 },
    ],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceProduto, 2);
  assert.deepEqual(pagina.produtosIncluidos, ["REBITE MOLA 7/16X1", "OLEO 15W40"]);
  assert.match(resultado.etapas.join(" "), /progresso salvo foi corrigido/);
});

test("usa a grade para não duplicar produtos quando o cache ficou atrasado", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });
  const produtos = [
    { description: "REBITE MOLA 7/16X1", quantity: 1 },
    { description: "OLEO 15W40", quantity: 3 },
  ];
  await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos,
    timeoutMs: 100,
  });
  const pesquisasAntes = pagina.cliques.filter((item) => item.startsWith("pesquisar ")).length;

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    indiceInicial: 0,
    produtos,
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceProduto, 2);
  assert.equal(
    pagina.cliques.filter((item) => item.startsWith("pesquisar ")).length,
    pesquisasAntes,
  );
  assert.deepEqual(pagina.produtosIncluidos, ["REBITE MOLA 7/16X1", "OLEO 15W40"]);
  assert.deepEqual(pagina.quantidadesIncluidas, [1, 3]);
  assert.match(resultado.etapas.join(" "), /progresso salvo foi corrigido/);
});

test("fecha um editor antigo clicando fora antes de seguir para a próxima quantidade", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });
  const produtosIniciais = [
    { description: "REBITE MOLA 7/16X1", quantity: 1 },
    { description: "OLEO 15W40", quantity: 3 },
  ];
  await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: produtosIniciais,
    timeoutMs: 100,
  });
  pagina.abrirEditorQuantidade(0, 2);

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    indiceInicial: 0,
    produtos: [
      { description: "REBITE MOLA 7/16X1", quantity: 2 },
      { description: "OLEO 15W40", quantity: 3 },
    ],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.deepEqual(pagina.quantidadesIncluidas, [2, 3]);
});

test("permite abrir a cotação quando os produtos foram tratados manualmente", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "cotacao",
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.proximaFase, "fornecedores");
  assert.equal(pagina.cliques.includes("processo de compra"), true);
});

test("pausa ao atingir três páginas sem correspondência exata", async () => {
  const pagina = paginaDoScpi(["REPARO A", "REPARO B", "REPARO C", "REPARO"], 1);
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [{ description: "REPARO", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.match(resultado.etapas.join(" "), /Limite seguro de 3 páginas/);
  assert.equal(pagina.cliques.filter((item) => item === "próxima página").length, 2);
  assert.equal(pagina.cliques.filter((item) => item.startsWith("pesquisar ")).length, 1);
});

test("mantém intervalo mínimo entre carregamentos de páginas", async () => {
  const pagina = paginaDoScpi(["MOLA TRASEIRA", "MOLA DIANTEIRA", "MOLA"], 1);
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 40,
    produtos: [{ description: "MOLA", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(pagina.requisicoes.length, 3);
  const intervalos = pagina.requisicoes.slice(1)
    .map((requisicao, indice) => requisicao.instante - pagina.requisicoes[indice].instante);
  assert.ok(intervalos.every((intervalo) => intervalo >= 35));
});

test("usa intervalo rápido nas ações comuns e conserva a margem nas confirmações", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 120,
    intervaloRapidoMs: 20,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 300,
  });

  assert.equal(resultado.ok, true, resultado.error);
  const pesquisa = pagina.requisicoes.find((item) => item.acao === "pesquisar");
  const selecao = pagina.acoesProduto.find((item) => item.acao === "selecionar");
  const confirmacao = pagina.acoesProduto.find((item) => item.acao === "confirmar");
  assert.ok(selecao.instante - pesquisa.instante >= 15);
  assert.ok(selecao.instante - pesquisa.instante < 100);
  assert.ok(confirmacao.instante - selecao.instante >= 110);
});

test("abre Novo Item antes de retomar a partir do segundo produto", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });
  await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [
      { description: "REBITE MOLA 7/16X1", quantity: 1 },
      { description: "OLEO 15W40", quantity: 3 },
    ],
    indiceInicial: 1,
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.deepEqual(pagina.produtosIncluidos, ["REBITE MOLA 7/16X1", "OLEO 15W40"]);
  assert.ok(pagina.cliques.indexOf("novo item") < pagina.cliques.lastIndexOf("produto"));
});

test("pausa quando os resultados são ambíguos", async () => {
  const pagina = paginaDoScpi([
    "SERVICO DE ALINHAMENTO",
    "ALINHAMENTO E BALANCEAMENTO EM GERAL",
  ]);
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const resultado = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [{ description: "ALINHAMENTO DIANTEIRO", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.equal(resultado.indiceProduto, 0);
  assert.equal(resultado.produtoPendente.description, "ALINHAMENTO DIANTEIRO");
  assert.match(resultado.etapas.join(" "), /ambíguos/);
});

test("pausa e retoma uma automação em andamento", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  let concluida = false;
  const execucao = executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 100,
    intervaloRapidoMs: 100,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  }).then((resultado) => {
    concluida = true;
    return resultado;
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  globalThis.__scriptPrefeituraControle = "pausar";
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(concluida, false);

  globalThis.__scriptPrefeituraControle = null;
  const resultado = await execucao;
  assert.equal(resultado.ok, true);
  assert.equal(resultado.indiceProduto, 1);
  assert.equal(globalThis.__scriptPrefeituraExecutando, false);
});

test("impede duas automações simultâneas no mesmo quadro do SCPI", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const primeiraExecucao = executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 100,
    intervaloRapidoMs: 100,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const concorrente = await executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 0,
    produtos: [{ description: "OUTRO PRODUTO", quantity: 1 }],
    timeoutMs: 100,
  });

  assert.equal(concorrente.matched, true);
  assert.equal(concorrente.ok, false);
  assert.equal(concorrente.alreadyRunning, true);
  assert.match(concorrente.error, /execução.+andamento/i);

  globalThis.__scriptPrefeituraControle = "cancelar";
  const primeira = await primeiraExecucao;
  assert.equal(primeira.canceled, true);
  assert.equal(globalThis.__scriptPrefeituraExecutando, false);
});

test("cancela a automação sem acionar o Cancelar do SCPI", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const execucao = executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 100,
    intervaloRapidoMs: 100,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  globalThis.__scriptPrefeituraControle = "cancelar";

  const resultado = await execucao;
  assert.equal(resultado.ok, true);
  assert.equal(resultado.canceled, true);
  assert.equal(resultado.indiceProduto, 0);
  assert.match(resultado.etapas.join(" "), /cancelada pelo usuário/);
  assert.equal(pagina.cliques.includes("selecionar produto"), false);
  assert.equal(pagina.cliques.includes("cancelar"), false);
  assert.equal(globalThis.__scriptPrefeituraExecutando, false);
});

test("finaliza a automação e apresenta os resultados obtidos sem salvar", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 100 });
  await executarFaseNoFrame({ fase: "itens", timeoutMs: 100 });

  const execucao = executarFaseNoFrame({
    fase: "produtos",
    intervaloRequisicaoMs: 100,
    intervaloRapidoMs: 100,
    produtos: [{ description: "REBITE MOLA 7/16X1", quantity: 1 }],
    timeoutMs: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  globalThis.__scriptPrefeituraControle = "finalizar";

  const resultado = await execucao;
  assert.equal(resultado.ok, true);
  assert.equal(resultado.finalized, true);
  assert.match(resultado.etapas.join(" "), /Execução finalizada pelo usuário/);
  assert.match(resultado.etapas.join(" "), /Resultados obtidos:/);
  assert.equal(pagina.cliques.includes("salvar"), false);
  assert.equal(pagina.cliques.includes("cancelar"), false);
  assert.equal(globalThis.__scriptPrefeituraExecutando, false);
});

test("permite executar a cotação diretamente sem progresso salvo", async () => {
  const pagina = paginaDoScpi();
  globalThis.document = pagina;
  const resultado = await executarFaseNoFrame({ fase: "cotacao", timeoutMs: 100 });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.proximaFase, "fornecedores");
  assert.deepEqual(pagina.cliques, [
    "processo de compra",
    "cotação",
    "inserir cotação",
    "nova cotação",
    "incluir solicitação",
  ]);
});

test("inclui todos os fornecedores encontrados pelo CNPJ sem duplicar ao retomar", async () => {
  const pagina = paginaDoScpi(undefined, 20, ["47768882000101", "04940445000102"]);
  globalThis.document = pagina;
  const fornecedores = ["47.768.882/0001-01", "04.940.445/0001-02"];

  const resultado = await executarFaseNoFrame({
    fase: "fornecedores",
    fornecedores,
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.fornecedorPendente, null);
  assert.deepEqual(pagina.fornecedoresIncluidos, ["47768882000101", "04940445000102"]);
  assert.equal(pagina.cliques.filter((item) => item === "confirmar fornecedor").length, 2);

  const repetido = await executarFaseNoFrame({
    fase: "fornecedores",
    fornecedores,
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
  });
  assert.equal(repetido.ok, true);
  assert.deepEqual(pagina.fornecedoresIncluidos, ["47768882000101", "04940445000102"]);
  assert.equal(pagina.cliques.filter((item) => item === "confirmar fornecedor").length, 2);
});

test("pausa quando o CNPJ do fornecedor não existe no cadastro", async () => {
  const pagina = paginaDoScpi(undefined, 20, []);
  globalThis.document = pagina;

  const resultado = await executarFaseNoFrame({
    fase: "fornecedores",
    fornecedores: ["47.768.882/0001-01"],
    intervaloRequisicaoMs: 0,
    timeoutMs: 300,
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.paused, true);
  assert.equal(resultado.fornecedorPendente, "47768882000101");
  assert.equal(pagina.cliques.includes("confirmar fornecedor"), false);
  assert.match(resultado.etapas.join(" "), /não encontrado/);
});

test("ignora frames que não contêm o menu", async () => {
  globalThis.document = { querySelectorAll: () => [] };
  const resultado = await executarFaseNoFrame({ fase: "solicitacao", timeoutMs: 10 });
  assert.deepEqual(resultado, { matched: false, ok: false, etapas: [] });
});
