import {
  cleanProductDescription,
  formatMoney,
  isValidCnpj,
  maskCnpj,
  normalizeCnpj,
  parseDocument,
} from "./ocr-parser.js";

const filesInput = document.querySelector("#files");
const analyzeButton = document.querySelector("#analyze");
const saveProductsButton = document.querySelector("#save-products");
const dropZone = document.querySelector("#drop-zone");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const acceptedExtensions = /\.(?:jpe?g|png|heic|heif)$/i;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

function showStatus(message, type = "") {
  status.textContent = message;
  status.dataset.type = type;
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
}

function nativeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "ocr", payload: message }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(`Leitor local indisponível: ${error.message}`));
      else if (!response?.ok) reject(new Error(`Leitor local indisponível: ${response?.error || "sem resposta"}`));
      else resolve(response);
    });
  });
}

function editable(value, type = "text") {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.setAttribute("aria-label", "Valor extraído; confira com o documento");
  return input;
}

function appendItemRow(body, item = {}) {
  const row = body.insertRow();
  row.insertCell().append(editable(item.code || ""));
  const description = editable(cleanProductDescription(item.description));
  description.addEventListener("blur", () => {
    description.value = cleanProductDescription(description.value);
  });
  row.insertCell().append(description);
  const quantityCell = row.insertCell();
  quantityCell.append(editable(item.quantity ?? "", "number"));
  if (item.quantitySource === "calculated") {
    const hint = document.createElement("small");
    hint.className = "hint";
    hint.textContent = "calculada pelos valores";
    quantityCell.append(hint);
  }
  row.insertCell().append(editable(item.unit || ""));
  row.insertCell().append(editable(formatMoney(item.unitCents)));
  row.insertCell().append(editable(formatMoney(item.totalCents)));
  const check = row.insertCell();
  check.className = item.consistent === false ? "invalid" : item.consistent ? "valid" : "";
  check.textContent = item.consistent === false ? "Cálculo diverge" : item.consistent ? "Cálculo confere" : "Manual";
  check.title = item.raw || "Item adicionado ou alterado manualmente";
  const actions = row.insertCell();
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-item";
  remove.textContent = "Excluir";
  remove.addEventListener("click", () => {
    row.remove();
    saveProductsButton.hidden = !results.querySelector("tbody tr");
  });
  actions.append(remove);
}

function renderDocument(file, parsed) {
  const article = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = file.name;
  article.append(title);

  const preview = document.createElement("img");
  preview.className = "preview";
  preview.src = URL.createObjectURL(file);
  preview.alt = `Documento ${file.name}`;
  article.append(preview);

  const cnpj = document.createElement("div");
  cnpj.className = "cnpj";
  const cnpjLabel = document.createElement("label");
  cnpjLabel.textContent = "CNPJ do fornecedor: ";
  const cnpjInput = editable(maskCnpj(parsed.cnpj));
  cnpjInput.className = "supplier-cnpj";
  cnpjInput.inputMode = "numeric";
  cnpjInput.maxLength = 18;
  const cnpjCheck = document.createElement("span");
  const validateCnpj = () => {
    const valid = isValidCnpj(cnpjInput.value);
    cnpjCheck.className = valid ? "valid" : "invalid";
    cnpjCheck.textContent = valid ? " ✓" : " — confira manualmente";
  };
  cnpjInput.addEventListener("input", () => {
    cnpjInput.value = maskCnpj(cnpjInput.value);
    validateCnpj();
  });
  cnpjLabel.append(cnpjInput);
  cnpj.append(cnpjLabel, cnpjCheck);
  validateCnpj();
  article.append(cnpj);

  if (!parsed.items.length) {
    const warning = document.createElement("p");
    warning.className = "warning";
    warning.textContent = "Nenhuma linha de produto foi reconhecida automaticamente. Adicione os itens manualmente ou confira o texto extraído abaixo.";
    article.append(warning);
  }

  const addItem = document.createElement("button");
  addItem.type = "button";
  addItem.className = "add-item";
  addItem.textContent = "+ Adicionar item";
  const table = document.createElement("table");
  const header = table.createTHead().insertRow();
  ["Código", "Descrição", "Quantidade", "Unidade", "Valor unitário", "Valor total", "Conferência", "Ações"]
    .forEach((label) => { const cell = document.createElement("th"); cell.textContent = label; header.append(cell); });
  const body = table.createTBody();
  parsed.items.forEach((item) => appendItemRow(body, item));
  addItem.addEventListener("click", () => {
    appendItemRow(body, { quantity: 1 });
    saveProductsButton.hidden = false;
  });
  article.append(addItem, table);

  if (parsed.documentTotalCents != null) {
    const totals = document.createElement("p");
    totals.className = parsed.totalsConsistent ? "totals valid" : "totals invalid";
    totals.textContent = `Soma dos itens: ${formatMoney(parsed.itemsTotalCents)} · Total do documento: ${formatMoney(parsed.documentTotalCents)} — ${parsed.totalsConsistent ? "valores conferem" : "há divergência; confira os itens"}`;
    article.append(totals);
  }

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Ver texto reconhecido";
  const raw = document.createElement("pre");
  raw.textContent = parsed.fullText;
  details.append(summary, raw);
  article.append(details);
  return article;
}

saveProductsButton.addEventListener("click", async () => {
  const cnpjInputs = [...results.querySelectorAll(".supplier-cnpj")];
  const suppliers = [...new Set(cnpjInputs
    .map((input) => normalizeCnpj(input.value))
    .filter((cnpj) => cnpj !== "45116712000109" && isValidCnpj(cnpj)))];
  if (suppliers.length !== cnpjInputs.length) {
    showStatus("Confira os CNPJs: cada documento precisa ter um fornecedor válido e diferente da prefeitura.", "error");
    return;
  }
  const products = [...results.querySelectorAll("tbody tr")]
    .map((row) => {
      const fields = [...row.querySelectorAll("input")];
      return {
        description: cleanProductDescription(fields[1]?.value),
        quantity: Number(fields[2]?.value) || 1,
      };
    })
    .filter((product) => product.description);
  const unique = products.filter((product, index) => {
    const key = product.description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return products.findIndex((candidate) =>
      candidate.description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === key) === index;
  });
  if (!unique.length) {
    showStatus("Nenhum produto reconhecido para usar na solicitação.", "error");
    return;
  }
  await chrome.storage.local.set({
    produtosSolicitacao: unique,
    fornecedoresCotacao: suppliers,
    indiceProduto: 0,
    produtoPendente: null,
  });
  showStatus(`${unique.length} produto(s) e ${suppliers.length} fornecedor(es) prontos para a extensão.`, "success");
});

async function analyzeFiles(files) {
  if (analyzeButton.disabled) return;
  if (!files.length || files.length > 3) {
    showStatus("Selecione de uma a três imagens.", "error");
    return;
  }
  if (files.some((file) => !acceptedTypes.has(file.type) && !acceptedExtensions.test(file.name))) {
    showStatus("Use apenas imagens JPG, PNG, HEIC ou HEIF.", "error");
    return;
  }
  if (files.some((file) => file.size > 20 * 1024 * 1024)) {
    showStatus("Cada imagem deve ter no máximo 20 MB.", "error");
    return;
  }

  analyzeButton.disabled = true;
  saveProductsButton.hidden = true;
  results.replaceChildren();
  try {
    for (const [index, file] of files.entries()) {
      showStatus(`Lendo documento ${index + 1} de ${files.length}: ${file.name}...`);
      const response = await nativeMessage({ fileName: file.name, imageBase64: await readBase64(file) });
      results.append(renderDocument(file, parseDocument(response.lines || [])));
    }
    saveProductsButton.hidden = !results.querySelector("tbody tr");
    showStatus("Extração concluída. Confira todos os campos com os documentos originais.", "success");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    analyzeButton.disabled = false;
  }
}

analyzeButton.addEventListener("click", () => analyzeFiles([...filesInput.files]));

let dragDepth = 0;
document.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add("dragging");
});
document.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove("dragging");
});
document.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("dragging");
  analyzeFiles([...event.dataTransfer.files]);
});
