import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
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

const LOGIN_PAGE = "admin.html";
const COLLECTION_NAME = "manifestacoes";
const NOT_INFORMED = "Não informado";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
  matricula: document.getElementById("detail-matricula"),
  turma: document.getElementById("detail-turma"),
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

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value, fallback = NOT_INFORMED) {
  return String(value ?? "").trim() || fallback;
}

function normalizeStatus(status) {
  return normalizeText(status, "Recebida");
}

function formatFirestoreDate(value) {
  if (!value) return NOT_INFORMED;

  let date = null;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return NOT_INFORMED;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

    if (isSelected && selectedClass) {
      button.classList.add(selectedClass);
    }
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
  detailFields.protocolo.textContent = NOT_INFORMED;
  detailFields.nome.textContent = NOT_INFORMED;
  detailFields.matricula.textContent = "Não informada";
  detailFields.turma.textContent = NOT_INFORMED;
  detailFields.tipo.innerHTML = `<span class="detail-type-dot"></span>${escapeHTML(NOT_INFORMED)}`;
  detailFields.assunto.textContent = NOT_INFORMED;
  detailFields.descricao.textContent = NOT_INFORMED;
  detailFields.prioridade.textContent = NOT_INFORMED;
  detailFields.criadoEm.textContent = NOT_INFORMED;
  respostaInput.value = "";
  observacaoInput.value = "";
  additionalMessagesList.innerHTML = `<p class="empty-messages">Nenhuma mensagem adicional foi enviada neste protocolo.</p>`;
  setSelectedStatus("Recebida");
  updateCounter(respostaInput, respostaCounter);
  updateCounter(observacaoInput, observacaoCounter);
  setDetailActionsEnabled(false);
}

function renderAdditionalMessages(messages) {
  if (!messages.length) {
    additionalMessagesList.innerHTML = `<p class="empty-messages">Nenhuma mensagem adicional foi enviada neste protocolo.</p>`;
    return;
  }

  additionalMessagesList.innerHTML = messages.map((message) => {
    const tipoAutor = normalizeText(message.tipoAutor, "");
    const messageClass = normalizeForComparison(tipoAutor) === "solicitante" ? "solicitante" : "escola";
    const autor = normalizeText(message.autor, messageClass === "solicitante" ? "Solicitante" : "Escola");
    const tipoLabel = normalizeText(message.tipoAutor, messageClass);
    const texto = normalizeText(message.mensagem);
    const criadoEm = formatFirestoreDate(message.criadoEm);

    return `
      <article class="protocol-message ${messageClass}">
        <div class="protocol-message-meta">
          <strong>${escapeHTML(autor)} <small>${escapeHTML(tipoLabel)}</small></strong>
          <span>${escapeHTML(criadoEm)}</span>
        </div>
        <p>${escapeHTML(texto)}</p>
      </article>
    `;
  }).join("");
}

async function carregarMensagensDoProtocolo(protocolo) {
  additionalMessagesList.innerHTML = `<p class="empty-messages">Carregando mensagens adicionais...</p>`;

  try {
    const messagesQuery = query(collection(db, COLLECTION_NAME, protocolo, "mensagens"), orderBy("criadoEm", "asc"));
    const snapshot = await getDocs(messagesQuery);
    const messages = snapshot.docs.map((messageDocument) => ({
      id: messageDocument.id,
      ...messageDocument.data()
    }));

    renderAdditionalMessages(messages);
  } catch (error) {
    console.error("Erro ao carregar mensagens adicionais:", error);
    additionalMessagesList.innerHTML = `<p class="empty-messages">Não foi possível carregar as mensagens adicionais.</p>`;
  }
}

function renderDetails(data) {
  const identificado = data.identificado === true;
  const tipo = normalizeText(data.tipo);

  selectedProtocol = normalizeText(data.protocolo, data.id || "");
  detailFields.protocolo.textContent = selectedProtocol;
  detailFields.nome.textContent = identificado ? normalizeText(data.nome) : "Não identificado";
  detailFields.matricula.textContent = identificado ? normalizeText(data.matricula, "Não informada") : "Não informada";
  detailFields.turma.textContent = normalizeText(data.turma);
  detailFields.tipo.innerHTML = `<span class="detail-type-dot"></span>${escapeHTML(tipo)}`;
  detailFields.assunto.textContent = normalizeText(data.assunto);
  detailFields.descricao.textContent = normalizeText(data.descricao);
  detailFields.prioridade.textContent = normalizeText(data.prioridade);
  detailFields.criadoEm.textContent = formatFirestoreDate(data.criadoEm);
  respostaInput.value = normalizeText(data.resposta, "");
  observacaoInput.value = normalizeText(data.observacaoInterna, "");
  setSelectedStatus(normalizeStatus(data.status));
  updateCounter(respostaInput, respostaCounter);
  updateCounter(observacaoInput, observacaoCounter);
  setDetailActionsEnabled(true);
}

function updateSummary() {
  const counts = {
    recebidas: 0,
    analise: 0,
    andamento: 0,
    resolvidas: 0,
    arquivadas: 0,
    total: manifestations.length
  };

  manifestations.forEach((item) => {
    const status = normalizeForComparison(normalizeStatus(item.status));

    if (status === "recebida") counts.recebidas += 1;
    if (status === "em analise") counts.analise += 1;
    if (status === "em andamento") counts.andamento += 1;
    if (status === "resolvida") counts.resolvidas += 1;
    if (status === "arquivada") counts.arquivadas += 1;
  });

  summaryFields.recebidas.textContent = counts.recebidas;
  summaryFields.analise.textContent = counts.analise;
  summaryFields.andamento.textContent = counts.andamento;
  summaryFields.resolvidas.textContent = counts.resolvidas;
  summaryFields.arquivadas.textContent = counts.arquivadas;
  summaryFields.total.textContent = counts.total;
}

function renderTable(items) {
  tableBody.innerHTML = "";

  if (!items.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    row.innerHTML = `<td colspan="7">Nenhuma manifestação encontrada.</td>`;
    tableBody.appendChild(row);
    tableCount.textContent = `Mostrando 0 de ${manifestations.length} registros`;
    return;
  }

  const rows = items.map((item) => {
    const protocolo = normalizeText(item.protocolo, item.id);
    const assunto = normalizeText(item.assunto);
    const turma = normalizeText(item.turma);
    const data = formatFirestoreDate(item.criadoEm);

    return `
      <tr>
        <td><a href="#" data-open-detail="${escapeHTML(protocolo)}">${escapeHTML(protocolo)}</a></td>
        <td>${getTypeLabel(item.tipo)}</td>
        <td>${escapeHTML(assunto)}</td>
        <td>${escapeHTML(turma)}</td>
        <td>${getStatusChip(item.status)}</td>
        <td>${escapeHTML(data)}</td>
        <td><button class="small-action" type="button" data-open-detail="${escapeHTML(protocolo)}">Ver detalhes</button></td>
      </tr>
    `;
  });

  tableBody.innerHTML = rows.join("");
  tableCount.textContent = `Mostrando 1 a ${items.length} de ${manifestations.length} registros`;
}

function populateTurmaFilter() {
  const currentValue = turmaFilter.value;
  const turmas = Array.from(new Set(manifestations.map((item) => normalizeText(item.turma, "")).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  turmaFilter.innerHTML = `<option value="">Turma</option>${turmas.map((turma) => `<option value="${escapeHTML(turma)}">${escapeHTML(turma)}</option>`).join("")}`;

  if (turmas.includes(currentValue)) {
    turmaFilter.value = currentValue;
  }
}

function applyFilters() {
  const search = normalizeForComparison(searchInput.value.trim());
  const status = statusFilter.value;
  const turma = turmaFilter.value;

  filteredManifestations = manifestations.filter((item) => {
    const protocolo = normalizeForComparison(normalizeText(item.protocolo, item.id));
    const assunto = normalizeForComparison(item.assunto);
    const itemStatus = normalizeStatus(item.status);
    const itemTurma = normalizeText(item.turma, "");

    const matchesSearch = !search || protocolo.includes(search) || assunto.includes(search);
    const matchesStatus = !status || normalizeForComparison(itemStatus) === normalizeForComparison(status);
    const matchesTurma = !turma || itemTurma === turma;

    return matchesSearch && matchesStatus && matchesTurma;
  });

  renderTable(filteredManifestations);
}

async function loadManifestations() {
  showFeedback("dashboard", "success", "Carregando manifestações", "Buscando os registros enviados pelos estudantes.");

  try {
    let snapshot;

    try {
      const orderedQuery = query(collection(db, COLLECTION_NAME), orderBy("criadoEm", "desc"));
      snapshot = await getDocs(orderedQuery);
    } catch (error) {
      console.error("Erro ao ordenar por criadoEm. Carregando sem ordenação:", error);
      snapshot = await getDocs(collection(db, COLLECTION_NAME));
    }

    manifestations = snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    }));

    manifestations.sort((a, b) => {
      const aSeconds = a.criadoEm?.seconds ?? 0;
      const bSeconds = b.criadoEm?.seconds ?? 0;
      return bSeconds - aSeconds;
    });

    populateTurmaFilter();
    applyFilters();
    updateSummary();
    clearDetails();

    if (!manifestations.length) {
      showFeedback("dashboard", "success", "Nenhuma manifestação encontrada", "Quando os estudantes enviarem manifestações, elas aparecerão nesta lista.");
      return;
    }

    hideFeedback("dashboard");
  } catch (error) {
    console.error("Erro ao buscar manifestações:", error);
    manifestations = [];
    filteredManifestations = [];
    renderTable([]);
    updateSummary();
    clearDetails();
    showFeedback("dashboard", "error", "Erro ao carregar manifestações", "Não foi possível buscar os dados agora. Tente novamente em instantes.");
  }
}

async function openDetails(protocolo) {
  hideFeedback("detail");

  try {
    const snapshot = await getDoc(doc(db, COLLECTION_NAME, protocolo));

    if (!snapshot.exists()) {
      showFeedback("detail", "error", "Manifestação não encontrada", "Este protocolo não foi localizado no Firestore.");
      return;
    }

    const data = {
      id: snapshot.id,
      ...snapshot.data()
    };

    const localIndex = manifestations.findIndex((item) => normalizeText(item.protocolo, item.id) === protocolo);
    if (localIndex >= 0) {
      manifestations[localIndex] = data;
    }

    renderDetails(data);
    await carregarMensagensDoProtocolo(selectedProtocol);
    applyFilters();
    updateSummary();
  } catch (error) {
    console.error("Erro ao abrir detalhes:", error);
    showFeedback("detail", "error", "Erro ao abrir detalhes", "Não foi possível carregar os dados desta manifestação.");
  }
}

async function saveCurrentManifestation(statusOverride = null) {
  if (!selectedProtocol) {
    showFeedback("detail", "error", "Selecione uma manifestação", "Abra os detalhes de uma manifestação antes de salvar.");
    return;
  }

  const status = statusOverride || selectedStatus;
  const resposta = respostaInput.value.trim();
  const observacaoInterna = observacaoInput.value.trim();

  try {
    setSavingState(true);
    await updateDoc(doc(db, COLLECTION_NAME, selectedProtocol), {
      status,
      resposta,
      observacaoInterna,
      atualizadoEm: serverTimestamp()
    });

    const localIndex = manifestations.findIndex((item) => normalizeText(item.protocolo, item.id) === selectedProtocol);
    if (localIndex >= 0) {
      manifestations[localIndex] = {
        ...manifestations[localIndex],
        status,
        resposta,
        observacaoInterna,
        atualizadoEm: new Date()
      };
      renderDetails(manifestations[localIndex]);
    }

    applyFilters();
    updateSummary();
    showFeedback("detail", "success", "Atualização salva", "A manifestação foi atualizada com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar atualização:", error);
    showFeedback("detail", "error", "Erro ao salvar", "Não foi possível salvar a atualização agora.");
  } finally {
    setSavingState(false);
  }
}

async function logout() {
  try {
    await signOut(auth);
    window.location.href = LOGIN_PAGE;
  } catch (error) {
    console.error("Erro ao sair do painel:", error);
    showFeedback("dashboard", "error", "Erro ao sair", "Não foi possível encerrar a sessão agora.");
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  adminUserName.textContent = user.email || user.displayName || "Administrador";
  adminUserRole.textContent = "Clique para sair";
  loadManifestations();
});

tableBody.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-open-detail]");
  if (!trigger) return;

  event.preventDefault();
  openDetails(trigger.dataset.openDetail);
});

statusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedStatus(button.dataset.status);
  });
});

searchInput.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);
turmaFilter.addEventListener("change", applyFilters);
filterButton.addEventListener("click", applyFilters);
saveButton.addEventListener("click", () => saveCurrentManifestation());
archiveButton.addEventListener("click", () => saveCurrentManifestation("Arquivada"));
adminLogoutButton.addEventListener("click", logout);
respostaInput.addEventListener("input", () => updateCounter(respostaInput, respostaCounter));
observacaoInput.addEventListener("input", () => updateCounter(observacaoInput, observacaoCounter));

clearDetails();
