import { apiRequest, clearAdminToken, escapeHTML, formatDate } from "./api.js";

const LOGIN_PAGE = "admin.html";
const NOT_INFORMED = "Não informado";

const adminLogoutButton = document.getElementById("admin-logout");
const adminUserName = document.getElementById("admin-user-name");
const adminUserRole = document.getElementById("admin-user-role");
const searchInput = document.getElementById("admin-search");
const statusFilter = document.getElementById("admin-status-filter");
const turmaFilter = document.getElementById("admin-turma-filter");
const filterButton = document.getElementById("admin-filter-button");
const tableBody = document.getElementById("manifestacoes-tbody");
const tableCount = document.getElementById("table-count");
const dashboardFeedback = document.getElementById("admin-dashboard-feedback");
const dashboardFeedbackTitle = document.getElementById("admin-dashboard-feedback-title");
const dashboardFeedbackMessage = document.getElementById("admin-dashboard-feedback-message");
const detailFeedback = document.getElementById("detail-feedback");
const detailFeedbackTitle = document.getElementById("detail-feedback-title");
const detailFeedbackMessage = document.getElementById("detail-feedback-message");
const statusButtons = Array.from(document.querySelectorAll("[data-status]"));
const respostaInput = document.getElementById("admin-resposta");
const observacaoInput = document.getElementById("admin-observacao");
const additionalMessagesList = document.getElementById("admin-mensagens-lista");
const respostaCounter = document.getElementById("resposta-counter");
const observacaoCounter = document.getElementById("observacao-counter");
const saveButton = document.getElementById("salvar-atualizacao");
const archiveButton = document.getElementById("arquivar-manifestacao");

const detailFields = {
  protocolo: document.getElementById("detail-protocolo"),
  nome: document.getElementById("detail-nome"),
  turma: document.getElementById("detail-turma"),
  email: document.getElementById("detail-email"),
  tipo: document.getElementById("detail-tipo"),
  assunto: document.getElementById("detail-assunto"),
  descricao: document.getElementById("detail-descricao"),
  prioridade: document.getElementById("detail-prioridade"),
  criadoEm: document.getElementById("detail-criado-em")
};

const summaryFields = {
  recebidas: document.getElementById("summary-recebidas"),
  analise: document.getElementById("summary-analise"),
  andamento: document.getElementById("summary-andamento"),
  resolvidas: document.getElementById("summary-resolvidas"),
  arquivadas: document.getElementById("summary-arquivadas"),
  total: document.getElementById("summary-total")
};

const statusClassMap = {
  "recebida": "received",
  "em análise": "analysis",
  "em analise": "analysis",
  "em andamento": "progress",
  "resolvida": "resolved",
  "arquivada": "archived"
};
const typeClassMap = {
  "reclamação": "complaint",
  "reclamacao": "complaint",
  "sugestão": "suggestion",
  "sugestao": "suggestion",
  "demanda": "request",
  "solicitação": "request",
  "solicitacao": "request",
  "elogio": "praise"
};

let manifestations = [];
let filteredManifestations = [];
let selectedProtocol = "";
let selectedStatus = "Recebida";

function normalizeForComparison(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function normalizeText(value, fallback = NOT_INFORMED) {
  return String(value ?? "").trim() || fallback;
}
function normalizeStatus(status) {
  return normalizeText(status, "Recebida");
}
function showFeedback(target, type, title, message) {
  const feedback = target === "detail" ? detailFeedback : dashboardFeedback;
  const titleElement = target === "detail" ? detailFeedbackTitle : dashboardFeedbackTitle;
  const messageElement = target === "detail" ? detailFeedbackMessage : dashboardFeedbackMessage;
  feedback.hidden = false;
  feedback.dataset.type = type;
  titleElement.textContent = title;
  messageElement.textContent = message;
}
function hideFeedback(target) {
  const feedback = target === "detail" ? detailFeedback : dashboardFeedback;
  const titleElement = target === "detail" ? detailFeedbackTitle : dashboardFeedbackTitle;
  const messageElement = target === "detail" ? detailFeedbackMessage : dashboardFeedbackMessage;
  feedback.hidden = true;
  feedback.removeAttribute("data-type");
  titleElement.textContent = "";
  messageElement.textContent = "";
}
function setDetailActionsEnabled(enabled) {
  saveButton.disabled = !enabled;
  archiveButton.disabled = !enabled;
}
function setSavingState(isSaving) {
  saveButton.disabled = isSaving || !selectedProtocol;
  archiveButton.disabled = isSaving || !selectedProtocol;
  saveButton.setAttribute("aria-busy", String(isSaving));
}
function updateCounter(textarea, counter) {
  counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
}
function setSelectedStatus(status) {
  selectedStatus = normalizeStatus(status);
  statusButtons.forEach((button) => {
    const isSelected = button.dataset.status === selectedStatus;
    const selectedClass = statusClassMap[normalizeForComparison(button.dataset.status)];
    button.classList.toggle("selected", isSelected);
    button.classList.remove("received", "analysis", "progress", "resolved", "archived");
    if (isSelected && selectedClass) button.classList.add(selectedClass);
  });
}
function getStatusChip(status) {
  const normalizedStatus = normalizeStatus(status);
  const statusClass = statusClassMap[normalizeForComparison(normalizedStatus)] || "";
  return `<span class="status-chip ${statusClass}">${escapeHTML(normalizedStatus)}</span>`;
}
function getTypeLabel(type) {
  const normalizedType = normalizeText(type);
  const typeClass = typeClassMap[normalizeForComparison(normalizedType)] || "archive";
  return `<span class="type-label ${typeClass}"><span class="type-dot"></span>${escapeHTML(normalizedType)}</span>`;
}
function clearDetails() {
  selectedProtocol = "";
  selectedStatus = "Recebida";
  Object.values(detailFields).forEach((field) => { if (field) field.textContent = NOT_INFORMED; });
  detailFields.protocolo.textContent = "Selecione uma manifestação";
  respostaInput.value = "";
  observacaoInput.value = "";
  additionalMessagesList.innerHTML = `<p class="empty-state">Selecione uma manifestação para visualizar as mensagens adicionais.</p>`;
  updateCounter(respostaInput, respostaCounter);
  updateCounter(observacaoInput, observacaoCounter);
  setSelectedStatus("Recebida");
  setDetailActionsEnabled(false);
}
function renderSummary() {
  const counts = { recebidas: 0, analise: 0, andamento: 0, resolvidas: 0, arquivadas: 0, total: manifestations.length };
  manifestations.forEach((item) => {
    const status = normalizeForComparison(item.status);
    if (status === "recebida") counts.recebidas += 1;
    else if (status === "em analise") counts.analise += 1;
    else if (status === "em andamento") counts.andamento += 1;
    else if (status === "resolvida") counts.resolvidas += 1;
    else if (status === "arquivada") counts.arquivadas += 1;
  });
  summaryFields.recebidas.textContent = counts.recebidas;
  summaryFields.analise.textContent = counts.analise;
  summaryFields.andamento.textContent = counts.andamento;
  summaryFields.resolvidas.textContent = counts.resolvidas;
  summaryFields.arquivadas.textContent = counts.arquivadas;
  summaryFields.total.textContent = counts.total;
}
function applyFilters() {
  const search = normalizeForComparison(searchInput.value);
  const status = normalizeForComparison(statusFilter.value);
  const turma = normalizeForComparison(turmaFilter.value);
  filteredManifestations = manifestations.filter((item) => {
    const matchesSearch = !search || normalizeForComparison(`${item.protocolo} ${item.assunto} ${item.descricao} ${item.nome}`).includes(search);
    const matchesStatus = !status || normalizeForComparison(item.status) === status;
    const matchesTurma = !turma || normalizeForComparison(item.turma) === turma;
    return matchesSearch && matchesStatus && matchesTurma;
  });
  renderTable();
}
function renderTable() {
  if (!filteredManifestations.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-table">Nenhuma manifestação encontrada.</td></tr>`;
    tableCount.textContent = "0 registros";
    return;
  }
  tableBody.innerHTML = filteredManifestations.map((item) => `
    <tr data-protocolo="${escapeHTML(item.protocolo)}">
      <td><strong>${escapeHTML(item.protocolo)}</strong></td>
      <td>${getTypeLabel(item.tipo)}</td>
      <td>${escapeHTML(normalizeText(item.assunto))}</td>
      <td>${escapeHTML(normalizeText(item.turma, item.identificado ? NOT_INFORMED : "Anônima"))}</td>
      <td>${getStatusChip(item.status)}</td>
      <td>${formatDate(item.criado_em)}</td>
      <td><button class="table-action" type="button" data-open="${escapeHTML(item.protocolo)}">Abrir</button></td>
    </tr>
  `).join("");
  tableCount.textContent = `${filteredManifestations.length} registro${filteredManifestations.length === 1 ? "" : "s"}`;
}
function renderMessages(messages = []) {
  if (!messages.length) {
    additionalMessagesList.innerHTML = `<p class="empty-state">Nenhuma mensagem adicional enviada pelo solicitante.</p>`;
    return;
  }
  additionalMessagesList.innerHTML = messages.map((message) => {
    const author = message.autor === "admin" ? "Escola" : "Solicitante";
    return `
      <article class="protocol-message ${message.autor === "admin" ? "admin" : "student"}">
        <div class="protocol-message-header">
          <strong>${author}</strong>
          <span>${formatDate(message.criado_em)}</span>
        </div>
        <p>${escapeHTML(message.mensagem)}</p>
      </article>
    `;
  }).join("");
}
async function loadManifestations() {
  try {
    const data = await apiRequest("/api/admin/manifestacoes", { admin: true });
    manifestations = data.manifestacoes || [];
    filteredManifestations = [...manifestations];
    renderSummary();
    applyFilters();
    hideFeedback("dashboard");
  } catch (error) {
    if (error.status === 401) {
      clearAdminToken();
      window.location.href = LOGIN_PAGE;
      return;
    }
    console.error("Erro ao carregar manifestações:", error);
    showFeedback("dashboard", "error", "Erro ao carregar", error.message || "Não foi possível buscar os registros.");
  }
}
async function openManifestation(protocolo) {
  try {
    hideFeedback("detail");
    const data = await apiRequest(`/api/admin/manifestacoes/${encodeURIComponent(protocolo)}`, { admin: true });
    const item = data.manifestacao;
    selectedProtocol = item.protocolo;
    detailFields.protocolo.textContent = normalizeText(item.protocolo);
    detailFields.nome.textContent = item.identificado ? normalizeText(item.nome) : "Manifestação anônima";
    detailFields.turma.textContent = normalizeText(item.turma, item.identificado ? NOT_INFORMED : "Anônima");
    if (detailFields.email) detailFields.email.textContent = normalizeText(item.email, "Sem e-mail informado");
    detailFields.tipo.textContent = normalizeText(item.tipo);
    detailFields.assunto.textContent = normalizeText(item.assunto);
    detailFields.descricao.textContent = normalizeText(item.descricao);
    detailFields.prioridade.textContent = normalizeText(item.prioridade);
    detailFields.criadoEm.textContent = formatDate(item.criado_em);
    respostaInput.value = item.resposta || "";
    observacaoInput.value = item.observacao_interna || "";
    updateCounter(respostaInput, respostaCounter);
    updateCounter(observacaoInput, observacaoCounter);
    setSelectedStatus(item.status || "Recebida");
    renderMessages(data.mensagens || []);
    setDetailActionsEnabled(true);
  } catch (error) {
    console.error("Erro ao abrir manifestação:", error);
    showFeedback("detail", "error", "Erro ao abrir", error.message || "Tente novamente.");
  }
}
async function saveUpdate(statusOverride = null) {
  if (!selectedProtocol) return;
  try {
    setSavingState(true);
    const status = statusOverride || selectedStatus;
    const resposta = respostaInput.value.trim();
    const observacaoInterna = observacaoInput.value.trim();
    await apiRequest(`/api/admin/manifestacoes/${encodeURIComponent(selectedProtocol)}`, {
      method: "PUT",
      admin: true,
      body: JSON.stringify({ status, resposta, observacaoInterna })
    });
    showFeedback("detail", "success", "Atualização salva", resposta ? "A resposta foi salva e enviada por e-mail se houver e-mail cadastrado." : "As alterações foram salvas.");
    await loadManifestations();
    await openManifestation(selectedProtocol);
  } catch (error) {
    console.error("Erro ao salvar atualização:", error);
    showFeedback("detail", "error", "Erro ao salvar", error.message || "Não foi possível salvar.");
  } finally {
    setSavingState(false);
  }
}
filterButton.addEventListener("click", applyFilters);
searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);
turmaFilter.addEventListener("change", applyFilters);
tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (button) openManifestation(button.dataset.open);
});
statusButtons.forEach((button) => button.addEventListener("click", () => setSelectedStatus(button.dataset.status)));
respostaInput.addEventListener("input", () => updateCounter(respostaInput, respostaCounter));
observacaoInput.addEventListener("input", () => updateCounter(observacaoInput, observacaoCounter));
saveButton.addEventListener("click", () => saveUpdate());
archiveButton.addEventListener("click", () => saveUpdate("Arquivada"));
adminLogoutButton.addEventListener("click", () => {
  clearAdminToken();
  window.location.href = LOGIN_PAGE;
});
adminUserName.textContent = "Coordenação";
adminUserRole.textContent = "Administrador";
clearDetails();
loadManifestations();
