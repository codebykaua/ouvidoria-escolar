import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const form = document.getElementById("manifestacao-form");
const identificationFields = document.getElementById("identification-fields");
const nomeInput = document.getElementById("nome");
const matriculaInput = document.getElementById("matricula");
const turmaSelect = document.getElementById("turma");
const assuntoInput = document.getElementById("assunto");
const descricaoInput = document.getElementById("descricao");
const submitButton = document.getElementById("enviar-manifestacao");
const feedback = document.getElementById("manifestacao-feedback");
const feedbackTitle = document.getElementById("feedback-title");
const feedbackMessage = document.getElementById("feedback-message");
const protocolBox = document.getElementById("protocol-box");
const protocolOutput = document.getElementById("protocolo-gerado");
const copyButton = document.getElementById("copiar-protocolo");
const counter = document.querySelector(".counter");

let lastProtocol = "";
let keepFeedbackOnReset = false;

function getCheckedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function isIdentified() {
  return getCheckedValue("identificacao") === "sim";
}

function generateProtocol() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);

  const code = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `FALA-CETI-${code}`;
}

function setSubmitState(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
}

function showFeedback(type, title, message, protocol = "") {
  feedback.hidden = false;
  feedback.dataset.type = type;
  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;
  lastProtocol = protocol;

  if (protocol) {
    protocolOutput.textContent = protocol;
    protocolBox.hidden = false;
    copyButton.textContent = "Copiar protocolo";
  } else {
    protocolOutput.textContent = "";
    protocolBox.hidden = true;
  }
}

function hideFeedback() {
  feedback.hidden = true;
  feedback.removeAttribute("data-type");
  feedbackTitle.textContent = "";
  feedbackMessage.textContent = "";
  protocolOutput.textContent = "";
  protocolBox.hidden = true;
  lastProtocol = "";
}

function updateDescriptionCounter() {
  if (!counter) return;
  counter.textContent = `${descricaoInput.value.length}/2000`;
}

function syncIdentificationFields() {
  const identified = isIdentified();

  identificationFields.hidden = !identified;
  nomeInput.setAttribute("aria-required", String(identified));
  matriculaInput.setAttribute("aria-required", String(identified));
  turmaSelect.setAttribute("aria-required", String(identified));
  nomeInput.disabled = !identified;
  matriculaInput.disabled = !identified;
  turmaSelect.disabled = !identified;

  if (!identified) {
    nomeInput.value = "";
    matriculaInput.value = "";
    turmaSelect.value = "";
  }
}

function validateForm() {
  const identified = isIdentified();
  const nome = nomeInput.value.trim();
  const matricula = matriculaInput.value.trim();
  const turma = turmaSelect.value.trim();
  const tipo = getCheckedValue("tipo");
  const assunto = assuntoInput.value.trim();
  const descricao = descricaoInput.value.trim();
  const prioridade = getCheckedValue("prioridade");

  if (identified && !nome) {
    return { valid: false, message: "Informe seu nome completo para enviar a manifestação identificada.", element: nomeInput };
  }

  if (identified && !matricula) {
    return { valid: false, message: "Informe sua matrícula para enviar a manifestação identificada.", element: matriculaInput };
  }

  if (identified && !turma) {
    return { valid: false, message: "Selecione sua turma para enviar a manifestação identificada.", element: turmaSelect };
  }

  if (!tipo) {
    return { valid: false, message: "Selecione o tipo de manifestação.", element: form.querySelector(".manifestation-options") };
  }

  if (!assunto) {
    return { valid: false, message: "Informe o assunto da manifestação.", element: assuntoInput };
  }

  if (!descricao) {
    return { valid: false, message: "Descreva sua manifestação com detalhes.", element: descricaoInput };
  }

  if (!prioridade) {
    return { valid: false, message: "Selecione o grau da manifestação.", element: form.querySelector(".priority-row") };
  }

  return {
    valid: true,
    data: {
      identificado: identified,
      nome: identified ? nome : "",
      matricula: identified ? matricula : "",
      turma: identified ? turma : "",
      tipo,
      assunto,
      descricao,
      prioridade
    }
  };
}

async function copyProtocol() {
  if (!lastProtocol) return;

  try {
    await navigator.clipboard.writeText(lastProtocol);
    copyButton.textContent = "Protocolo copiado";
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = lastProtocol;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    copyButton.textContent = "Protocolo copiado";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validation = validateForm();
  if (!validation.valid) {
    showFeedback("error", "Revise as informações", validation.message);
    validation.element?.focus?.();
    return;
  }

  const protocolo = generateProtocol();
  const manifestacao = {
    protocolo,
    ...validation.data,
    status: "Recebida",
    resposta: "",
    observacaoInterna: "",
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  };

  try {
    setSubmitState(true);
    await setDoc(doc(db, "manifestacoes", protocolo), manifestacao);

    keepFeedbackOnReset = true;
    form.reset();
    syncIdentificationFields();
    updateDescriptionCounter();

    showFeedback(
      "success",
      "Manifestação enviada com sucesso!",
      "Guarde este protocolo para acompanhar sua manifestação.",
      protocolo
    );
  } catch (error) {
    console.error("Erro ao salvar manifestação:", error);
    showFeedback(
      "error",
      "Não foi possível enviar sua manifestação",
      "Tente novamente em instantes. Se o problema continuar, procure a equipe da escola."
    );
  } finally {
    setSubmitState(false);
  }
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    syncIdentificationFields();
    updateDescriptionCounter();

    if (keepFeedbackOnReset) {
      keepFeedbackOnReset = false;
      return;
    }

    hideFeedback();
  }, 0);
});

form.querySelectorAll('input[name="identificacao"]').forEach((input) => {
  input.addEventListener("change", syncIdentificationFields);
});

descricaoInput.addEventListener("input", updateDescriptionCounter);
copyButton.addEventListener("click", copyProtocol);

syncIdentificationFields();
updateDescriptionCounter();