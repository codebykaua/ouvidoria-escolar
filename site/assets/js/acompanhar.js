import { apiRequest, escapeHTML, formatDate } from "./api.js";

const form = document.getElementById("consulta-form");
const protocolInput = document.getElementById("protocolo-consulta");
const submitButton = document.getElementById("consultar-manifestacao");
const resultCard = document.getElementById("resultado-consulta");
const feedback = document.getElementById("consulta-feedback");
const feedbackTitle = document.getElementById("consulta-feedback-title");
const feedbackMessage = document.getElementById("consulta-feedback-message");
const messagesCard = document.getElementById("mensagens-protocolo-card");
const messagesList = document.getElementById("mensagens-protocolo-lista");
const messageInput = document.getElementById("nova-mensagem-protocolo");
const messageCounter = document.getElementById("nova-mensagem-counter");
const sendMessageButton = document.getElementById("enviar-mensagem-protocolo");
const messageFeedback = document.getElementById("mensagem-protocolo-feedback");
const messageFeedbackTitle = document.getElementById("mensagem-protocolo-feedback-title");
const messageFeedbackMessage = document.getElementById("mensagem-protocolo-feedback-message");

const fields = {
  protocolo: document.getElementById("resultado-protocolo"),
  status: document.getElementById("resultado-status"),
  tipo: document.getElementById("resultado-tipo"),
  assunto: document.getElementById("resultado-assunto"),
  turma: document.getElementById("resultado-turma"),
  criadoEm: document.getElementById("resultado-criado-em"),
  atualizadoEm: document.getElementById("resultado-atualizado-em"),
  resposta: document.getElementById("resultado-resposta")
};

const statusSteps = Array.from(document.querySelectorAll("[data-progress-step]"));
const statusClassMap = {
  "recebida": "received",
  "em análise": "analysis",
  "em analise": "analysis",
  "em andamento": "progress",
  "resolvida": "resolved",
  "arquivada": "archived"
};
const progressOrder = ["Recebida", "Em análise", "Em andamento", "Resolvida"];
let currentProtocol = "";

function normalizeProtocol(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}
function normalizeText(value, fallback = "-") {
  return String(value || "").trim() || fallback;
}
function normalizeStatus(status) {
  return (status || "Recebida").trim() || "Recebida";
}
function normalizeForComparison(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function showFeedback(type, title, message) {
  feedback.hidden = false;
  feedback.dataset.type = type;
  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;
}
function hideFeedback() {
  feedback.hidden = true;
  feedback.removeAttribute("data-type");
  feedbackTitle.textContent = "";
  feedbackMessage.textContent = "";
}
function showMessageFeedback(type, title, message) {
  messageFeedback.hidden = false;
  messageFeedback.dataset.type = type;
  messageFeedbackTitle.textContent = title;
  messageFeedbackMessage.textContent = message;
}
function hideMessageFeedback() {
  messageFeedback.hidden = true;
  messageFeedback.removeAttribute("data-type");
}
function setSubmitState(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
}
function setSendMessageState(isSubmitting) {
  sendMessageButton.disabled = isSubmitting || !currentProtocol;
  sendMessageButton.setAttribute("aria-busy", String(isSubmitting));
}
function updateMessageCounter() {
  if (!messageCounter || !messageInput) return;
  messageCounter.textContent = `${messageInput.value.length}/${messageInput.maxLength}`;
}
function updateProgress(status) {
  const normalizedStatus = normalizeStatus(status);
  const currentIndex = progressOrder.findIndex((item) => normalizeForComparison(item) === normalizeForComparison(normalizedStatus));
  statusSteps.forEach((step) => {
    const stepStatus = step.dataset.progressStep;
    const stepIndex = progressOrder.findIndex((item) => normalizeForComparison(item) === normalizeForComparison(stepStatus));
    step.classList.toggle("active", stepIndex <= currentIndex && currentIndex >= 0);
  });
}
function renderMessages(messages = []) {
  if (!messages.length) {
    messagesList.innerHTML = `<p class="empty-state">Nenhuma mensagem adicional enviada neste protocolo.</p>`;
    return;
  }
  messagesList.innerHTML = messages.map((message) => {
    const author = message.autor === "admin" ? "Escola" : "Solicitante";
    return `
      <article class="protocol-message ${message.autor === "admin" ? "admin" : "student"}">
        <div class="protocol-message-header">
          <strong>${author}</strong>
          <span>${formatDate(message.criado_em || message.criadoEm)}</span>
        </div>
        <p>${escapeHTML(message.mensagem)}</p>
      </article>
    `;
  }).join("");
}
function renderManifestation(data) {
  const manifestation = data.manifestacao;
  const status = normalizeStatus(manifestation.status);
  fields.protocolo.textContent = manifestation.protocolo;
  fields.status.textContent = status;
  fields.status.className = `status-chip ${statusClassMap[normalizeForComparison(status)] || ""}`;
  fields.tipo.textContent = normalizeText(manifestation.tipo);
  fields.assunto.textContent = normalizeText(manifestation.assunto);
  fields.turma.textContent = normalizeText(manifestation.turma, manifestation.identificado ? "Não informado" : "Manifestação anônima");
  fields.criadoEm.textContent = formatDate(manifestation.criado_em || manifestation.criadoEm);
  fields.atualizadoEm.textContent = formatDate(manifestation.atualizado_em || manifestation.atualizadoEm);
  fields.resposta.textContent = normalizeText(manifestation.resposta, "Ainda não há resposta registrada para este protocolo.");
  updateProgress(status);
  renderMessages(data.mensagens || []);
  resultCard.hidden = false;
  messagesCard.hidden = false;
  currentProtocol = manifestation.protocolo;
  setSendMessageState(false);
}
async function loadManifestation(protocolo) {
  const data = await apiRequest(`/api/manifestacoes/${encodeURIComponent(protocolo)}`);
  renderManifestation(data);
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const protocolo = normalizeProtocol(protocolInput.value);
  if (!protocolo) {
    showFeedback("error", "Informe o protocolo", "Digite o protocolo recebido ao enviar a manifestação.");
    protocolInput.focus();
    return;
  }
  try {
    setSubmitState(true);
    hideFeedback();
    await loadManifestation(protocolo);
  } catch (error) {
    currentProtocol = "";
    resultCard.hidden = true;
    messagesCard.hidden = true;
    showFeedback("error", "Protocolo não encontrado", error.message || "Confira o código e tente novamente.");
  } finally {
    setSubmitState(false);
  }
});
form.addEventListener("reset", () => {
  currentProtocol = "";
  resultCard.hidden = true;
  messagesCard.hidden = true;
  hideFeedback();
  hideMessageFeedback();
});
sendMessageButton.addEventListener("click", async () => {
  const mensagem = messageInput.value.trim();
  if (!currentProtocol) return;
  if (!mensagem) {
    showMessageFeedback("error", "Mensagem vazia", "Digite uma mensagem antes de enviar.");
    messageInput.focus();
    return;
  }
  try {
    setSendMessageState(true);
    await apiRequest(`/api/manifestacoes/${encodeURIComponent(currentProtocol)}/mensagens`, {
      method: "POST",
      body: JSON.stringify({ mensagem })
    });
    messageInput.value = "";
    updateMessageCounter();
    showMessageFeedback("success", "Mensagem enviada", "Sua mensagem foi anexada ao protocolo.");
    await loadManifestation(currentProtocol);
  } catch (error) {
    showMessageFeedback("error", "Não foi possível enviar", error.message || "Tente novamente em alguns instantes.");
  } finally {
    setSendMessageState(false);
  }
});
messageInput.addEventListener("input", updateMessageCounter);
updateMessageCounter();
setSendMessageState(false);
