export async function executarFaseNoFrame({
  fase,
  timeoutMs = 10000,
  responsavel = "GUSTAVO ALVIZI FELTRIN",
  descricao = "AQUISIÇÃO DE -- PARA VEÍCULO PLACA -- SETOR --",
  produtos = [],
  fornecedores = [],
  indiceInicial = 0,
  abastecimentos = [],
  permitirViradaKm = true,
  indiceAbastecimentoInicial = 0,
  indiceQuantidadeAbastecimentoInicial = 0,
  intervaloRequisicaoMs = 1000,
  intervaloRapidoMs = 250,
  maxPaginasPorConsulta = 3,
} = {}) {
  const resposta = { matched: false, ok: false, etapas: [] };
  const doc = globalThis.document;
  if (!doc) return resposta;
  let alertaEdicaoRejeitada = null;
  let alertaOriginal = null;
  let alertaInterceptado = null;
  let painelExecucao = null;
  let painelFinalizado = false;
  let observadorErroAjax = null;
  let erroAjaxPendente = null;
  let fechamentoErroAjaxEmAndamento = null;
  let modoConservadorAte = 0;
  let messageDlgBloqueanteDetectado = false;

  const texto = (elemento) =>
    (elemento?.innerText || elemento?.textContent || "").replace(/\s+/g, " ").trim();

  const visivel = (elemento) => {
    if (!elemento) return false;
    const estilo = globalThis.getComputedStyle?.(elemento);
    const area = elemento.getBoundingClientRect?.();
    return (
      elemento.hidden !== true &&
      estilo?.display !== "none" &&
      estilo?.visibility !== "hidden" &&
      (!area || (area.width > 0 && area.height > 0))
    );
  };

  const habilitado = (elemento) =>
    visivel(elemento) &&
    elemento.disabled !== true &&
    elemento.getAttribute?.("aria-disabled") !== "true" &&
    !/\bx-(?:item|btn)-disabled\b/.test(String(elemento.className || ""));

  const botoes = (nome) =>
    [...doc.querySelectorAll('button, [role="button"], a')].filter(
      (elemento) => texto(elemento) === nome && visivel(elemento),
    );

  const botao = (nome) => botoes(nome)[0];

  const linhaMenu = (nome, nivel) =>
    [...doc.querySelectorAll('tr[role="row"]')].find(
      (elemento) =>
        elemento.getAttribute("aria-level") === String(nivel) &&
        texto(elemento) === nome &&
        visivel(elemento),
    );

  const opcao = (nome) =>
    [...doc.querySelectorAll("body *")].find(
      (elemento) => {
        const rotulo = texto(elemento);
        const corresponde = rotulo === nome || rotulo.endsWith(`- ${nome}`);
        return (
          corresponde &&
          visivel(elemento) &&
          ![...elemento.children].some((filho) => {
            const textoFilho = texto(filho);
            return textoFilho === nome || textoFilho.endsWith(`- ${nome}`);
          })
        );
      },
    );

  const aba = (nome) =>
    [...doc.querySelectorAll('[role="tab"]')].find(
      (elemento) => texto(elemento) === nome && visivel(elemento),
    );

  const abaSelecionada = (elemento) =>
    elemento?.getAttribute?.("aria-selected") === "true" ||
    String(elemento?.className || "").includes("x-tab-active");

  const dialogo = (titulo) =>
    [...doc.querySelectorAll('[role="dialog"]'), ...doc.querySelectorAll(".x-window")].find(
      (elemento) => texto(elemento).includes(titulo) && visivel(elemento),
    );

  const esperar = async (descricaoEspera, localizar) => {
    const inicio = Date.now();
    let tempoPausado = 0;
    while (Date.now() - inicio - tempoPausado < timeoutMs) {
      tempoPausado += await aguardarControle();
      if (alertaEdicaoRejeitada) {
        const alerta = alertaEdicaoRejeitada;
        alertaEdicaoRejeitada = null;
        const erro = new Error(alerta.codigo);
        erro.alertaScpi = alerta.mensagem;
        throw erro;
      }
      const encontrado = localizar();
      if (encontrado) return encontrado;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Tempo esgotado após ${timeoutMs} ms: ${descricaoEspera}.`);
  };

  const clicar = (elemento) => {
    elemento.scrollIntoView?.({ block: "center", inline: "nearest" });
    elemento.click();
  };

  const criarPainelExecucao = () => {
    if (!doc.createElement || !doc.documentElement?.appendChild) return null;
    doc.getElementById?.("script-prefeitura-painel")?.remove?.();
    const host = doc.createElement("div");
    host.id = "script-prefeitura-painel";
    host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;width:330px;max-width:calc(100vw - 32px);font-family:system-ui,sans-serif;";
    const raiz = host.attachShadow?.({ mode: "open" });
    if (!raiz) return null;
    raiz.innerHTML = `
      <style>
        @keyframes script-prefeitura-girar { to { transform: rotate(360deg); } }
        @keyframes script-prefeitura-pulsar { 50% { opacity: .55; } }
        .painel { box-sizing:border-box;padding:16px;border:1px solid #8ab8b6;border-radius:12px;background:#fff;color:#173042;box-shadow:0 12px 34px #0004; }
        .cabecalho { display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:16px;font-weight:800; }
        .spinner { width:18px;height:18px;border:3px solid #b9d8d6;border-top-color:#007873;border-radius:50%;animation:script-prefeitura-girar .8s linear infinite; }
        .estado { margin-bottom:8px;color:#17605d;font-size:14px;font-weight:800; }
        .etapa { min-height:38px;max-height:min(52vh,420px);margin-bottom:10px;padding-right:4px;overflow:auto;white-space:pre-line;font-size:13px;line-height:1.35; }
        progress { width:100%;height:12px;accent-color:#007873; }
        .controles { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px; }
        button { padding:9px;border:0;border-radius:7px;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer; }
        button:disabled { opacity:.55;cursor:wait; }
        .pausar { background:#a36d24; }
        .finalizar { background:#28708c; }
        .cancelar { background:#a93434; }
        .fechar { display:none;grid-column:1 / -1;background:#52616d; }
        .painel[data-estado="pausado"] .spinner { animation:script-prefeitura-pulsar 1s ease-in-out infinite; }
        .painel[data-estado="erro"] .estado { color:#a01919; }
        .painel[data-estado="concluido"] .estado,
        .painel[data-estado="finalizado"] .estado { color:#08752c; }
      </style>
      <section class="painel" data-estado="executando" aria-live="polite">
        <div class="cabecalho"><span class="spinner"></span><span>Fluxo SCPI</span></div>
        <div class="estado">Preparando execução…</div>
        <div class="etapa">Aguarde enquanto a extensão confere a página.</div>
        <progress></progress>
        <div class="controles">
          <button class="pausar" type="button">Pausar</button>
          <button class="finalizar" type="button">Finalizar</button>
          <button class="cancelar" type="button">Cancelar</button>
          <button class="fechar" type="button">Fechar</button>
        </div>
      </section>`;
    doc.documentElement.appendChild(host);
    const painel = raiz.querySelector(".painel");
    const estado = raiz.querySelector(".estado");
    const etapa = raiz.querySelector(".etapa");
    const barra = raiz.querySelector("progress");
    const pausar = raiz.querySelector(".pausar");
    const finalizar = raiz.querySelector(".finalizar");
    const cancelar = raiz.querySelector(".cancelar");
    const fechar = raiz.querySelector(".fechar");
    pausar.addEventListener("click", () => {
      const vaiPausar = globalThis.__scriptPrefeituraControle !== "pausar";
      globalThis.__scriptPrefeituraControle = vaiPausar ? "pausar" : null;
      pausar.textContent = vaiPausar ? "Continuar" : "Pausar";
      painel.dataset.estado = vaiPausar ? "pausado" : "executando";
      estado.textContent = vaiPausar ? "Execução pausada" : "Execução retomada";
    });
    cancelar.addEventListener("click", () => {
      globalThis.__scriptPrefeituraControle = "cancelar";
      pausar.disabled = true;
      cancelar.disabled = true;
      painel.dataset.estado = "cancelando";
      estado.textContent = "Cancelando…";
      etapa.textContent = "A extensão será interrompida no próximo ponto seguro.";
    });
    finalizar.addEventListener("click", () => {
      globalThis.__scriptPrefeituraControle = "finalizar";
      pausar.disabled = true;
      finalizar.disabled = true;
      cancelar.disabled = true;
      painel.dataset.estado = "finalizando";
      estado.textContent = "Finalizando…";
      etapa.textContent = "Preparando o relatório com os resultados obtidos até agora.";
    });
    fechar.addEventListener("click", () => host.remove());
    return { host, painel, estado, etapa, barra, pausar, finalizar, cancelar, fechar };
  };

  const atualizarPainelExecucao = (progresso) => {
    if (!painelExecucao || painelFinalizado || !progresso) return;
    const { tipo, atual, total, etapa } = progresso;
    painelExecucao.estado.textContent = total
      ? `${tipo}: ${atual} de ${total}`
      : `Executando: ${tipo}`;
    painelExecucao.etapa.textContent = etapa || "Processando…";
    if (total) {
      painelExecucao.barra.max = total;
      painelExecucao.barra.value = atual;
    } else {
      painelExecucao.barra.removeAttribute("value");
    }
  };

  const finalizarPainelExecucao = (estado, mensagem) => {
    if (!painelExecucao || painelFinalizado) return;
    painelFinalizado = true;
    painelExecucao.painel.dataset.estado = estado;
    painelExecucao.estado.textContent = estado === "concluido"
      ? "Execução concluída"
      : estado === "finalizado" ? "Execução finalizada"
        : estado === "cancelado" ? "Execução cancelada" : estado === "pausado" ? "Ação manual necessária" : "Execução interrompida";
    painelExecucao.etapa.textContent = mensagem;
    painelExecucao.painel.querySelector(".spinner").style.display = "none";
    painelExecucao.pausar.style.display = "none";
    painelExecucao.finalizar.style.display = "none";
    painelExecucao.cancelar.style.display = "none";
    painelExecucao.fechar.style.display = "block";
  };

  const montarRelatorioFalhas = (falhas = [], placasNaoEncontradas = []) => {
    const detalhes = [
      ...falhas.map((falha) =>
        `Item ${falha.indice} | Placa ${falha.placa || "não informada"} | Etapa ${falha.etapa}: ${falha.erro}`),
      ...placasNaoEncontradas.map((item) =>
        `Item ${item.indice} | Placa ${item.placa} | Etapa Placa: não encontrada no cadastro de centros de custo.`),
    ];
    return detalhes.length ? `\n\nDetalhes das falhas:\n${detalhes.join("\n\n")}` : "";
  };

  const editorNumericoVisivel = () => [
    ...doc.querySelectorAll('input[role="spinbutton"]'),
    ...doc.querySelectorAll(".x-grid-editor input, .x-editor input"),
  ].find(visivel);

  const abrirEditorNumerico = async (celula, descricao, iniciarPeloExt, localizarCelula) => {
    const ativar = () => {
      const alvo = localizarCelula?.() || celula;
      if (!alvo) return;
      if (iniciarPeloExt?.()) return;
      clicar(alvo);
      alvo.dispatchEvent?.(criarEvento("dblclick", {
        bubbles: true,
        cancelable: true,
        view: globalThis,
      }, globalThis.MouseEvent));
    };
    ativar();
    let ultimaTentativa = Date.now();
    return esperar(`o editor de ${descricao} abrir`, () => {
      const editor = editorNumericoVisivel();
      if (editor) return editor;
      if (Date.now() - ultimaTentativa < 400) return null;

      ultimaTentativa = Date.now();
      ativar();
      return null;
    });
  };

  const criarEvento = (tipo, opcoes, Construtor) => {
    const ClasseEvento = typeof Construtor === "function" ? Construtor : Event;
    const evento = new ClasseEvento(tipo, opcoes);
    for (const [chave, valor] of Object.entries(opcoes)) {
      if (!(chave in evento)) Object.defineProperty(evento, chave, { value: valor });
    }
    return evento;
  };

  const normalizar = (valor) => String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

  const cnpjNumerico = (valor) => String(valor || "").replace(/\D/g, "");
  const formatarCnpj = (valor) => {
    const cnpj = cnpjNumerico(valor);
    return cnpj.length === 14
      ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
      : valor;
  };

  const palavrasProduto = (valor) => {
    const ignorar = new Set([
      "DA", "DAS", "DE", "DO", "DOS", "E", "EM", "GERAL", "PARA",
      "MATERIAL", "MATERIAIS", "SERV", "SERVICO", "SERVICOS",
    ]);
    return normalizar(valor).split(/\s+/).filter((palavra) => palavra.length > 1 && !ignorar.has(palavra));
  };

  const consultasProduto = (descricaoProduto) => {
    const palavras = palavrasProduto(descricaoProduto);
    return [...new Set([
      String(descricaoProduto || "").trim(),
      palavras.slice(0, 2).join(" "),
      palavras[0],
    ].filter(Boolean))];
  };

  const pontuarProduto = (procurado, encontrado) => {
    const origem = normalizar(procurado);
    const destino = normalizar(encontrado);
    if (origem === destino) return 1;
    const origemPalavras = palavrasProduto(origem);
    const destinoPalavras = palavrasProduto(destino);
    const comuns = origemPalavras.filter((palavra) => destinoPalavras.includes(palavra)).length;
    if (!comuns) return 0;
    return (comuns / origemPalavras.length) * 0.7 + (comuns / destinoPalavras.length) * 0.3;
  };

  const campoAntesDoBotao = (elementoBotao) => {
    const areaBotao = elementoBotao.getBoundingClientRect?.();
    if (!areaBotao) return null;
    return [...doc.querySelectorAll("input")]
      .filter((elemento) => {
        if (!habilitado(elemento)) return false;
        const area = elemento.getBoundingClientRect?.();
        if (!area) return false;
        return area.right <= areaBotao.left + 10 && Math.abs(area.top - areaBotao.top) <= 40;
      })
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
  };

  const linhasDeProduto = (area) => {
    const cabecalhos = [...area.querySelectorAll?.(".x-column-header, th") || []].filter(visivel);
    const indiceProduto = cabecalhos.findIndex((cabecalho) => normalizar(texto(cabecalho)) === "PRODUTO");
    return [...area.querySelectorAll?.(".x-grid-item, tr[role='row']") || []]
      .filter(visivel)
      .map((linha) => {
        const celulas = [...linha.querySelectorAll?.(".x-grid-cell, td") || []];
        const descricaoProduto = texto(indiceProduto >= 0 ? celulas[indiceProduto] : linha);
        return { linha, descricao: descricaoProduto };
      })
      .filter((item) => item.descricao && normalizar(item.descricao) !== "PRODUTO");
  };

  const gradeItensSolicitacao = () => {
    const grades = [...doc.querySelectorAll('[role="grid"], .x-grid, table')].filter(visivel);
    for (const grade of grades) {
      const cabecalhos = [...grade.querySelectorAll?.(".x-column-header, th") || []].filter(visivel);
      const indiceDescricao = cabecalhos.findIndex((cabecalho) =>
        normalizar(texto(cabecalho)).includes("DESCRICAO DO PRODUTO"));
      if (indiceDescricao < 0) continue;
      const indiceQuantidade = cabecalhos.findIndex((cabecalho) =>
        normalizar(texto(cabecalho)).startsWith("QUANTIDADE"));
      return { grade, indiceDescricao, indiceQuantidade };
    }
    return null;
  };

  const linhasItensSolicitacao = () => {
    const dadosGrade = gradeItensSolicitacao();
    if (!dadosGrade) return null;
    return [...dadosGrade.grade.querySelectorAll?.(".x-grid-item, tr[role='row']") || []]
        .filter(visivel)
        .map((linha) => {
          const celulas = [...linha.querySelectorAll?.(".x-grid-cell, td") || []];
          return {
            linha,
            descricao: texto(celulas[dadosGrade.indiceDescricao]),
            descricaoElemento: celulas[dadosGrade.indiceDescricao],
            quantidade: celulas[dadosGrade.indiceQuantidade],
          };
        })
        .filter((item) => item.descricao);
  };

  const quantidadeProdutosNaSolicitacao = () => linhasItensSolicitacao()?.length ?? null;

  const gradeFornecedoresCotacao = () => {
    const grades = [...doc.querySelectorAll('[role="grid"], .x-grid, table')].filter(visivel);
    for (const grade of grades) {
      const cabecalhos = [...grade.querySelectorAll?.(".x-column-header, th") || []].filter(visivel);
      const indiceDocumento = cabecalhos.findIndex((cabecalho) => normalizar(texto(cabecalho)) === "DOCUMENTO");
      const temFornecedor = cabecalhos.some((cabecalho) => normalizar(texto(cabecalho)) === "FORNECEDOR");
      if (indiceDocumento >= 0 && temFornecedor) return { grade, indiceDocumento };
    }
    return null;
  };

  const cnpjsFornecedoresNaCotacao = () => {
    const dadosGrade = gradeFornecedoresCotacao();
    if (!dadosGrade) return null;
    return [...dadosGrade.grade.querySelectorAll?.(".x-grid-item, tr[role='row']") || []]
      .filter(visivel)
      .map((linha) => {
        const celulas = [...linha.querySelectorAll?.(".x-grid-cell, td") || []];
        return cnpjNumerico(texto(celulas[dadosGrade.indiceDocumento]));
      })
      .filter((cnpj) => cnpj.length === 14);
  };

  const linhasPesquisaFornecedor = (janela) => {
    const cabecalhos = [...janela.querySelectorAll?.(".x-column-header, th") || []].filter(visivel);
    const indiceDocumento = cabecalhos.findIndex((cabecalho) => normalizar(texto(cabecalho)) === "DOCUMENTO");
    return [...janela.querySelectorAll?.(".x-grid-item, tr[role='row']") || []]
      .filter(visivel)
      .map((linha) => {
        const celulas = [...linha.querySelectorAll?.(".x-grid-cell, td") || []];
        return { linha, cnpj: cnpjNumerico(texto(indiceDocumento >= 0 ? celulas[indiceDocumento] : linha)) };
      })
      .filter((item) => item.cnpj.length === 14);
  };

  const numeroDaQuantidade = (valor) => {
    const semEspacos = String(valor ?? "")
      .trim()
      .replace(/\s/g, "");
    const normalizado = semEspacos.includes(",")
      ? semEspacos.replace(/\./g, "").replace(",", ".")
      : semEspacos;
    return Number(normalizado);
  };

  const quantidadeIgual = (atual, esperada) =>
    Number.isFinite(atual) && Math.abs(atual - esperada) < 0.000001;

  const concluirEditorExt = (editor) => {
    const Ext = globalThis.Ext;
    if (!Ext) return false;

    const concluir = (alvo) => {
      if (typeof alvo?.completeEdit !== "function") return false;
      alvo.completeEdit();
      return true;
    };
    for (const grade of Ext.ComponentQuery?.query?.("grid") || []) {
      const plugins = grade.getPlugins?.() || grade.plugins || [];
      for (const plugin of plugins) {
        if ((plugin?.editing || plugin?.activeEditor) && concluir(plugin)) return true;
      }
    }

    let elemento = editor;
    while (elemento) {
      const ids = [
        elemento.getAttribute?.("data-componentid"),
        elemento.id,
        String(elemento.id || "").replace(/-inputEl$/, ""),
      ].filter(Boolean);
      for (const id of ids) {
        let componente = Ext.getCmp?.(id);
        for (let nivel = 0; componente && nivel < 6; nivel += 1) {
          if (concluir(componente)) return true;
          componente = componente.ownerCt || componente.up?.();
        }
      }
      elemento = elemento.parentElement;
    }
    return false;
  };

  const clicarForaDoEditor = (destino, editor) => {
    destino.scrollIntoView?.({ block: "center", inline: "nearest" });
    destino.dispatchEvent?.(criarEvento("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      view: globalThis,
    }, globalThis.MouseEvent));
    editor.blur?.();
    destino.dispatchEvent?.(criarEvento("mouseup", {
      bubbles: true,
      cancelable: true,
      button: 0,
      view: globalThis,
    }, globalThis.MouseEvent));
    destino.dispatchEvent?.(criarEvento("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      view: globalThis,
    }, globalThis.MouseEvent));
    destino.click?.();
    if (visivel(editor)) concluirEditorExt(editor);
  };

  const fecharEditorQuantidadeAberto = async () => {
    const editor = editorNumericoVisivel();
    if (!editor) return;
    const destino = linhasItensSolicitacao()?.[0]?.descricaoElemento;
    if (!destino) throw new Error("Não foi possível clicar fora do editor de quantidade aberto.");
    clicarForaDoEditor(destino, editor);
    await esperar("o editor de quantidade anterior fechar", () => !visivel(editor));
  };

  const editarQuantidade = async (indice, quantidadeEsperada) => {
    await fecharEditorQuantidadeAberto();
    const item = linhasItensSolicitacao()?.[indice];
    if (!item?.quantidade || !item.descricaoElemento) {
      throw new Error(`A célula Quantidade do item ${indice + 1} não foi localizada.`);
    }
    if (quantidadeIgual(numeroDaQuantidade(texto(item.quantidade)), quantidadeEsperada)) return false;

    const editor = await abrirEditorNumerico(item.quantidade, `quantidade do item ${indice + 1}`);
    const valorEditor = String(quantidadeEsperada).replace(".", ",");
    editor.focus?.();
    editor.select?.();
    let inseridoNativamente = false;
    try {
      inseridoNativamente = doc.execCommand?.("insertText", false, valorEditor) === true
        && editor.value === valorEditor;
    } catch {
      inseridoNativamente = false;
    }
    if (!inseridoNativamente) {
      editor.value = valorEditor;
      const EventoEntrada = typeof globalThis.InputEvent === "function"
        ? globalThis.InputEvent
        : Event;
      editor.dispatchEvent?.(new EventoEntrada("input", {
        bubbles: true,
        data: valorEditor,
        inputType: "insertText",
      }));
    }
    editor.dispatchEvent?.(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    clicarForaDoEditor(item.descricaoElemento, editor);

    await esperar(`confirmar a quantidade do item ${indice + 1}`, () => {
      const atualizado = linhasItensSolicitacao()?.[indice];
      const atual = numeroDaQuantidade(texto(atualizado?.quantidade));
      return !visivel(editor) && quantidadeIgual(atual, quantidadeEsperada) ? atualizado : null;
    });
    return true;
  };

  const cabecalhosDaGrade = (grade) =>
    [...grade?.querySelectorAll?.(".x-column-header, th") || []].filter(visivel);

  const linhasDaGrade = (grade) =>
    [...grade?.querySelectorAll?.(".x-grid-item, tr[role='row']") || []].filter(visivel);

  const gradeItensSaida = () =>
    [...doc.querySelectorAll('[role="grid"], .x-grid, table')]
      .filter(visivel)
      .find((grade) => {
        const nomes = cabecalhosDaGrade(grade).map((item) => normalizar(texto(item)));
        return nomes.includes("QTD")
          || nomes.includes("C CUSTO")
          || (nomes.some((nome) => nome.startsWith("PLACA")) && nomes.includes("ATUAL"));
      });

  const indiceDaLinha = (linha, fallback = -1) => {
    const indice = Number(linha?.getAttribute?.("data-recordindex"));
    if (Number.isInteger(indice) && indice >= 0) return indice;
    const aria = Number(linha?.getAttribute?.("aria-rowindex"));
    return Number.isInteger(aria) && aria > 0 ? aria - 1 : fallback;
  };

  const registroSaida = (indiceEsperado) => {
    const grade = gradeItensSaida();
    if (!grade) return null;
    const linhas = linhasDaGrade(grade);
    let linha = linhas.find((item, indice) => indiceDaLinha(item, indice) === indiceEsperado);
    const selecionada = linhas.find((item) =>
      item.getAttribute?.("aria-selected") === "true"
      || String(item.className || "").includes("x-grid-item-selected"));
    if (!linha && selecionada && [-1, indiceEsperado].includes(indiceDaLinha(selecionada))) linha = selecionada;
    if (!linha && linhas.length === 1 && indiceDaLinha(linhas[0]) < 0) [linha] = linhas;
    if (!linha) return { grade, linhas, linha: null, celulas: [], cabecalhos: [] };
    return {
      grade,
      linhas,
      linha,
      celulas: [...linha.querySelectorAll?.(".x-grid-cell, td") || []],
      cabecalhos: cabecalhosDaGrade(grade).map((item) => normalizar(texto(item))),
    };
  };

  const rolagemHorizontal = (grade) => {
    const conhecidos = [
      grade,
      ...grade?.querySelectorAll?.(".x-grid-view, .x-grid-body, .x-scroller, .x-box-inner, [style*='overflow']") || [],
    ];
    let pai = grade?.parentElement;
    for (let nivel = 0; pai && nivel < 4; nivel += 1, pai = pai.parentElement) conhecidos.push(pai);
    return conhecidos.find((elemento) =>
      Number(elemento?.scrollWidth) > Number(elemento?.clientWidth) + 5);
  };

  const rolarItensSaida = async (lado) => {
    const grade = gradeItensSaida();
    if (!grade) throw new Error("A grade Itens da Saída não foi localizada.");
    const temCabecalhos = () => {
      const nomes = cabecalhosDaGrade(gradeItensSaida()).map((item) => normalizar(texto(item)));
      return lado === "direita"
        ? nomes.some((nome) => nome.startsWith("PLACA")) && nomes.includes("ATUAL")
        : nomes.includes("QTD") && nomes.includes("C CUSTO");
    };
    if (!temCabecalhos()) {
      const barra = rolagemHorizontal(grade);
      if (!barra) throw new Error(`A barra horizontal da grade não foi localizada para rolar à ${lado}.`);
      barra.scrollLeft = lado === "direita" ? barra.scrollWidth : 0;
      barra.dispatchEvent?.(new Event("scroll", { bubbles: true }));
      await esperar(`as colunas da ${lado} aparecerem`, temCabecalhos);
    }
  };

  const aguardarGradePronta = async (descricao) => {
    let assinaturaAnterior = null;
    let estavelDesde = 0;
    const janelaEstavelMs = Math.min(150, Math.max(50, timeoutMs / 5));
    return esperar(descricao, () => {
      const grade = gradeItensSaida();
      if (!grade) return null;
      const store = globalThis.Ext && (
        [...globalThis.Ext.ComponentQuery?.query?.("grid") || []]
          .find((item) => {
            const raiz = item.getView?.()?.getEl?.()?.dom || item.getEl?.()?.dom;
            return raiz?.contains?.(grade) || grade.contains?.(raiz);
          })?.getStore?.()
      );
      const carregando = store?.isLoading?.()
        || globalThis.Ext?.Ajax?.isLoading?.()
        || [...grade.querySelectorAll?.(".x-mask-msg, .x-loading-mask") || []].some(visivel);
      if (carregando) {
        assinaturaAnterior = null;
        estavelDesde = 0;
        return null;
      }
      const assinatura = linhasDaGrade(grade).map((linha) => texto(linha)).join("\n");
      if (assinatura !== assinaturaAnterior) {
        assinaturaAnterior = assinatura;
        estavelDesde = Date.now();
        return null;
      }
      return Date.now() - estavelDesde >= janelaEstavelMs ? true : null;
    });
  };

  const numeroDaGrade = (valor) => {
    const limpo = String(valor ?? "").trim().replace(/\s/g, "");
    if (/^\d{1,3}(?:\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ""));
    return numeroDaQuantidade(limpo);
  };

  const contextoCelulaExt = (registro, indiceColuna) => {
    const Ext = globalThis.Ext;
    const celula = registro?.celulas?.[indiceColuna];
    if (!Ext || !celula) return null;

    for (const grade of Ext.ComponentQuery?.query?.("grid") || []) {
      const view = grade.getView?.();
      const raiz = view?.getEl?.()?.dom || grade.getEl?.()?.dom;
      if (!raiz?.contains?.(celula)) continue;
      const record = view?.getRecord?.(registro.linha);
      if (!record) continue;

      const idColuna = celula.getAttribute?.("data-columnid");
      const colunasCompletas = grade.getColumnManager?.().getColumns?.() || [];
      const colunas = grade.getVisibleColumnManager?.().getColumns?.()
        || colunasCompletas
        || [];
      const cabecalho = registro.cabecalhos?.[indiceColuna];
      const coluna = Ext.getCmp?.(idColuna)
        || colunas.find((item) => normalizar(item.getText?.() || item.text) === cabecalho)
        || colunas[indiceColuna];
      if (coluna) {
        const store = grade.getStore?.() || view.getStore?.();
        const indiceLinha = store?.indexOf?.(record) ?? indiceDaLinha(registro.linha);
        const indiceColunaExt = (colunasCompletas.length ? colunasCompletas : colunas).indexOf(coluna);
        return { grade, view, record, coluna, indiceLinha, indiceColunaExt };
      }
    }
    return null;
  };

  const selecionarRegistroSaida = async (indice) => {
    let registro = registroSaida(indice);
    if (!registro?.linha) throw new Error(`O item ${indice + 1} não foi localizado na grade.`);

    const alvo = registro.celulas[0] || registro.linha;
    alvo.scrollIntoView?.({ block: "center", inline: "nearest" });
    const contexto = contextoCelulaExt(registro, 0);
    const modeloSelecao = contexto?.grade?.getSelectionModel?.();
    const selecionadoNoExtAntes = modeloSelecao?.isSelected?.(contexto?.record);
    const selecionadoNoDomAntes = registro.linha.getAttribute?.("aria-selected") === "true"
      || String(registro.linha.className || "").includes("x-grid-item-selected");

    if (!selecionadoNoExtAntes && !selecionadoNoDomAntes) {
      for (const tipo of ["mousedown", "mouseup", "click"]) {
        alvo.dispatchEvent?.(criarEvento(tipo, {
          bubbles: true,
          cancelable: true,
          view: globalThis,
        }, globalThis.MouseEvent));
      }
      ultimaRequisicaoEm = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await aguardarAjaxLivre(`o SCPI concluir a seleção do item ${indice + 1}`);
    }

    registro = await esperar(`o item ${indice + 1} virar a linha ativa`, () => {
      const atual = registroSaida(indice);
      const contextoAtual = contextoCelulaExt(atual, 0);
      const modeloAtual = contextoAtual?.grade?.getSelectionModel?.();
      const selecaoBruta = modeloAtual?.getSelection?.() || contextoAtual?.grade?.getSelection?.();
      const selecao = selecaoBruta?.getRecords?.()
        || (Array.isArray(selecaoBruta) ? selecaoBruta : selecaoBruta ? [selecaoBruta] : []);
      const selecionadoNoExt = modeloAtual?.isSelected?.(contextoAtual?.record)
        || [...selecao].some((item) => item === contextoAtual?.record || item?.record === contextoAtual?.record);
      const selecionadoNoDom = atual?.linha?.getAttribute?.("aria-selected") === "true"
        || String(atual?.linha?.className || "").includes("x-grid-item-selected");
      return selecionadoNoExt || selecionadoNoDom ? atual : null;
    });
    return registro;
  };

  const pluginEdicaoDaGrade = (grade) => {
    const pluginsConfigurados = grade?.getPlugins?.() || grade?.plugins || [];
    const plugins = Array.isArray(pluginsConfigurados)
      ? pluginsConfigurados
      : Object.values(pluginsConfigurados);
    return grade?.findPlugin?.("cellediting")
      || grade?.getPlugin?.("cellediting")
      || plugins.find((item) => typeof item?.startEdit === "function");
  };

  const cancelarEdicaoDaCelula = (registro, indiceColuna) => {
    const contexto = contextoCelulaExt(registro, indiceColuna);
    const plugin = pluginEdicaoDaGrade(contexto?.grade);
    try {
      plugin?.cancelEdit?.();
      contexto?.grade?.setActionableMode?.(false);
    } catch {
      // A nova tentativa também reinicializa o editor da grade.
    }
    editorNumericoVisivel()?.blur?.();
  };

  const aguardarModoEdicao = async (descricao) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await esperar(`o SCPI entrar em modo de edição para ${descricao}`, () =>
      !globalThis.Ext?.Ajax?.isLoading?.() ? true : null);
  };

  const iniciarEdicaoPeloExt = (registro, indiceColuna) => {
    const contexto = contextoCelulaExt(registro, indiceColuna);
    if (!contexto) return false;
    const plugin = pluginEdicaoDaGrade(contexto.grade);
    if (!plugin) return false;
    try {
      plugin.cancelEdit?.();
      contexto.grade.setActionableMode?.(false);
      return plugin.startEdit?.(contexto.record, contexto.coluna) !== false;
    } catch {
      return false;
    }
  };

  const editarNumeroPeloExt = async (localizarRegistro, indiceColuna, valor) => {
    let registro = localizarRegistro();
    let contexto = contextoCelulaExt(registro, indiceColuna);
    if (!contexto) return { ok: false, motivo: "grade ou célula não vinculada ao ExtJS" };
    let plugin = pluginEdicaoDaGrade(contexto.grade);
    if (!plugin || typeof plugin.fireEvent !== "function") {
      return {
        ok: false,
        motivo: "o plugin de edição do ExtJS não foi localizado",
        metodos: ["editor inline"],
      };
    }
    const editavel = plugin?.isCellEditable?.(contexto.record, contexto.coluna);
    if (editavel === false) {
      return {
        ok: false,
        bloqueado: true,
        motivo: "o próprio SCPI informou que a célula não está editável neste estado",
        metodos: ["Ext.data.Model.set/endEdit"],
      };
    }

    let nomeCampo = contexto.coluna.getDataIndex?.() ?? contexto.coluna.dataIndex;
    if (nomeCampo === undefined || nomeCampo === null || nomeCampo === "") {
      return {
        ok: false,
        motivo: "a coluna ExtJS não informou o dataIndex do campo",
        metodos: ["Ext.data.Model.set/endEdit"],
      };
    }
    if (typeof contexto.record.set !== "function") {
      return {
        ok: false,
        motivo: "o registro ExtJS não oferece o método set",
        metodos: ["Ext.data.Model.set/endEdit"],
      };
    }

    try {
      // O editor visual do SCPI é destruído pela resposta Ajax que atualiza/ordena
      // a grade. Atualizar o Model evita deixar um editor DOM ativo durante essa troca.
      try {
        plugin?.cancelEdit?.();
        contexto.grade.setActionableMode?.(false);
      } catch {
        // Um editor antigo pode já ter sido removido pelo próprio SCPI.
      }

      const criarContextoEvento = (ctx, novoValor) => ({
        grid: ctx.grade,
        view: ctx.view,
        store: ctx.grade.getStore?.() || ctx.view.getStore?.(),
        record: ctx.record,
        column: ctx.coluna,
        field: nomeCampo,
        rowIdx: ctx.indiceLinha,
        colIdx: ctx.indiceColunaExt,
        originalValue: ctx.record.get?.(nomeCampo) ?? ctx.record.data?.[nomeCampo],
        value: novoValor,
        cancel: false,
      });
      let evento = criarContextoEvento(contexto, valor);
      if (plugin?.fireEvent?.("beforeedit", plugin, evento) === false || evento.cancel) {
        return {
          ok: false,
          bloqueado: true,
          motivo: "o SCPI cancelou o evento beforeedit da célula",
          metodos: ["beforeedit → Ext.data.Model.set/endEdit → edit"],
        };
      }
      if (typeof plugin?.fireEvent === "function") {
        ultimaRequisicaoEm = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await aguardarAjaxLivre("o SCPI preparar o dataset para edição");
      }

      registro = localizarRegistro();
      contexto = contextoCelulaExt(registro, indiceColuna);
      if (!contexto) {
        return {
          ok: false,
          instavel: true,
          motivo: "a linha desapareceu após o SCPI preparar o dataset para edição",
          metodos: ["beforeedit → Ext.data.Model.set/endEdit → edit"],
        };
      }
      plugin = pluginEdicaoDaGrade(contexto.grade);
      nomeCampo = contexto.coluna.getDataIndex?.() ?? contexto.coluna.dataIndex;
      if (nomeCampo === undefined || nomeCampo === null || nomeCampo === "") {
        return {
          ok: false,
          instavel: true,
          motivo: "a coluna perdeu o dataIndex após o SCPI preparar o dataset para edição",
          metodos: ["beforeedit → Ext.data.Model.set/endEdit → edit"],
        };
      }
      if (typeof contexto.record.set !== "function") {
        return {
          ok: false,
          instavel: true,
          motivo: "a nova linha do ExtJS não oferece o método set",
          metodos: ["beforeedit → Ext.data.Model.set/endEdit → edit"],
        };
      }
      evento = criarContextoEvento(contexto, valor);
      if (plugin?.fireEvent?.("validateedit", plugin, evento) === false || evento.cancel) {
        return {
          ok: false,
          bloqueado: true,
          motivo: "o SCPI rejeitou o valor no evento validateedit",
          metodos: ["beforeedit → validateedit"],
        };
      }

      const transacao = typeof contexto.record.beginEdit === "function"
        && typeof contexto.record.endEdit === "function";
      if (transacao) contexto.record.beginEdit();
      contexto.record.set(nomeCampo, valor);
      if (transacao) contexto.record.endEdit(false, [nomeCampo]);
      plugin?.fireEvent?.("edit", plugin, evento);
      if (typeof plugin?.fireEvent === "function") {
        ultimaRequisicaoEm = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await aguardarAjaxLivre("o SCPI gravar a alteração da célula");
      }
      return {
        ok: true,
        metodos: ["beforeedit → validateedit → Ext.data.Model.set/endEdit → edit"],
      };
    } catch (erro) {
      if (
        erro instanceof Error
        && [
          "__SCRIPT_PREFEITURA_GRADE_SUJA__",
          "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__",
        ].includes(erro.message)
      ) {
        throw erro;
      }
      return {
        ok: false,
        instavel: true,
        motivo: erro instanceof Error ? erro.message : String(erro),
        metodos: ["beforeedit → validateedit → Ext.data.Model.set/endEdit → edit"],
      };
    }
  };

  const editarNumeroNaCelula = async (
    localizarRegistro,
    indiceColuna,
    valorEsperado,
    descricaoCelula,
    inserirDiretamente = false,
    tentativaGrade = 0,
  ) => {
    await aguardarGradePronta(`a grade estabilizar antes de editar ${descricaoCelula}`);
    let registro = localizarRegistro();
    let celula = registro?.celulas?.[indiceColuna];
    let ancora = registro?.celulas?.find((item, indice) => indice !== indiceColuna && visivel(item));
    if (!celula || !ancora) {
      throw new Error(
        `A célula ${descricaoCelula} não foi localizada. Colunas visíveis: ${registro?.cabecalhos?.join(", ") || "nenhuma"}.`,
      );
    }
    if (quantidadeIgual(numeroDaGrade(texto(celula)), valorEsperado)) return false;

    let diagnosticoExt = "não solicitado";
    try {
      if (inserirDiretamente) {
        const resultadoExt = await editarNumeroPeloExt(
          localizarRegistro,
          indiceColuna,
          valorEsperado,
        );
        diagnosticoExt = `${resultadoExt.motivo || "edição iniciada"}`
          + `${resultadoExt.metodos?.length ? ` (${resultadoExt.metodos.join(" → ")})` : ""}`;
        if (resultadoExt.instavel) {
          const erroEditor = new Error("__SCRIPT_PREFEITURA_EDITOR_INSTAVEL__");
          erroEditor.detalhe = diagnosticoExt;
          throw erroEditor;
        }
        if (resultadoExt.ok) {
          try {
            await esperar(`confirmar ${descricaoCelula} pela edição ExtJS`, () => {
              registro = localizarRegistro();
              const atual = numeroDaGrade(texto(registro?.celulas?.[indiceColuna]));
              return quantidadeIgual(atual, valorEsperado) ? true : null;
            });
            await aguardarMs(intervaloSeguro);
            await aguardarGradePronta(`o SCPI concluir a gravação de ${descricaoCelula}`);
            return true;
          } catch (erroConfirmacao) {
            if (
              erroConfirmacao instanceof Error
              && [
                "__SCRIPT_PREFEITURA_GRADE_SUJA__",
                "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__",
              ].includes(erroConfirmacao.message)
            ) {
              throw erroConfirmacao;
            }
            const erroEditor = new Error("__SCRIPT_PREFEITURA_EDITOR_INSTAVEL__");
            erroEditor.detalhe = erroConfirmacao instanceof Error
              ? erroConfirmacao.message
              : String(erroConfirmacao);
            throw erroEditor;
          }
        }
      }

      if (!celula || !ancora) {
        throw new Error(`A célula ${descricaoCelula} desapareceu após a tentativa de edição ExtJS.`);
      }
      const editor = await abrirEditorNumerico(
        celula,
        descricaoCelula,
        () => {
          registro = localizarRegistro();
          return iniciarEdicaoPeloExt(registro, indiceColuna);
        },
        () => localizarRegistro()?.celulas?.[indiceColuna],
      );
      await aguardarModoEdicao(descricaoCelula);
      const valorEditor = String(valorEsperado).replace(".", ",");
      editor.focus?.();
      editor.select?.();
      let inseridoNativamente = false;
      try {
        inseridoNativamente = doc.execCommand?.("insertText", false, valorEditor) === true
          && editor.value === valorEditor;
      } catch {
        inseridoNativamente = false;
      }
      if (!inseridoNativamente) {
        editor.value = valorEditor;
        editor.dispatchEvent?.(new Event("input", { bubbles: true }));
      }
      editor.dispatchEvent?.(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      clicarForaDoEditor(ancora, editor);
      await esperar(`confirmar ${descricaoCelula}`, () => {
        registro = localizarRegistro();
        const atual = numeroDaGrade(texto(registro?.celulas?.[indiceColuna]));
        return !visivel(editor) && quantidadeIgual(atual, valorEsperado) ? true : null;
      });
      await aguardarMs(intervaloSeguro);
      await aguardarGradePronta(`o SCPI concluir a gravação de ${descricaoCelula}`);
      return true;
    } catch (erro) {
      if (erroImpedeContinuar(erro)) throw erro;
      const rejeicaoRecuperavel = erro instanceof Error && [
        "__SCRIPT_PREFEITURA_GRADE_SUJA__",
        "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__",
        "__SCRIPT_PREFEITURA_EDITOR_INSTAVEL__",
      ].includes(erro.message);
      if (rejeicaoRecuperavel) {
        const datasetForaDeEdicao = erro.message === "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__";
        const editorInstavel = erro.message === "__SCRIPT_PREFEITURA_EDITOR_INSTAVEL__";
        if (tentativaGrade < 3) {
          resposta.etapas.push(
            datasetForaDeEdicao
              ? `${descricaoCelula}: o dataset do SCPI ainda não estava em modo de edição; reabrindo a célula e tentando novamente.`
              : editorInstavel
                ? `${descricaoCelula}: o SCPI refez a linha durante a atualização do registro; aguardando a grade estabilizar e tentando novamente.`
                : `${descricaoCelula}: o SCPI ainda estava atualizando a grade; aguardando estabilizar e tentando novamente.`,
          );
          cancelarEdicaoDaCelula(localizarRegistro(), indiceColuna);
          await aguardarGradePronta(`a grade ficar pronta antes de repetir ${descricaoCelula}`);
          return editarNumeroNaCelula(
            localizarRegistro,
            indiceColuna,
            valorEsperado,
            descricaoCelula,
            inserirDiretamente,
            tentativaGrade + 1,
          );
        }
        throw new Error(
          datasetForaDeEdicao
            ? `O SCPI não colocou o dataset em modo de edição após ${tentativaGrade + 1} tentativas ao editar ${descricaoCelula}.`
            : editorInstavel
              ? `A linha do SCPI foi recriada durante ${tentativaGrade + 1} tentativas ao atualizar ${descricaoCelula}: ${erro.detalhe || diagnosticoExt}.`
              : `O SCPI manteve a grade em estado dirty após ${tentativaGrade + 1} tentativas ao editar ${descricaoCelula}.`,
        );
      }
      registro = localizarRegistro();
      const exibido = texto(registro?.celulas?.[indiceColuna]) || "<vazio>";
      const causa = erro instanceof Error ? erro.message : String(erro);
      throw new Error(
        `${causa} Valor esperado em ${descricaoCelula}: ${valorEsperado}; valor exibido: ${exibido}; `
        + `métodos tentados: ${inserirDiretamente ? `ExtJS [${diagnosticoExt}] e editor inline` : "editor inline"}.`,
      );
    }
  };

  const campoDoRotulo = (nome) => {
    const rotulo = [...doc.querySelectorAll('label, .x-form-item-label, [data-ref="labelEl"]')]
      .find((elemento) => texto(elemento) === nome && visivel(elemento));
    if (!rotulo) return null;

    const associado = rotulo.htmlFor ? doc.getElementById?.(rotulo.htmlFor) : null;
    if (associado && visivel(associado)) return associado;

    const areaRotulo = rotulo.getBoundingClientRect?.();
    if (!areaRotulo) return null;
    return [...doc.querySelectorAll("input, textarea")]
      .filter((elemento) => {
        if (!habilitado(elemento)) return false;
        const area = elemento.getBoundingClientRect?.();
        if (!area) return false;
        const centroRotulo = areaRotulo.top + areaRotulo.height / 2;
        const centroCampo = area.top + area.height / 2;
        return area.left >= areaRotulo.right - 5 && Math.abs(centroCampo - centroRotulo) <= 20;
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0];
  };

  const preencher = (campo, valor) => {
    campo.focus?.();
    campo.value = valor;
    campo.dispatchEvent?.(new Event("input", { bubbles: true }));
    campo.dispatchEvent?.(new Event("change", { bubbles: true }));
    campo.blur?.();
  };

  const formularioSolicitacaoNovo = () =>
    Boolean(
      aba("Dados da Solicitação") &&
      habilitado(botao("Salvar")) &&
      habilitado(botao("Cancelar")) &&
      botao("Inserir") &&
      !habilitado(botao("Inserir")),
    );

  const menuSolicitacao = linhaMenu("Solicitação", 2);
  const menuProcessoCompra = linhaMenu("Processo de Compra", 2);
  if (!menuSolicitacao || !menuProcessoCompra) return resposta;
  resposta.matched = true;
  if (globalThis.__scriptPrefeituraExecutando) {
    return {
      ...resposta,
      alreadyRunning: true,
      error: "Já existe uma execução do Fluxo SCPI em andamento neste quadro do SCPI.",
    };
  }
  globalThis.__scriptPrefeituraExecutando = true;
  alertaOriginal = globalThis.alert;
  alertaInterceptado = function interceptarAlerta(mensagem) {
    if (/BLOCKING METHOD MESSAGEDLG\(\) CAN NOT BE CALLED HERE\.?/i.test(String(mensagem || ""))) {
      messageDlgBloqueanteDetectado = true;
      return;
    }
    if (/GRID IS IN DIRTY STATE\. NO MORE UPDATES CAN BE APPLIED\.?/i.test(String(mensagem || ""))) {
      modoConservadorAte = Date.now() + 30000;
      alertaEdicaoRejeitada = {
        codigo: "__SCRIPT_PREFEITURA_GRADE_SUJA__",
        mensagem: String(mensagem),
      };
      return;
    }
    if (/DATASET NOT IN EDIT OR INSERT MODE\.?/i.test(String(mensagem || ""))) {
      modoConservadorAte = Date.now() + 30000;
      alertaEdicaoRejeitada = {
        codigo: "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__",
        mensagem: String(mensagem),
      };
      return;
    }
    return alertaOriginal?.apply(this, arguments);
  };
  globalThis.alert = alertaInterceptado;
  globalThis.__scriptPrefeituraControle = null;
  painelExecucao = criarPainelExecucao();
  globalThis.__scriptPrefeituraProgresso = {
    fase,
    tipo: "Etapa",
    atual: 0,
    total: 0,
    etapa: `Iniciando ${fase}`,
  };
  atualizarPainelExecucao(globalThis.__scriptPrefeituraProgresso);
  let indiceProdutoAtual = indiceInicial;
  let indiceAbastecimentoAtual = indiceAbastecimentoInicial;
  let indiceQuantidadeAbastecimentoAtual = indiceQuantidadeAbastecimentoInicial;
  let centroCustoPendenteAtual = null;
  let contextoAbastecimentoAtual = null;

  const publicarProgressoAbastecimento = (tipo, indice, total, etapa) => {
    globalThis.__scriptPrefeituraProgresso = {
      fase,
      tipo,
      atual: Math.min(indice + 1, total),
      total,
      etapa,
    };
    atualizarPainelExecucao(globalThis.__scriptPrefeituraProgresso);
  };

  const atualizarEtapaAbastecimento = (etapa) => {
    if (!contextoAbastecimentoAtual) return;
    contextoAbastecimentoAtual.etapa = etapa;
    publicarProgressoAbastecimento(
      "Item",
      contextoAbastecimentoAtual.indice,
      contextoAbastecimentoAtual.total,
      etapa,
    );
  };

  const erroImpedeContinuar = (erro) => {
    const mensagem = normalizar(erro instanceof Error ? erro.message : String(erro));
    return mensagem.includes("SCRIPT PREFEITURA CANCELADO")
      || mensagem.includes("SCRIPT PREFEITURA FINALIZADO")
      || mensagem.includes("SCRIPT PREFEITURA VIRADA MANUAL")
      || mensagem.includes("SCRIPT PREFEITURA KM ALTO MANUAL")
      || mensagem.includes("SCRIPT PREFEITURA LINHA INCOMPATIVEL")
      || mensagem.includes("O SCPI INTERROMPEU A EXECUCAO")
      || mensagem.includes("O SCPI EXIBIU AJAX ERROR")
      || /(COLUNAS?.+NAO (?:FOI|FORAM) LOCALIZAD|GRADE.+NAO FOI LOCALIZAD|ITEM \d+ NAO FOI LOCALIZAD|LINHA \d+ PERTENCE A PLACA|CELULA.+NAO FOI LOCALIZAD)/.test(mensagem)
      || /(429|TOO MANY REQUESTS|SESSAO (EXPIRADA|ENCERRADA|EXPIROU)|ACESSO (BLOQUEADO|NEGADO))/.test(mensagem);
  };

  const erroPausaManual = (codigo, mensagem) => {
    const erro = new Error(codigo);
    erro.mensagemUsuario = mensagem;
    return erro;
  };

  const avisoKmMuitoAltaAberto = () => [
      ...doc.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ...doc.querySelectorAll(".x-window, .x-message-box"),
    ].find((elemento) =>
      visivel(elemento)
      && normalizar(texto(elemento)).includes("QUILOMETRAGEM MUITO ALTA"));

  const erroAjaxAberto = () => [
      ...doc.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ...doc.querySelectorAll(".x-window, .x-message-box"),
    ].find((elemento) =>
      visivel(elemento)
      && normalizar(texto(elemento)).includes("AJAX ERROR"));

  const fecharErroAjax = async () => {
    if (fechamentoErroAjaxEmAndamento) return fechamentoErroAjaxEmAndamento;
    const aviso = erroAjaxAberto();
    if (!aviso) return false;
    fechamentoErroAjaxEmAndamento = (async () => {
      const mensagem = texto(aviso);
      const ok = [...aviso.querySelectorAll?.('button, [role="button"], a') || []]
        .find((elemento) => normalizar(texto(elemento)) === "OK" && habilitado(elemento));
      if (!ok) throw new Error(`O SCPI exibiu um Ajax Error, mas o botão OK não foi localizado: ${mensagem}`);
      clicar(ok);
      const limite = Date.now() + timeoutMs;
      while (visivel(aviso) && Date.now() < limite) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (visivel(aviso)) throw new Error("O Ajax Error não fechou após clicar em OK.");
      erroAjaxPendente = mensagem;
      modoConservadorAte = Date.now() + 30000;
      resposta.etapas.push(`Ajax Error fechado; a execução será interrompida: ${mensagem.slice(0, 500)}`);
      return true;
    })();
    try {
      return await fechamentoErroAjaxEmAndamento;
    } finally {
      fechamentoErroAjaxEmAndamento = null;
    }
  };

  if (typeof globalThis.MutationObserver === "function" && doc.documentElement) {
    observadorErroAjax = new globalThis.MutationObserver(() => {
      void fecharErroAjax().catch((erro) => {
        resposta.etapas.push(
          `Falha ao liberar automaticamente um Ajax Error: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      });
    });
    observadorErroAjax.observe(doc.documentElement, { childList: true, subtree: true });
  }

  async function aguardarControle() {
    const inicioPausa = Date.now();
    while (globalThis.__scriptPrefeituraControle === "pausar") {
      await fecharErroAjax();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (globalThis.__scriptPrefeituraControle === "cancelar") {
      throw new Error("__SCRIPT_PREFEITURA_CANCELADO__");
    }
    if (globalThis.__scriptPrefeituraControle === "finalizar") {
      throw new Error("__SCRIPT_PREFEITURA_FINALIZADO__");
    }
    await fecharErroAjax();
    if (erroAjaxPendente) {
      const mensagem = erroAjaxPendente;
      erroAjaxPendente = null;
      throw new Error(`O SCPI exibiu Ajax Error e a operação atual não foi confirmada: ${mensagem}`);
    }
    const avisoKmMuitoAlta = avisoKmMuitoAltaAberto();
    if (avisoKmMuitoAlta) {
      throw erroPausaManual(
        "__SCRIPT_PREFEITURA_KM_ALTO_MANUAL__",
        "O SCPI informou quilometragem muito alta. Confira o valor, clique em OK manualmente e depois continue.",
      );
    }
    return Date.now() - inicioPausa;
  }

  const intervaloSeguro = Math.max(0, Number(intervaloRequisicaoMs) || 0);
  const intervaloRapido = Math.min(
    intervaloSeguro,
    Math.max(0, Number(intervaloRapidoMs) || 0),
  );
  let ultimaRequisicaoEm = 0;
  const aguardarMs = async (duracao) => {
    const fim = Date.now() + duracao;
    while (Date.now() < fim) {
      await aguardarControle();
      const restante = fim - Date.now();
      if (restante <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, restante)));
    }
    await aguardarControle();
  };
  const confirmacaoKmAberta = () => [
      ...doc.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ...doc.querySelectorAll(".x-window, .x-message-box"),
    ].find((elemento) =>
      visivel(elemento)
      && normalizar(texto(elemento)).includes("KM ATUAL MENOR QUE A KM ANTERIOR"));

  const verificarBloqueio = () => {
    const confirmacaoKm = confirmacaoKmAberta();
    if (confirmacaoKm) {
      throw erroPausaManual(
        "__SCRIPT_PREFEITURA_VIRADA_MANUAL__",
        "O KM do XLSX é menor que a KM Anterior do veículo. Escolha Sim ou Não na confirmação de virada de velocímetro do SCPI e depois continue.",
      );
    }
    const alerta = [...doc.querySelectorAll('[role="alert"], [role="alertdialog"], .x-message-box, .x-toast')]
      .find((elemento) => {
        if (!visivel(elemento)) return false;
        return /(429|TOO MANY REQUESTS|MUITAS REQUISICOES|EXCESSO DE REQUISICOES|LIMITE DE REQUISICOES|SESSAO (EXPIRADA|ENCERRADA|EXPIROU)|ACESSO (BLOQUEADO|NEGADO))/.test(normalizar(texto(elemento)));
      });
    if (alerta) throw new Error(`O SCPI interrompeu a execução: ${texto(alerta)}`);
  };
  const ajaxEmAndamento = () => Boolean(globalThis.Ext?.Ajax?.isLoading?.())
    || [...doc.querySelectorAll(".x-mask-msg, .x-loading-mask")].some(visivel);
  const aguardarAjaxLivre = (descricao) =>
    esperar(descricao, () => ajaxEmAndamento() ? null : true);
  const acionarServidor = async (elemento, { sensivel = false } = {}) => {
    verificarBloqueio();
    await aguardarAjaxLivre("o SCPI concluir a requisição anterior");
    const intervaloAtual = sensivel || Date.now() < modoConservadorAte
      ? intervaloSeguro
      : intervaloRapido;
    const espera = intervaloAtual - (Date.now() - ultimaRequisicaoEm);
    if (espera > 0) await aguardarMs(espera);
    await aguardarAjaxLivre("o SCPI liberar a próxima ação");
    verificarBloqueio();
    clicar(elemento);
    ultimaRequisicaoEm = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await aguardarAjaxLivre("o SCPI concluir a ação solicitada");
    await aguardarControle();
  };
  const resolverViradaKm = async (aguardarAparecer = false) => {
    let confirmacao = confirmacaoKmAberta();
    if (!confirmacao && aguardarAparecer) {
      const limite = Date.now() + Math.min(500, timeoutMs);
      while (!confirmacao && Date.now() < limite) {
        await aguardarMs(50);
        confirmacao = confirmacaoKmAberta();
      }
    }
    if (!confirmacao) return null;
    throw erroPausaManual(
      "__SCRIPT_PREFEITURA_VIRADA_MANUAL__",
      "O KM do XLSX é menor que a KM Anterior do veículo. Escolha Sim ou Não na confirmação de virada de velocímetro do SCPI e depois continue.",
    );
  };

  const botaoComFinal = (rotulo) =>
    [...doc.querySelectorAll('button, [role="button"], a')]
      .find((elemento) => normalizar(texto(elemento)).endsWith(rotulo) && habilitado(elemento));

  const linhasDaJanela = (janela) => {
    for (const seletor of [".x-grid-item", ".x-grid-row", "tr[role='row']", "[role='row']"]) {
      const linhas = [...janela?.querySelectorAll?.(seletor) || []].filter(visivel);
      if (linhas.length) return linhas;
    }
    return [];
  };

  const tipoCombustivel = (produto) =>
    ["ETANOL", "DIESEL", "GASOLINA"].find((tipo) => normalizar(produto).includes(tipo));

  const opcoesDeCombustivel = (janela, combustivel) => {
    for (const seletor of [".x-grid-cell-inner", "[role='gridcell']", "td"]) {
      const opcoes = [...janela?.querySelectorAll?.(seletor) || []]
        .filter((elemento) => visivel(elemento) && normalizar(texto(elemento)).includes(combustivel));
      if (opcoes.length) return opcoes;
    }
    return [];
  };

  const abrirProdutoDoPedido = async (indiceEsperado, produtoEsperado) => {
    const quantidadeAntes = registroSaida(indiceEsperado)?.linhas?.length ?? 0;
    let janela = dialogo("Pesquisa Pedido de Compra");
    if (!janela) {
      if (quantidadeAntes > 0) {
        const novoItem = await esperar("o botão Novo Item habilitar", () => botaoComFinal("NOVO ITEM"));
        clicar(novoItem);
        await esperar("o editor do item anterior fechar", () =>
          ![...doc.querySelectorAll('input[role="spinbutton"]')].some(visivel));
      }
      const abrirProduto = await esperar("o botão F2 - Produto habilitar", () =>
        botaoComFinal("F2 PRODUTO") || botaoComFinal("PRODUTO"));
      clicar(abrirProduto);
      let ultimaTentativaMenu = Date.now();
      const produtoDoPedido = await esperar("a opção Produto do Pedido aparecer", () => {
        const produto = opcao("Produto do Pedido");
        if (produto) return produto;
        if (Date.now() - ultimaTentativaMenu >= 500) {
          clicar(abrirProduto);
          ultimaTentativaMenu = Date.now();
        }
        return null;
      });
      await acionarServidor(produtoDoPedido);
      janela = await esperar("a Pesquisa Pedido de Compra abrir", () => dialogo("Pesquisa Pedido de Compra"));
    }
    await esperar("os itens do pedido carregarem", () => {
      verificarBloqueio();
      return !visivel(janela.querySelector?.(".x-mask-msg, .x-loading-mask"));
    });
    const combustivelEsperado = tipoCombustivel(produtoEsperado);
    if (!combustivelEsperado) {
      throw new Error(`O combustível “${produtoEsperado}” do XLSX não foi reconhecido como etanol, diesel ou gasolina.`);
    }
    const opcoes = await esperar(`a opção ${combustivelEsperado} aparecer no Produto do Pedido`, () => {
      const atuais = opcoesDeCombustivel(janela, combustivelEsperado);
      return atuais.length ? atuais : null;
    });
    if (opcoes.length !== 1) {
      throw new Error(
        `O Produto do Pedido teve ${opcoes.length} opção(ões) visíveis com “${combustivelEsperado}”. Confira a seleção antes de continuar.`,
      );
    }
    await acionarServidor(opcoes[0]);
    const confirmar = await esperar("o botão Confirmar do Produto do Pedido habilitar", () =>
      [...janela.querySelectorAll?.("button, [role='button'], a") || []]
        .find((elemento) => normalizar(texto(elemento)) === "CONFIRMAR" && habilitado(elemento)));
    await acionarServidor(confirmar, { sensivel: true });
    await esperar("a Pesquisa Pedido de Compra fechar", () => !visivel(janela));
    await esperar("o novo item aparecer na grade", () => {
      const registro = registroSaida(indiceEsperado);
      return registro?.linha || (registro?.linhas?.length ?? 0) > quantidadeAntes ? registro : null;
    });
  };

  const placaCompacta = (valor) => normalizar(valor).replace(/\s/g, "");

  const linhaContemPlaca = (registro, placa) =>
    placaCompacta(texto(registro?.linha)).includes(placaCompacta(placa));

  const registroTemPlacaExata = (registro, placa) => {
    const indicePlaca = registro?.cabecalhos?.findIndex((nome) => nome.startsWith("PLACA")) ?? -1;
    if (indicePlaca < 0) return linhaContemPlaca(registro, placa);
    return placaCompacta(texto(registro?.celulas?.[indicePlaca])) === placaCompacta(placa);
  };

  const erroLinhaIncompativel = (mensagem) =>
    new Error(`__SCRIPT_PREFEITURA_LINHA_INCOMPATIVEL__: ${mensagem}`);

  const validarProdutoDoRegistro = (indice, abastecimento) => {
    const registro = registroSaida(indice);
    if (!registro?.linha) throw erroLinhaIncompativel(`O item ${indice + 1} não foi localizado na grade.`);
    const esperado = tipoCombustivel(abastecimento.produto);
    const encontrado = tipoCombustivel(texto(registro.linha));
    if (encontrado !== esperado) {
      throw erroLinhaIncompativel(
        `O item ${indice + 1} contém ${encontrado || "combustível não identificado"}, mas o XLSX espera ${esperado}.`,
      );
    }
    return registro;
  };

  const validarPlacaDoRegistro = (indice, abastecimento, obrigatoria = true) => {
    const registro = registroSaida(indice);
    if (!registro?.linha) throw erroLinhaIncompativel(`O item ${indice + 1} não foi localizado na grade.`);
    const indicePlaca = registro.cabecalhos.findIndex((nome) => nome.startsWith("PLACA"));
    if (indicePlaca < 0) throw erroLinhaIncompativel("A coluna Placa não foi localizada na grade.");
    const encontrada = placaCompacta(texto(registro.celulas[indicePlaca]));
    if (obrigatoria && encontrada !== placaCompacta(abastecimento.placa)) {
      throw erroLinhaIncompativel(
        `O item ${indice + 1} pertence à placa ${encontrada || "<vazia>"}, mas o XLSX informa ${abastecimento.placa}.`,
      );
    }
    return registro;
  };

  const selecionarCentroCusto = async (indice, placa, fecharSeNaoEncontrada = false) => {
    let registro = registroSaida(indice);
    if (registroTemPlacaExata(registro, placa)) return { alterado: false };

    let janela = dialogo("Pesquisa Centro de Custo");
    if (!janela) {
      registro = await selecionarRegistroSaida(indice);
      const abrirCentro = await esperar("o botão F3 - C.Custo habilitar", () => botaoComFinal("F3 C CUSTO"));
      await acionarServidor(abrirCentro, { sensivel: true });
      janela = await esperar("a Pesquisa Centro de Custo abrir", () => dialogo("Pesquisa Centro de Custo"));
      const pesquisarPorPlaca = await esperar("a opção de pesquisa por Placa aparecer", () => opcao("Placa"));
      clicar(pesquisarPorPlaca);
    }
    const pesquisar = await esperar("o botão Pesquisar centro de custo habilitar", () =>
      [...janela.querySelectorAll?.("button, [role='button'], a") || []]
        .find((elemento) => normalizar(texto(elemento)) === "PESQUISAR" && habilitado(elemento)));
    const campo = campoAntesDoBotao(pesquisar);
    if (!campo) throw new Error("O campo de pesquisa do centro de custo não foi localizado.");
    preencher(campo, placa);
    await acionarServidor(pesquisar);
    const pesquisaIniciada = Date.now();
    const resultadoPesquisa = await esperar("a pesquisa de centro de custo terminar", () => {
      verificarBloqueio();
      if (visivel(janela.querySelector?.(".x-mask-msg, .x-loading-mask"))) return null;
      const atuais = linhasDaJanela(janela)
        .filter((linha) => placaCompacta(texto(linha)).includes(placaCompacta(placa)));
      if (atuais.length) return atuais;
      const esperaVazia = Math.min(800, Math.max(100, timeoutMs * 0.6));
      return Date.now() - pesquisaIniciada >= esperaVazia ? [] : null;
    });
    const resultados = resultadoPesquisa;
    if (!resultados.length) {
      if (fecharSeNaoEncontrada) {
        const cancelar = [...janela.querySelectorAll?.("button, [role='button'], a") || []]
          .find((elemento) => normalizar(texto(elemento)) === "CANCELAR" && habilitado(elemento));
        if (!cancelar) throw new Error("A placa não foi encontrada e o botão Cancelar da pesquisa também não foi localizado.");
        clicar(cancelar);
        await esperar("a Pesquisa Centro de Custo fechar", () => !visivel(janela));
      }
      return { naoEncontrada: true, opcoes: [] };
    }
    if (resultados.length !== 1) {
      return { pendente: true, opcoes: resultados.map((linha) => texto(linha)).slice(0, 5) };
    }

    await acionarServidor(resultados[0]);
    const confirmar = await esperar("o botão Confirmar centro de custo habilitar", () =>
      [...janela.querySelectorAll?.("button, [role='button'], a") || []]
        .find((elemento) => normalizar(texto(elemento)) === "CONFIRMAR" && habilitado(elemento)));
    await acionarServidor(confirmar, { sensivel: true });
    await esperar("a Pesquisa Centro de Custo fechar", () => !visivel(janela));
    const messageDlgDuranteCentroCusto = messageDlgBloqueanteDetectado;
    messageDlgBloqueanteDetectado = false;
    const confirmacaoVirada = await resolverViradaKm(messageDlgDuranteCentroCusto);
    if (messageDlgDuranteCentroCusto && !confirmacaoVirada) {
      throw new Error("O SCPI rejeitou um MessageDlg bloqueante, mas a confirmação de virada de velocímetro não apareceu.");
    }
    await aguardarGradePronta(`a grade atualizar o centro de custo do item ${indice + 1}`);
    await rolarItensSaida("direita");
    registro = await esperar(`a placa ${placa} aparecer na coluna Placa (F9) do item ${indice + 1}`, () => {
      const atual = registroSaida(indice);
      return registroTemPlacaExata(atual, placa) ? atual : null;
    });
    return { alterado: Boolean(registro) };
  };

  try {
    if (["conferir_quantidades", "conferir_placas", "conferir_km"].includes(fase)) {
      resposta.falhasAbastecimentos = [];
      resposta.placasNaoEncontradas = [];
      resposta.kmsIgnorados = [];
      if (!Array.isArray(abastecimentos) || !abastecimentos.length) {
        throw new Error("Nenhum abastecimento válido foi recebido do XLSX.");
      }
      if (abastecimentos.length > 500) {
        throw new Error("A execução aceita no máximo 500 abastecimentos por XLSX.");
      }
      if (abastecimentos.some((item) =>
        !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(String(item?.placa || ""))
        || !Number.isFinite(Number(item?.litros))
        || Number(item.litros) <= 0
        || (fase === "conferir_km" && (!Number.isSafeInteger(Number(item?.km)) || Number(item.km) < 0)))) {
        throw new Error("Os dados de placa, litros ou KM recebidos do XLSX são inválidos.");
      }
      const itensSaida = await esperar("a aba Itens da Saída aparecer", () => aba("Itens da Saída"));
      if (!abaSelecionada(itensSaida)) clicar(itensSaida);
      await esperar("a aba Itens da Saída abrir", () => abaSelecionada(itensSaida));
      await rolarItensSaida("esquerda");
      const totalNaGrade = registroSaida(0)?.linhas?.length || 0;
      if (totalNaGrade < abastecimentos.length) {
        throw new Error(`A grade possui ${totalNaGrade} item(ns), mas o XLSX possui ${abastecimentos.length}.`);
      }

      if (fase === "conferir_quantidades") {
        let corrigidas = 0;
        for (let indice = 0; indice < abastecimentos.length; indice += 1) {
          await aguardarControle();
          const abastecimento = abastecimentos[indice];
          contextoAbastecimentoAtual = {
            indice,
            total: abastecimentos.length,
            abastecimento,
            etapa: "conferir QTD",
          };
          publicarProgressoAbastecimento(
            "Conferência QTD",
            indice,
            abastecimentos.length,
            `conferindo item ${indice + 1}`,
          );
          try {
            await rolarItensSaida("direita");
            validarPlacaDoRegistro(indice, abastecimento);
            await rolarItensSaida("esquerda");
            validarProdutoDoRegistro(indice, abastecimento);
            const registro = registroSaida(indice);
            const indiceQuantidade = registro?.cabecalhos?.indexOf("QTD") ?? -1;
            if (indiceQuantidade < 0) {
              throw new Error(`A coluna QTD do item ${indice + 1} não foi localizada.`);
            }
            const alterada = await editarNumeroNaCelula(
              () => registroSaida(indice),
              indiceQuantidade,
              Number(abastecimento.litros),
              `QTD do item ${indice + 1}`,
              true,
            );
            if (alterada) corrigidas += 1;
            resposta.etapas.push(
              `QTD ${indice + 1}/${abastecimentos.length}: ${alterada ? `corrigida para ${abastecimento.litros} L` : "correta"}.`,
            );
          } catch (erro) {
            if (erroImpedeContinuar(erro)) throw erro;
            const mensagem = erro instanceof Error ? erro.message : String(erro);
            resposta.falhasAbastecimentos.push({
              indice: indice + 1,
              placa: abastecimento.placa,
              etapa: "QTD",
              erro: mensagem,
            });
            resposta.etapas.push(
              `QTD ${indice + 1}/${abastecimentos.length}: falha ao conferir; item pulado: ${mensagem}`,
            );
          }
        }
        const resumo = `Conferência concluída: ${abastecimentos.length} quantidade(s), ${corrigidas} corrigida(s) e ${resposta.falhasAbastecimentos.length} falha(s) técnica(s).`;
        const relatorioTexto = resumo + montarRelatorioFalhas(resposta.falhasAbastecimentos);
        resposta.etapas.push(relatorioTexto);
        publicarProgressoAbastecimento("Concluído", abastecimentos.length - 1, abastecimentos.length, resumo);
        finalizarPainelExecucao("concluido", relatorioTexto);
        return {
          ...resposta,
          ok: true,
          relatorioConferencia: {
            tipo: "quantidades",
            total: abastecimentos.length,
            corrigidas,
            falhas: resposta.falhasAbastecimentos,
            texto: relatorioTexto,
          },
        };
      }

      if (fase === "conferir_km") {
        let corrigidos = 0;
        await rolarItensSaida("direita");
        for (let indice = 0; indice < abastecimentos.length; indice += 1) {
          await aguardarControle();
          const abastecimento = abastecimentos[indice];
          contextoAbastecimentoAtual = {
            indice,
            total: abastecimentos.length,
            abastecimento,
            etapa: "verificar KM Atual",
          };
          publicarProgressoAbastecimento(
            "Verificação de KM",
            indice,
            abastecimentos.length,
            `conferindo ${abastecimento.placa}`,
          );
          try {
            await resolverViradaKm();
            let registro = await selecionarRegistroSaida(indice);
            const indicePlaca = registro?.cabecalhos?.findIndex((nome) => nome.startsWith("PLACA")) ?? -1;
            const indiceAnterior = registro?.cabecalhos?.indexOf("ANTERIOR") ?? -1;
            const indiceAtual = registro?.cabecalhos?.indexOf("ATUAL") ?? -1;
            if (indicePlaca < 0 || indiceAnterior < 0 || indiceAtual < 0) {
              throw new Error(`As colunas Placa, Anterior e Atual do item ${indice + 1} não foram localizadas.`);
            }
            const placaNaGrade = placaCompacta(texto(registro.celulas[indicePlaca]));
            if (placaNaGrade !== placaCompacta(abastecimento.placa)) {
              throw new Error(
                `A linha ${indice + 1} pertence à placa ${placaNaGrade || "<vazia>"}, mas o XLSX informa ${abastecimento.placa}.`,
              );
            }
            const kmEsperado = Number(abastecimento.km);
            const kmAnterior = numeroDaGrade(texto(registro.celulas[indiceAnterior]));
            const kmExibido = numeroDaGrade(texto(registro.celulas[indiceAtual]));
            let alterado = false;
            let ignorado = false;
            if (!quantidadeIgual(kmExibido, kmEsperado)) {
              ignorado = !permitirViradaKm && Number.isFinite(kmAnterior) && kmEsperado < kmAnterior;
              if (ignorado) {
                resposta.kmsIgnorados.push({
                  indice: indice + 1,
                  placa: abastecimento.placa,
                  km: kmEsperado,
                  anterior: kmAnterior,
                });
              } else {
                alterado = await editarNumeroNaCelula(
                  () => registroSaida(indice),
                  indiceAtual,
                  kmEsperado,
                  `KM Atual do item ${indice + 1}`,
                  true,
                );
                await resolverViradaKm(
                  Number.isFinite(kmAnterior) && kmEsperado < kmAnterior,
                );
                await aguardarGradePronta(`o SCPI concluir o KM Atual do item ${indice + 1}`);
                registro = registroSaida(indice);
                const confirmado = numeroDaGrade(texto(registro?.celulas?.[indiceAtual]));
                if (!quantidadeIgual(confirmado, kmEsperado)) {
                  throw new Error(
                    `O KM Atual do item ${indice + 1} deveria ser ${kmEsperado}, mas terminou como ${texto(registro?.celulas?.[indiceAtual]) || "<vazio>"}.`,
                  );
                }
              }
            }
            if (alterado) corrigidos += 1;
            resposta.etapas.push(
              ignorado
                ? `KM ${indice + 1}/${abastecimentos.length}: ${abastecimento.placa} mantido sem alteração; ${kmEsperado} é menor que o anterior ${kmAnterior}.`
                : `KM ${indice + 1}/${abastecimentos.length}: ${abastecimento.placa} ${alterado ? `corrigido para ${kmEsperado}` : "correto"}.`,
            );
          } catch (erro) {
            if (erroImpedeContinuar(erro)) throw erro;
            const mensagem = erro instanceof Error ? erro.message : String(erro);
            resposta.falhasAbastecimentos.push({
              indice: indice + 1,
              placa: abastecimento.placa,
              etapa: "KM Atual",
              erro: mensagem,
            });
            resposta.etapas.push(
              `KM ${indice + 1}/${abastecimentos.length}: falha ao conferir ${abastecimento.placa}; item pulado: ${mensagem}`,
            );
          }
        }
        const resumo = `Verificação concluída: ${abastecimentos.length} KM(s), ${corrigidos} corrigido(s), ${resposta.kmsIgnorados.length} mantido(s) pelo modo conservador e ${resposta.falhasAbastecimentos.length} falha(s) técnica(s).`;
        const relatorioTexto = resumo + montarRelatorioFalhas(resposta.falhasAbastecimentos);
        resposta.etapas.push(relatorioTexto);
        publicarProgressoAbastecimento("Concluído", abastecimentos.length - 1, abastecimentos.length, resumo);
        finalizarPainelExecucao("concluido", relatorioTexto);
        return {
          ...resposta,
          ok: true,
          relatorioConferencia: {
            tipo: "km",
            total: abastecimentos.length,
            corrigidos,
            ignoradosPorRegra: resposta.kmsIgnorados,
            falhas: resposta.falhasAbastecimentos,
            texto: relatorioTexto,
          },
        };
      }

      let atualizadas = 0;
      await rolarItensSaida("direita");
      for (let indice = 0; indice < abastecimentos.length; indice += 1) {
        await aguardarControle();
        const abastecimento = abastecimentos[indice];
        contextoAbastecimentoAtual = {
          indice,
          total: abastecimentos.length,
          abastecimento,
          etapa: "conferir placa",
        };
        publicarProgressoAbastecimento(
          "Conferência de placas",
          indice,
          abastecimentos.length,
          `conferindo ${abastecimento.placa}`,
        );
        let centro;
        try {
          centro = await selecionarCentroCusto(indice, abastecimento.placa, true);
        } catch (erro) {
          if (erroImpedeContinuar(erro)) throw erro;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          resposta.falhasAbastecimentos.push({
            indice: indice + 1,
            placa: abastecimento.placa,
            etapa: "Placa",
            erro: mensagem,
          });
          resposta.etapas.push(
            `Placa ${indice + 1}/${abastecimentos.length}: falha ao conferir ${abastecimento.placa}; item pulado: ${mensagem}`,
          );
          continue;
        }
        if (centro.naoEncontrada) {
          resposta.placasNaoEncontradas.push({ indice: indice + 1, placa: abastecimento.placa });
          resposta.etapas.push(
            `Placa ${indice + 1}/${abastecimentos.length}: ${abastecimento.placa} não encontrada; item mantido e conferência continuada.`,
          );
        } else if (centro.pendente) {
          centroCustoPendenteAtual = {
            indice,
            placa: abastecimento.placa,
            opcoes: centro.opcoes,
            fase: "conferir_placas",
          };
          resposta.etapas.push(
            `Pausa: há ${centro.opcoes.length} centros de custo para a placa ${abastecimento.placa}. Escolha o correto e confirme no SCPI.`,
          );
          return {
            ...resposta,
            ok: true,
            paused: true,
            centroCustoPendente: centroCustoPendenteAtual,
          };
        } else {
          if (centro.alterado) atualizadas += 1;
          resposta.etapas.push(
            `Placa ${indice + 1}/${abastecimentos.length}: ${abastecimento.placa} ${centro.alterado ? "atualizada" : "correta"}.`,
          );
        }
      }
      const listaAusentes = resposta.placasNaoEncontradas
        .map((item) => `${item.placa} (item ${item.indice})`)
        .join(", ");
      const situacaoAusentes = listaAusentes
        ? `Não encontrada(s): ${listaAusentes}.`
        : resposta.falhasAbastecimentos.length
          ? "Nenhuma placa foi confirmada como ausente; consulte as falhas técnicas abaixo."
          : "Todas foram encontradas.";
      const resumo = `Conferência concluída: ${abastecimentos.length} placa(s), ${atualizadas} atualizada(s) e ${resposta.falhasAbastecimentos.length} falha(s) técnica(s). ${situacaoAusentes}`;
      const relatorioTexto = resumo + montarRelatorioFalhas(
        resposta.falhasAbastecimentos,
        resposta.placasNaoEncontradas,
      );
      resposta.etapas.push(relatorioTexto);
      publicarProgressoAbastecimento("Concluído", abastecimentos.length - 1, abastecimentos.length, resumo);
      finalizarPainelExecucao("concluido", relatorioTexto);
      return {
        ...resposta,
        ok: true,
        relatorioConferencia: {
          tipo: "placas",
          total: abastecimentos.length,
          atualizadas,
          naoEncontradas: resposta.placasNaoEncontradas,
          falhas: resposta.falhasAbastecimentos,
          texto: relatorioTexto,
        },
      };
    }

    if (fase === "abastecimentos") {
      resposta.falhasAbastecimentos = [];
      resposta.kmsIgnorados = [];
      if (!Array.isArray(abastecimentos) || !abastecimentos.length) {
        throw new Error("Nenhum abastecimento válido foi recebido do XLSX.");
      }
      if (abastecimentos.length > 500) {
        throw new Error("A execução aceita no máximo 500 abastecimentos por XLSX.");
      }
      if (abastecimentos.some((item) =>
        !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(String(item?.placa || ""))
        || !tipoCombustivel(item?.produto)
        || !Number.isFinite(Number(item?.litros))
        || Number(item.litros) <= 0
        || !Number.isSafeInteger(Number(item?.km))
        || Number(item.km) < 0)) {
        throw new Error("Os dados de placa, combustível, litros ou KM recebidos do XLSX são inválidos.");
      }

      const itensSaida = await esperar("a aba Itens da Saída aparecer", () => aba("Itens da Saída"));
      if (!abaSelecionada(itensSaida)) clicar(itensSaida);
      await esperar("a aba Itens da Saída abrir", () => abaSelecionada(itensSaida));
      await rolarItensSaida("esquerda");

      const linhasIniciais = registroSaida(0)?.linhas || [];
      if (linhasIniciais.length > abastecimentos.length) {
        throw erroLinhaIncompativel(
          `A grade possui ${linhasIniciais.length} itens, mas o XLSX possui somente ${abastecimentos.length}.`,
        );
      }
      for (let indice = 0; indice < linhasIniciais.length; indice += 1) {
        validarProdutoDoRegistro(indice, abastecimentos[indice]);
      }
      await rolarItensSaida("direita");
      for (let indice = 0; indice < linhasIniciais.length; indice += 1) {
        validarPlacaDoRegistro(indice, abastecimentos[indice], indice < indiceAbastecimentoInicial);
      }
      await rolarItensSaida("esquerda");
      if (linhasIniciais.length < indiceAbastecimentoInicial) {
        throw erroLinhaIncompativel(
          `O progresso indica ${indiceAbastecimentoInicial} itens concluídos, mas a grade possui ${linhasIniciais.length}.`,
        );
      }
      if (indiceAbastecimentoInicial > abastecimentos.length) {
        throw new Error("O progresso salvo é maior que a quantidade de linhas do XLSX.");
      }
      if (indiceQuantidadeAbastecimentoInicial > abastecimentos.length) {
        throw new Error("O progresso salvo das QTDs é maior que a quantidade de linhas do XLSX.");
      }
      if (indiceQuantidadeAbastecimentoInicial > 0 && indiceAbastecimentoInicial < abastecimentos.length) {
        throw new Error("O progresso salvo está inconsistente: há QTDs concluídas antes de todos os itens serem cadastrados.");
      }

      let primeiroKmPendente = null;
      let primeiraQtdPendente = null;

      for (let indice = indiceAbastecimentoInicial; indice < abastecimentos.length; indice += 1) {
        await aguardarControle();
        indiceAbastecimentoAtual = indice;
        const abastecimento = abastecimentos[indice];
        contextoAbastecimentoAtual = {
          indice,
          total: abastecimentos.length,
          abastecimento,
          etapa: "preparar item",
        };
        atualizarEtapaAbastecimento("preparar item");
        await resolverViradaKm();

        if (!registroSaida(indice)?.linha) {
          atualizarEtapaAbastecimento("selecionar Produto do Pedido");
          await abrirProdutoDoPedido(indice, abastecimento.produto);
          resposta.etapas.push(`${indice + 1}/${abastecimentos.length}: ${abastecimento.produto} confirmado no Produto do Pedido.`);
        } else {
          validarProdutoDoRegistro(indice, abastecimento);
        }
        await rolarItensSaida("esquerda");
        let registro = registroSaida(indice);
        if (!registro?.linha) throw new Error(`O item ${indice + 1} não foi localizado na grade.`);
        atualizarEtapaAbastecimento("selecionar centro de custo");
        const centro = await selecionarCentroCusto(indice, abastecimento.placa);
        if (centro.pendente || centro.naoEncontrada) {
          centroCustoPendenteAtual = {
            indice,
            placa: abastecimento.placa,
            opcoes: centro.opcoes,
          };
          resposta.etapas.push(
            centro.opcoes.length > 1
              ? `Pausa: há ${centro.opcoes.length} centros de custo para a placa ${abastecimento.placa}. Escolha o correto e confirme no SCPI.`
              : `Pausa: a placa ${abastecimento.placa} não teve uma correspondência única. Escolha manualmente e confirme no SCPI.`,
          );
          return {
            ...resposta,
            ok: true,
            paused: true,
            indiceAbastecimento: indice,
            indiceQuantidadeAbastecimento: indiceQuantidadeAbastecimentoAtual,
            centroCustoPendente: centroCustoPendenteAtual,
            proximaFase: "abastecimentos",
          };
        }

        atualizarEtapaAbastecimento("preencher KM Atual");
        const kmEsperado = Number(abastecimento.km);
        let kmAnterior = Number.NaN;
        let kmAlterado = false;
        let kmIgnorado = false;
        let erroKm = null;
        let indiceAtual = -1;
        try {
          await rolarItensSaida("direita");
          registro = await selecionarRegistroSaida(indice);
          const indicePlaca = registro?.cabecalhos.findIndex((nome) => nome.startsWith("PLACA"));
          const indiceAnterior = registro?.cabecalhos.indexOf("ANTERIOR");
          indiceAtual = registro?.cabecalhos.indexOf("ATUAL");
          if (indicePlaca < 0 || indiceAnterior < 0 || indiceAtual < 0) {
            throw new Error("As colunas Placa, Anterior e Atual não foram localizadas no final da grade.");
          }
          registro = await esperar(`a placa ${abastecimento.placa} aparecer no item ${indice + 1}`, () => {
            const atual = registroSaida(indice);
            return placaCompacta(texto(atual?.celulas?.[indicePlaca])) === abastecimento.placa ? atual : null;
          });
          kmAnterior = numeroDaGrade(texto(registro.celulas[indiceAnterior]));
          kmIgnorado = !permitirViradaKm && Number.isFinite(kmAnterior) && kmEsperado < kmAnterior;
          if (kmIgnorado) {
            resposta.kmsIgnorados.push({
              indice: indice + 1,
              placa: abastecimento.placa,
              km: kmEsperado,
              anterior: kmAnterior,
            });
            resposta.etapas.push(
              `${indice + 1}/${abastecimentos.length}: KM ${kmEsperado} da placa ${abastecimento.placa} mantido sem alteração por ser menor que o anterior ${kmAnterior}.`,
            );
          } else {
            kmAlterado = await editarNumeroNaCelula(
              () => registroSaida(indice),
              indiceAtual,
              kmEsperado,
              `KM Atual do item ${indice + 1}`,
              true,
            );
            await resolverViradaKm(
              Number.isFinite(kmAnterior) && kmEsperado < kmAnterior,
            );
            await aguardarGradePronta(`o SCPI concluir o KM Atual do item ${indice + 1}`);
            registro = registroSaida(indice);
            const kmConfirmado = numeroDaGrade(texto(registro?.celulas?.[indiceAtual]));
            if (!quantidadeIgual(kmConfirmado, kmEsperado)) {
              throw new Error(
                `O KM Atual do item ${indice + 1} deveria ser ${kmEsperado}, mas terminou como ${texto(registro?.celulas?.[indiceAtual]) || "<vazio>"}.`,
              );
            }
            verificarBloqueio();
          }
        } catch (erro) {
          if (erroImpedeContinuar(erro)) throw erro;
          erroKm = erro instanceof Error ? erro.message : String(erro);
          primeiroKmPendente ??= indice;
          if (indiceAtual >= 0) cancelarEdicaoDaCelula(registroSaida(indice), indiceAtual);
          await resolverViradaKm();
          resposta.falhasAbastecimentos.push({
            indice: indice + 1,
            placa: abastecimento.placa,
            etapa: "KM Atual",
            erro: erroKm,
          });
          resposta.etapas.push(
            `${indice + 1}/${abastecimentos.length}: KM da placa ${abastecimento.placa} não pôde ser preenchido e foi pulado: ${erroKm}`,
          );
        }

        await rolarItensSaida("esquerda");
        indiceAbastecimentoAtual = indice + 1;
        resposta.etapas.push(
          `${indice + 1}/${abastecimentos.length}: ${abastecimento.placa}, ${abastecimento.litros} L, KM ${abastecimento.km}`
          + ` (${erroKm ? "KM pulado após erro irrecuperável" : kmIgnorado ? "KM mantido pelo modo conservador" : kmAlterado ? "KM alterado" : "KM conferido"}`
          + "; QTD pendente para a etapa final).",
        );
      }

      await rolarItensSaida("esquerda");
      for (
        let indice = indiceQuantidadeAbastecimentoInicial;
        indice < abastecimentos.length;
        indice += 1
      ) {
        await aguardarControle();
        const abastecimento = abastecimentos[indice];
        contextoAbastecimentoAtual = {
          indice,
          total: abastecimentos.length,
          abastecimento,
          etapa: "preencher QTD na etapa final",
        };
        publicarProgressoAbastecimento(
          "QTD",
          indice,
          abastecimentos.length,
          "preencher quantidade na etapa final",
        );
        let quantidadeAlterada = false;
        try {
          await rolarItensSaida("direita");
          validarPlacaDoRegistro(indice, abastecimento);
          await rolarItensSaida("esquerda");
          validarProdutoDoRegistro(indice, abastecimento);
          const registro = registroSaida(indice);
          const indiceQuantidade = registro?.cabecalhos?.indexOf("QTD") ?? -1;
          if (indiceQuantidade < 0) {
            throw new Error(`A coluna QTD do item ${indice + 1} não foi localizada na etapa final.`);
          }
          quantidadeAlterada = await editarNumeroNaCelula(
            () => registroSaida(indice),
            indiceQuantidade,
            Number(abastecimento.litros),
            `QTD do item ${indice + 1}`,
            true,
          );
          resposta.etapas.push(
            `QTD ${indice + 1}/${abastecimentos.length}: ${abastecimento.litros} L `
            + `(${quantidadeAlterada ? "alterada" : "já estava correta"}).`,
          );
        } catch (erro) {
          if (erroImpedeContinuar(erro)) throw erro;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          primeiraQtdPendente ??= indice;
          resposta.falhasAbastecimentos.push({
            indice: indice + 1,
            placa: abastecimento.placa,
            etapa: "QTD",
            erro: mensagem,
          });
          resposta.etapas.push(
            `QTD ${indice + 1}/${abastecimentos.length} não pôde ser preenchida e foi pulada: ${mensagem}`,
          );
        }
        indiceQuantidadeAbastecimentoAtual = indice + 1;
      }

      const indiceItensFinal = primeiroKmPendente ?? abastecimentos.length;
      const indiceQtdFinal = primeiraQtdPendente ?? abastecimentos.length;
      indiceAbastecimentoAtual = indiceItensFinal;
      indiceQuantidadeAbastecimentoAtual = indiceQtdFinal;
      publicarProgressoAbastecimento(
        resposta.falhasAbastecimentos.length ? "Pendências" : "Concluído",
        resposta.falhasAbastecimentos.length
          ? Math.min(indiceItensFinal, indiceQtdFinal)
          : abastecimentos.length - 1,
        abastecimentos.length,
        resposta.falhasAbastecimentos.length
          ? `${resposta.falhasAbastecimentos.length} campo(s) pulado(s)`
          : resposta.kmsIgnorados.length
            ? `${resposta.kmsIgnorados.length} KM(s) mantido(s) pelo modo conservador`
            : "todos os campos preenchidos",
      );
      resposta.etapas.push(
        `Processamento concluído com ${resposta.falhasAbastecimentos.length} falha(s) técnica(s) e ${resposta.kmsIgnorados.length} KM(s) mantido(s) pelo modo conservador. Confira a grade; o botão Salvar não foi acionado.`,
      );
      return {
        ...resposta,
        ok: true,
        partial: resposta.falhasAbastecimentos.length > 0,
        indiceAbastecimento: indiceItensFinal,
        indiceQuantidadeAbastecimento: indiceQtdFinal,
        centroCustoPendente: null,
        proximaFase: null,
      };
    }

    if (fase === "solicitacao") {
      if (!formularioSolicitacaoNovo()) {
        if (menuSolicitacao.getAttribute("aria-expanded") !== "true") clicar(menuSolicitacao);
        await esperar(
          "o menu Solicitação expandir",
          () => menuSolicitacao.getAttribute("aria-expanded") === "true",
        );
        resposta.etapas.push("Menu Solicitação aberto.");

        let inserir = botao("Inserir");
        if (!habilitado(inserir)) {
          const menuFilho = await esperar(
            "a opção interna Solicitação aparecer",
            () => linhaMenu("Solicitação", 3),
          );
          clicar(menuFilho);
          inserir = await esperar("a tela Solicitação abrir", () => {
            const encontrado = botao("Inserir");
            return habilitado(encontrado) ? encontrado : null;
          });
        }
        resposta.etapas.push("Tela Solicitação aberta.");

        clicar(inserir);
        const nova = await esperar("a opção Nova aparecer", () => opcao("Nova"));
        clicar(nova);
        await esperar("o formulário da nova solicitação abrir", formularioSolicitacaoNovo);
        resposta.etapas.push("Nova solicitação aberta.");
      }

      const campoResponsavel = campoDoRotulo("Responsável:");
      const campoDescricao = campoDoRotulo("Descrição:");
      if (!campoResponsavel || !campoDescricao) {
        throw new Error("Os campos Responsável e Descrição não foram localizados.");
      }

      preencher(campoResponsavel, responsavel);
      preencher(campoDescricao, descricao);
      await esperar(
        "confirmar o preenchimento",
        () => campoResponsavel.value === responsavel && campoDescricao.value === descricao,
      );
      resposta.etapas.push("Responsável e Descrição preenchidos.");
      resposta.etapas.push("Pausa: confira os dados e clique no passo 2.");
      return { ...resposta, ok: true, proximaFase: "itens" };
    }

    if (fase === "itens") {
      const itens = await esperar("a aba Itens da Solicitação aparecer", () =>
        aba("Itens da Solicitação"),
      );
      if (!abaSelecionada(itens)) clicar(itens);
      await esperar("a aba Itens da Solicitação abrir", () => abaSelecionada(itens));
      resposta.etapas.push("Aba Itens da Solicitação aberta.");
      resposta.etapas.push("Pausa: confira a tela e clique no passo 3 para pesquisar os produtos.");
      return { ...resposta, ok: true, proximaFase: "produtos" };
    }

    if (fase === "produtos") {
      const itens = aba("Itens da Solicitação");
      if (!itens) throw new Error("A aba Itens da Solicitação não está disponível na tela atual.");
      if (!abaSelecionada(itens)) clicar(itens);
      await esperar("a aba Itens da Solicitação abrir", () => abaSelecionada(itens));
      if (!produtos.length) {
        throw new Error("Nenhum produto conferido foi enviado pelo leitor.");
      }

      const limitePaginas = Math.max(1, Math.floor(Number(maxPaginasPorConsulta) || 3));
      const produtosVisiveis = quantidadeProdutosNaSolicitacao();
      if (produtosVisiveis !== null && produtosVisiveis > produtos.length) {
        throw new Error(`A grade contém ${produtosVisiveis} itens, mas foram extraídos ${produtos.length}. Confira a tela antes de continuar.`);
      }
      const indiceCorrigido = produtosVisiveis ?? indiceInicial;
      if (indiceCorrigido !== indiceInicial) {
        indiceProdutoAtual = indiceCorrigido;
        resposta.etapas.push("A grade foi atualizada; o progresso salvo foi corrigido pela tela atual.");
      }
      for (let indice = indiceCorrigido; indice < produtos.length; indice += 1) {
        indiceProdutoAtual = indice;
        if (indice > 0) {
          const novoItem = await esperar("o botão Novo Item habilitar", () =>
            [...doc.querySelectorAll('button, [role="button"], a')]
              .find((elemento) => normalizar(texto(elemento)).endsWith("NOVO ITEM") && habilitado(elemento)),
          );
          clicar(novoItem);
          await new Promise((resolve) => setTimeout(resolve, 150));
          await esperar("o novo item ficar pronto", () => {
            const encontrado = botao("Produto");
            return habilitado(encontrado) ? encontrado : null;
          });
          resposta.etapas.push("Novo item aberto para o próximo produto.");
        }
        const produto = produtos[indice];
        const abrirProduto = await esperar("o botão Produto habilitar", () => {
          const encontrado = botao("Produto");
          return habilitado(encontrado) ? encontrado : null;
        });
        clicar(abrirProduto);

        const avulso = await esperar("a opção Produto Avulso aparecer", () => opcao("Produto Avulso"));
        clicar(avulso);
        const pesquisar = await esperar("o botão Pesquisar aparecer", () => {
          const encontrado = botao("Pesquisar");
          return habilitado(encontrado) ? encontrado : null;
        });
        const campoPesquisa = campoAntesDoBotao(pesquisar);
        if (!campoPesquisa) throw new Error("O campo de pesquisa de produtos não foi localizado.");
        const janela = pesquisar.closest?.('[role="dialog"], .x-window') || doc;
        const consultas = consultasProduto(produto.description);
        let ultimosCandidatos = [];
        let limitePesquisaAtingido = false;
        let incluido = false;
        const executarPesquisa = async (consulta) => {
          preencher(campoPesquisa, consulta);
          await acionarServidor(pesquisar);
          await aguardarMs(intervaloRapido);
          await esperar("o resultado da pesquisa de produtos carregar", () => {
            verificarBloqueio();
            const carregando = janela.querySelector?.(".x-mask-msg, .x-loading-mask");
            return !visivel(carregando);
          });
        };
        const paginaAtual = () => {
          const container = janela.querySelector?.(".x-tbar-page-number");
          const campo = container?.matches?.("input") ? container : container?.querySelector?.("input");
          return Number(campo?.value) || 0;
        };
        const controlePaginacao = (seletor, rotulo) => {
          const icone = janela.querySelector?.(seletor);
          return icone?.closest?.("a, button, [role='button']")
            || icone
            || [...janela.querySelectorAll?.("button, [role='button']") || []]
              .find((elemento) => normalizar(elemento.title || elemento.getAttribute?.("aria-label")).includes(rotulo));
        };
        const proximaPagina = () => controlePaginacao(".x-tbar-page-next", "PROXIMA PAGINA");
        const paginaAnterior = () => controlePaginacao(".x-tbar-page-prev", "PAGINA ANTERIOR");
        const assinaturaPagina = () => `${paginaAtual()}|${linhasDeProduto(janela).map((item) => item.descricao).join("|")}`;
        const mudarPagina = async (localizarControle, descricaoEspera) => {
          const recuos = [2000, 4000, 8000];
          for (let tentativa = 0; tentativa <= recuos.length; tentativa += 1) {
            const controle = localizarControle();
            if (!habilitado(controle)) throw new Error(`Não foi possível ${descricaoEspera}.`);
            const assinatura = assinaturaPagina();
            await acionarServidor(controle, { sensivel: true });
            try {
              await esperar(descricaoEspera, () => {
                verificarBloqueio();
                const novaAssinatura = assinaturaPagina();
                return novaAssinatura !== assinatura ? true : null;
              });
              return;
            } catch (erro) {
              const mensagem = erro instanceof Error ? erro.message : String(erro);
              if (
                ["__SCRIPT_PREFEITURA_CANCELADO__", "__SCRIPT_PREFEITURA_FINALIZADO__"].includes(mensagem)
                || mensagem.startsWith("O SCPI interrompeu")
                || tentativa === recuos.length
              ) throw erro;
              await aguardarMs(recuos[tentativa]);
            }
          }
        };

        for (const consulta of consultas) {
          const candidatos = new Map();
          await executarPesquisa(consulta);
          let melhor = null;
          let seguro = false;

          for (let pagina = 0; pagina < limitePaginas; pagina += 1) {
            const linhas = linhasDeProduto(janela);
            for (const candidato of linhas) {
              const chave = normalizar(candidato.descricao);
              const pontuacao = pontuarProduto(produto.description, candidato.descricao);
              const anterior = candidatos.get(chave);
              if (!anterior || pontuacao > anterior.pontuacao) {
                candidatos.set(chave, {
                  ...candidato,
                  pontuacao,
                  pagina: paginaAtual() || pagina + 1,
                });
              }
            }

            const exato = [...candidatos.values()]
              .find((item) => normalizar(item.descricao) === normalizar(produto.description));
            if (exato) {
              melhor = exato;
              seguro = true;
              break;
            }

            const proxima = proximaPagina();
            if (!habilitado(proxima)) break;
            if (pagina + 1 >= limitePaginas) {
              limitePesquisaAtingido = true;
              break;
            }
            await mudarPagina(proximaPagina, "carregar a próxima página de produtos");
          }

          const ordenados = [...candidatos.values()].sort((a, b) => b.pontuacao - a.pontuacao);
          if (ordenados.length) {
            ultimosCandidatos = ordenados;
          }
          if (limitePesquisaAtingido) break;
          if (!melhor) {
            melhor = ordenados[0];
            const segundo = ordenados[1];
            seguro = melhor?.pontuacao >= 0.82
              && (!segundo || melhor.pontuacao - segundo.pontuacao >= 0.12);
          }
          if (!seguro) continue;

          while (paginaAtual() > melhor.pagina) {
            await mudarPagina(paginaAnterior, "voltar à página do produto escolhido");
          }
          const linhaSelecionada = linhasDeProduto(janela)
            .find((item) => normalizar(item.descricao) === normalizar(melhor.descricao))?.linha;
          if (!linhaSelecionada) throw new Error(`O resultado escolhido para ${produto.description} mudou durante a pesquisa.`);

          await acionarServidor(linhaSelecionada);
          await aguardarMs(Math.min(100, intervaloRapido));
          const confirmar = await esperar("o botão Confirmar da pesquisa habilitar", () =>
            [...janela.querySelectorAll?.("button, [role='button'], a") || []]
              .find((elemento) => normalizar(texto(elemento)) === "CONFIRMAR" && habilitado(elemento)),
          );
          await acionarServidor(confirmar, { sensivel: true });
          await esperar("o produto selecionado ser incluído", () => !visivel(janela));
          await esperar("o produto aparecer na grade da solicitação", () => {
            const totalNaGrade = quantidadeProdutosNaSolicitacao();
            return totalNaGrade === null || totalNaGrade >= indice + 1 ? true : null;
          });
          resposta.etapas.push(`${indice + 1}/${produtos.length}: ${produto.description} incluído.`);
          indiceProdutoAtual = indice + 1;
          incluido = true;
          break;
        }

        if (!incluido) {
          const sugestoes = ultimosCandidatos.slice(0, 3).map((item) => item.descricao);
          resposta.etapas.push(`Pausa no produto ${indice + 1}/${produtos.length}: ${produto.description}.`);
          if (limitePesquisaAtingido) {
            resposta.etapas.push(`Limite seguro de ${limitePaginas} páginas atingido. Continue manualmente para evitar excesso de requisições.`);
          } else {
            resposta.etapas.push(sugestoes.length
              ? `Resultados parecidos, mas ambíguos: ${sugestoes.join(" | ")}. Selecione manualmente.`
              : "Produto não encontrado. Cadastre-o ou insira-o manualmente e depois retome o passo 3.");
          }
          return {
            ...resposta,
            ok: true,
            paused: true,
            indiceProduto: indice,
            produtoPendente: produto,
            proximaFase: "produtos",
          };
        }

      }

      const totalConfirmado = quantidadeProdutosNaSolicitacao();
      if (totalConfirmado !== null && totalConfirmado < produtos.length) {
        throw new Error(`A grade mostra ${totalConfirmado} de ${produtos.length} produto(s). A execução foi interrompida sem avançar para a cotação.`);
      }
      if (!gradeItensSolicitacao() || linhasItensSolicitacao()?.some((item) => !item.quantidade)) {
        throw new Error("A coluna Quantidade da grade não foi localizada. A execução foi interrompida sem avançar para a cotação.");
      }
      await fecharEditorQuantidadeAberto();
      for (let indice = 0; indice < produtos.length; indice += 1) {
        await aguardarControle();
        const quantidadeEsperada = numeroDaQuantidade(produtos[indice].quantity);
        if (!Number.isFinite(quantidadeEsperada) || quantidadeEsperada <= 0) {
          throw new Error(`A quantidade extraída para ${produtos[indice].description} é inválida.`);
        }
        const alterada = await editarQuantidade(indice, quantidadeEsperada);
        resposta.etapas.push(
          `${indice + 1}/${produtos.length}: quantidade ${quantidadeEsperada} ${alterada ? "aplicada" : "já estava correta"}.`,
        );
      }
      resposta.etapas.push("Todos os produtos e quantidades foram confirmados na grade. Confira antes do passo 4.");
      return {
        ...resposta,
        ok: true,
        indiceProduto: produtos.length,
        produtoPendente: null,
        proximaFase: "cotacao",
      };
    }

    if (fase === "cotacao") {
      if (menuProcessoCompra.getAttribute("aria-expanded") !== "true") clicar(menuProcessoCompra);
      await esperar(
        "o menu Processo de Compra expandir",
        () => menuProcessoCompra.getAttribute("aria-expanded") === "true",
      );
      resposta.etapas.push("Menu Processo de Compra aberto.");

      const menuCotacao = await esperar("a opção Cotação aparecer", () => linhaMenu("Cotação", 3));
      clicar(menuCotacao);
      const inserirCotacao = await esperar("a tela Cotação abrir", () =>
        botoes("Inserir").find((elemento) => habilitado(elemento)),
      );
      resposta.etapas.push("Tela Cotação aberta.");

      clicar(inserirCotacao);
      const novaCotacao = await esperar("a opção Nova Cotação aparecer", () =>
        opcao("Nova Cotação"),
      );
      clicar(novaCotacao);

      await esperar("a janela Solicitações a serem cotadas abrir", () =>
        dialogo("Solicitações a serem cotadas"),
      );
      const incluirSolicitacao = await esperar("o botão Incluir habilitar", () => {
        const encontrado = botao("Incluir");
        return habilitado(encontrado) ? encontrado : null;
      });
      clicar(incluirSolicitacao);
      await esperar("a pesquisa de solicitações abrir", () =>
        dialogo("Pesquisa Solicitações de Materiais / Serviços"),
      );
      resposta.etapas.push("Pesquisa de solicitações aberta, sem salvar.");
      return { ...resposta, ok: true, proximaFase: "fornecedores" };
    }

    if (fase === "fornecedores") {
      const listaFornecedores = [...new Set(fornecedores.map(cnpjNumerico))];
      if (
        !listaFornecedores.length
        || listaFornecedores.some((cnpj) => cnpj.length !== 14 || cnpj === "45116712000109")
      ) {
        throw new Error("Os CNPJs dos fornecedores estão ausentes ou inválidos. Confira-os no leitor.");
      }

      const abaFornecedores = await esperar("a aba Fornecedores aparecer", () => aba("Fornecedores"));
      if (!abaSelecionada(abaFornecedores)) clicar(abaFornecedores);
      await esperar("a aba Fornecedores abrir", () => abaSelecionada(abaFornecedores));
      if (!gradeFornecedoresCotacao()) {
        throw new Error("A grade de fornecedores da cotação não foi localizada.");
      }

      for (const [indice, cnpj] of listaFornecedores.entries()) {
        await aguardarControle();
        if (cnpjsFornecedoresNaCotacao()?.includes(cnpj)) {
          resposta.etapas.push(`${indice + 1}/${listaFornecedores.length}: ${formatarCnpj(cnpj)} já estava incluído.`);
          continue;
        }

        const incluir = await esperar("o botão Incluir fornecedor habilitar", () =>
          botoes("Incluir").find(habilitado),
        );
        clicar(incluir);
        const janela = await esperar("a pesquisa de fornecedor abrir", () => dialogo("Pesquisa Fornecedor"));
        const opcaoCnpj = opcao("CNPJ/CPF");
        if (opcaoCnpj) clicar(opcaoCnpj);
        const pesquisar = await esperar("o botão Pesquisar fornecedor habilitar", () =>
          [...janela.querySelectorAll?.("button, [role='button'], a") || []]
            .find((elemento) => texto(elemento) === "Pesquisar" && habilitado(elemento)),
        );
        const campoPesquisa = campoAntesDoBotao(pesquisar);
        if (!campoPesquisa) throw new Error("O campo de pesquisa por CNPJ não foi localizado.");
        preencher(campoPesquisa, formatarCnpj(cnpj));
        await acionarServidor(pesquisar);
        await aguardarMs(Math.min(150, intervaloRapido));
        await esperar("a pesquisa do fornecedor terminar", () => {
          verificarBloqueio();
          return !visivel(janela.querySelector?.(".x-mask-msg, .x-loading-mask"));
        });

        const resultado = linhasPesquisaFornecedor(janela).find((item) => item.cnpj === cnpj);
        if (!resultado) {
          resposta.etapas.push(`Fornecedor ${formatarCnpj(cnpj)} não encontrado. Cadastre-o ou inclua-o manualmente e execute novamente o passo 5.`);
          return {
            ...resposta,
            ok: true,
            paused: true,
            fornecedorPendente: cnpj,
            proximaFase: "fornecedores",
          };
        }

        await acionarServidor(resultado.linha);
        const confirmar = await esperar("o botão Confirmar fornecedor habilitar", () =>
          [...janela.querySelectorAll?.("button, [role='button'], a") || []]
            .find((elemento) => texto(elemento) === "Confirmar" && habilitado(elemento)),
        );
        await acionarServidor(confirmar, { sensivel: true });
        await esperar("a pesquisa de fornecedor fechar", () => !visivel(janela));
        await esperar("o fornecedor aparecer na cotação", () =>
          cnpjsFornecedoresNaCotacao()?.includes(cnpj),
        );
        resposta.etapas.push(`${indice + 1}/${listaFornecedores.length}: ${formatarCnpj(cnpj)} incluído.`);
      }

      resposta.etapas.push("Todos os fornecedores foram incluídos. Confira a grade antes de continuar.");
      return { ...resposta, ok: true, fornecedorPendente: null, proximaFase: null };
    }

    throw new Error("Fase da automação inválida.");
  } catch (erro) {
    if (erro instanceof Error && [
      "__SCRIPT_PREFEITURA_VIRADA_MANUAL__",
      "__SCRIPT_PREFEITURA_KM_ALTO_MANUAL__",
    ].includes(erro.message)) {
      const mensagem = erro.mensagemUsuario || "Há uma confirmação pendente no SCPI.";
      resposta.etapas.push(`Pausa: ${mensagem}`);
      finalizarPainelExecucao("pausado", mensagem);
      return {
        ...resposta,
        ok: true,
        paused: true,
        indiceProduto: indiceProdutoAtual,
        indiceAbastecimento: indiceAbastecimentoAtual,
        indiceQuantidadeAbastecimento: indiceQuantidadeAbastecimentoAtual,
        centroCustoPendente: centroCustoPendenteAtual,
        produtoPendente: null,
      };
    }
    if (erro instanceof Error && erro.message.includes("__SCRIPT_PREFEITURA_FINALIZADO__")) {
      const progresso = globalThis.__scriptPrefeituraProgresso;
      const cabecalhoProgresso = progresso?.total
        ? `Progresso interrompido em ${progresso.tipo} ${progresso.atual} de ${progresso.total}: ${progresso.etapa}.`
        : "A execução foi interrompida antes de concluir a etapa atual.";
      const resultadosObtidos = resposta.etapas.length
        ? resposta.etapas.join("\n")
        : "Nenhum item havia sido concluído.";
      const relatorio = `Execução finalizada pelo usuário. Nenhuma nova etapa será executada e o botão Salvar não foi acionado.\n\n${cabecalhoProgresso}\n\nResultados obtidos:\n${resultadosObtidos}`;
      finalizarPainelExecucao("finalizado", relatorio);
      return {
        ...resposta,
        ok: true,
        finalized: true,
        etapas: [relatorio],
        indiceProduto: indiceProdutoAtual,
        indiceAbastecimento: indiceAbastecimentoAtual,
        indiceQuantidadeAbastecimento: indiceQuantidadeAbastecimentoAtual,
        centroCustoPendente: centroCustoPendenteAtual,
        produtoPendente: null,
      };
    }
    if (erro instanceof Error && erro.message.includes("__SCRIPT_PREFEITURA_CANCELADO__")) {
      resposta.etapas.push("Execução cancelada pelo usuário. Nenhum comando adicional foi executado.");
      finalizarPainelExecucao("cancelado", "Nenhum comando adicional foi executado.");
      return {
        ...resposta,
        ok: true,
        canceled: true,
        indiceProduto: indiceProdutoAtual,
        indiceAbastecimento: indiceAbastecimentoAtual,
        indiceQuantidadeAbastecimento: indiceQuantidadeAbastecimentoAtual,
        centroCustoPendente: centroCustoPendenteAtual,
        produtoPendente: null,
      };
    }
    const mensagemBruta = erro instanceof Error ? erro.message : String(erro);
    const mensagem = mensagemBruta === "__SCRIPT_PREFEITURA_GRADE_SUJA__"
      ? "O SCPI rejeitou a alteração porque a grade ainda estava atualizando (dirty state). Aguarde a grade estabilizar e continue; nenhum progresso foi avançado."
      : mensagemBruta === "__SCRIPT_PREFEITURA_DATASET_FORA_DE_EDICAO__"
        ? "O SCPI ainda não havia colocado o dataset em modo de edição. A célula não foi avançada e pode ser repetida."
        : mensagemBruta;
    const contexto = ["abastecimentos", "conferir_quantidades", "conferir_placas", "conferir_km"].includes(fase)
      && contextoAbastecimentoAtual
      ? [
          `Item: ${contextoAbastecimentoAtual.indice + 1}/${contextoAbastecimentoAtual.total}`,
          `Etapa: ${contextoAbastecimentoAtual.etapa}`,
          `Placa: ${contextoAbastecimentoAtual.abastecimento.placa}`,
          `Combustível: ${contextoAbastecimentoAtual.abastecimento.produto}`,
          `Litros esperados: ${contextoAbastecimentoAtual.abastecimento.litros}`,
          `KM do XLSX: ${contextoAbastecimentoAtual.abastecimento.km}`,
        ].join("\n")
      : "";
    finalizarPainelExecucao("erro", contexto ? `${mensagem} — ${contextoAbastecimentoAtual.etapa}` : mensagem);
    return {
      ...resposta,
      indiceAbastecimento: indiceAbastecimentoAtual,
      indiceQuantidadeAbastecimento: indiceQuantidadeAbastecimentoAtual,
      centroCustoPendente: centroCustoPendenteAtual,
      error: contexto ? `${mensagem}\n\nDiagnóstico:\n${contexto}` : mensagem,
    };
  } finally {
    observadorErroAjax?.disconnect?.();
    if (!painelFinalizado) {
      const pausada = resposta.etapas.some((etapa) => /^(Pausa:|Fornecedor .* não encontrado)/.test(etapa));
      finalizarPainelExecucao(
        pausada ? "pausado" : "concluido",
        pausada
          ? "Confira a página e conclua a escolha manual indicada."
          : "Confira os dados preenchidos. O botão Salvar não foi acionado.",
      );
    }
    if (globalThis.alert === alertaInterceptado) {
      if (typeof alertaOriginal === "function") globalThis.alert = alertaOriginal;
      else delete globalThis.alert;
    }
    globalThis.__scriptPrefeituraExecutando = false;
    globalThis.__scriptPrefeituraControle = null;
  }
}
