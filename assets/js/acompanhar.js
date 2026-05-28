import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7w15W56H0pskgLA0J-1Y_PRfcocDaPlo",
  authDomain: "ouvidoria-ceti-amargosa.firebaseapp.com",
  projectId: "ouvidoria-ceti-amargosa",
  storageBucket: "ouvidoria-ceti-amargosa.firebasestorage.app",
  messagingSenderId: "92079175069",
  appId: "1:92079175069:web:2a1581195c2dd869e3eb74",
  measurementId: "G-J12J3QY5FN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

function normalizeStatus(status) {
  return (status || "Recebida").trim() || "Recebida";
}

function normalizeText(value, fallback = "-") {
  return String(value || "").trim() || fallback;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeForComparison(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatFirestoreDate(value) {
  if (!value) return "-";

  let date = null;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function setSubmitState(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
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

function hideResult() {
  resultCard.hidden = true;
  currentProtocol = "";
  hideMessages();
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
  messageFeedbackTitle.textContent = "";
  messageFeedbackMessage.textContent = "";
}

function updateMessageCounter() {
  messageCounter.textContent = `${messageInput.value.length}/${messageInput.maxLength}`;
}

function hideMessages() {
  messagesCard.hidden = true;
  messagesList.innerHTML = `<p class="empty-messages">Nenhuma mensagem adicional foi enviada neste protocolo.</p>`;
  messageInput.value = "";
  updateMessageCounter();
  hideMessageFeedback();
}

function setMessageSubmitState(isSubmitting) {
  sendMessageButton.disabled = isSubmitting;
  sendMessageButton.setAttribute("aria-busy", String(isSubmitting));
}

function applyStatusChip(status) {
  fields.status.className = "status-chip";

  const statusClass = statusClassMap[normalizeForComparison(status)];
  if (statusClass) {
    fields.status.classList.add(statusClass);
  }

  fields.status.textContent = status;
}

function updateProgressLine(status) {
  const currentIndex = progressOrder.findIndex((item) => normalizeForComparison(item) === normalizeForComparison(status));

  statusSteps.forEach((step, index) => {
    step.classList.remove("done", "active", "received", "analysis", "progress", "resolved");

    if (currentIndex === -1) return;

    if (index < currentIndex) {
      step.classList.add("done");
      return;
    }

    if (index === currentIndex) {
      step.classList.add("active");

      const statusClass = statusClassMap[normalizeForComparison(status)];
      if (statusClass && statusClass !== "archived") {
        step.classList.add(statusClass);
      }
    }
  });
}

function renderManifestation(data, fallbackProtocol) {
  const status = normalizeStatus(data.status);
  const resposta = normalizeText(data.resposta, "A escola ainda não enviou uma resposta para esta manifestação.");

  currentProtocol = normalizeText(data.protocolo, fallbackProtocol);
  fields.protocolo.textContent = currentProtocol;
  fields.tipo.textContent = normalizeText(data.tipo);
  fields.assunto.textContent = normalizeText(data.assunto);
  fields.turma.textContent = normalizeText(data.turma);
  fields.criadoEm.textContent = formatFirestoreDate(data.criadoEm);
  fields.atualizadoEm.textContent = formatFirestoreDate(data.atualizadoEm);
  fields.resposta.textContent = resposta;

  applyStatusChip(status);
  updateProgressLine(status);

  resultCard.hidden = false;
}

function renderMessages(messages) {
  if (!messages.length) {
    messagesList.innerHTML = `<p class="empty-messages">Nenhuma mensagem adicional foi enviada neste protocolo.</p>`;
    return;
  }

  messagesList.innerHTML = messages.map((message) => {
    const tipoAutor = normalizeText(message.tipoAutor, "solicitante");
    const messageClass = normalizeForComparison(tipoAutor) === "solicitante" ? "solicitante" : "escola";
    const autor = normalizeText(message.autor, messageClass === "solicitante" ? "Solicitante" : "Escola");
    const texto = normalizeText(message.mensagem, "");
    const data = formatFirestoreDate(message.criadoEm);

    return `
      <article class="protocol-message ${messageClass}">
        <div class="protocol-message-meta">
          <strong>${escapeHTML(autor)}</strong>
          <span>${escapeHTML(data)}</span>
        </div>
        <p>${escapeHTML(texto)}</p>
      </article>
    `;
  }).join("");
}

async function loadMessages(protocolo) {
  messagesCard.hidden = false;
  messagesList.innerHTML = `<p class="empty-messages">Carregando mensagens...</p>`;
  hideMessageFeedback();

  try {
    let snapshot;

    try {
      const messagesQuery = query(collection(db, "manifestacoes", protocolo, "mensagens"), orderBy("criadoEm", "asc"));
      snapshot = await getDocs(messagesQuery);
    } catch (error) {
      console.error("Erro ao ordenar mensagens. Carregando sem ordenação:", error);
      snapshot = await getDocs(collection(db, "manifestacoes", protocolo, "mensagens"));
    }

    const messages = snapshot.docs.map((messageDocument) => ({
      id: messageDocument.id,
      ...messageDocument.data()
    }));

    messages.sort((a, b) => (a.criadoEm?.seconds ?? 0) - (b.criadoEm?.seconds ?? 0));
    renderMessages(messages);
  } catch (error) {
    console.error("Erro ao carregar mensagens do protocolo:", error);
    messagesList.innerHTML = `<p class="empty-messages">Não foi possível carregar as mensagens agora.</p>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const protocolo = normalizeProtocol(protocolInput.value);
  protocolInput.value = protocolo;

  if (!protocolo) {
    hideResult();
    showFeedback("error", "Informe o protocolo", "Digite o protocolo recebido no envio da manifestação.");
    protocolInput.focus();
    return;
  }

  try {
    setSubmitState(true);
    hideFeedback();
    hideResult();

    const snapshot = await getDoc(doc(db, "manifestacoes", protocolo));

    if (!snapshot.exists()) {
      showFeedback("error", "Protocolo não encontrado", "Nenhuma manifestação foi encontrada com este protocolo. Confira o código e tente novamente.");
      return;
    }

    renderManifestation(snapshot.data(), protocolo);
    await loadMessages(protocolo);
  } catch (error) {
    console.error("Erro ao consultar manifestação:", error);
    hideResult();
    showFeedback("error", "Não foi possível consultar agora", "Tente novamente em instantes. Se o problema continuar, procure a equipe da escola.");
  } finally {
    setSubmitState(false);
  }
});

sendMessageButton.addEventListener("click", async () => {
  if (!currentProtocol) {
    showMessageFeedback("error", "Consulte um protocolo", "Consulte um protocolo válido antes de enviar uma mensagem.");
    protocolInput.focus();
    return;
  }

  const mensagem = messageInput.value.trim();

  if (!mensagem) {
    showMessageFeedback("error", "Escreva uma mensagem", "Digite uma mensagem antes de enviar.");
    messageInput.focus();
    return;
  }

  try {
    setMessageSubmitState(true);
    await addDoc(collection(db, "manifestacoes", currentProtocol, "mensagens"), {
      autor: "Solicitante",
      tipoAutor: "solicitante",
      mensagem,
      criadoEm: serverTimestamp()
    });

    await updateDoc(doc(db, "manifestacoes", currentProtocol), {
      atualizadoEm: serverTimestamp()
    });

    messageInput.value = "";
    updateMessageCounter();
    await loadMessages(currentProtocol);
    showMessageFeedback("success", "Mensagem enviada", "Sua mensagem foi enviada para a escola.");
  } catch (error) {
    console.error("Erro ao enviar mensagem do protocolo:", error);
    showMessageFeedback("error", "Não foi possível enviar", "Tente novamente em instantes. Se o problema continuar, procure a equipe da escola.");
  } finally {
    setMessageSubmitState(false);
  }
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    protocolInput.value = "";
    hideFeedback();
    hideResult();
    protocolInput.focus();
  }, 0);
});

messageInput.addEventListener("input", updateMessageCounter);
updateMessageCounter();
