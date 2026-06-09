import { apiRequest } from "./api.js";

const form = document.getElementById("manifestacao-form");
const turmaField = document.getElementById("turma-field");
const nomeInput = document.getElementById("nome");
const turmaSelect = document.getElementById("turma");
const emailInput = document.getElementById("email");
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

function getCheckedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function getProfile() {
  return getCheckedValue("perfil") || "estudante";
}

function isStudent() {
  return getProfile() === "estudante";
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

function updateDescriptionCounter() {
  if (!counter) return;
  counter.textContent = `${descricaoInput.value.length}/2000`;
}

function syncProfileFields() {
  const student = isStudent();

  nomeInput.setAttribute("aria-required", "true");
  emailInput.setAttribute("aria-required", "true");
  turmaSelect.setAttribute("aria-required", String(student));

  nomeInput.disabled = false;
  emailInput.disabled = false;
  turmaSelect.disabled = !student;
  turmaField.hidden = !student;

  if (!student) {
    turmaSelect.value = "";
  }
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateForm() {
  const profile = getProfile();
  const student = isStudent();
  const nome = nomeInput.value.trim();
  const turma = turmaSelect.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const tipo = getCheckedValue("tipo");
  const assunto = assuntoInput.value.trim();
  const descricao = descricaoInput.value.trim();
  const prioridade = getCheckedValue("prioridade");

  if (!profile) {
    return { valid: false, message: "Selecione se você é estudante ou funcionário.", element: form.querySelector('.radio-row') };
  }

  if (!nome) {
    return { valid: false, message: "Informe seu nome completo.", element: nomeInput };
  }

  if (student && !turma) {
    return { valid: false, message: "Selecione sua série.", element: turmaSelect };
  }

  if (!email) {
    return { valid: false, message: "Informe seu e-mail para receber o protocolo e a resposta.", element: emailInput };
  }

  if (!validateEmail(email)) {
    return { valid: false, message: "Informe um e-mail válido para receber a resposta.", element: emailInput };
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
      identificado: true,
      nome,
      turma: student ? turma : "Funcionário",
      email,
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

  try {
    setSubmitState(true);
    const result = await apiRequest("/api/manifestacoes", {
      method: "POST",
      body: JSON.stringify(validation.data)
    });

    form.reset();
    syncProfileFields();
    updateDescriptionCounter();

    showFeedback(
      "success",
      "Manifestação enviada com sucesso!",
      "Guarde este protocolo. Também enviaremos atualizações para o e-mail informado.",
      result.protocolo
    );
  } catch (error) {
    console.error("Erro ao salvar manifestação:", error);
    showFeedback("error", "Não foi possível enviar", error.message || "Verifique sua conexão e tente novamente.");
  } finally {
    setSubmitState(false);
  }
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    syncProfileFields();
    updateDescriptionCounter();
  }, 0);
});

document.querySelectorAll('input[name="perfil"]').forEach((radio) => {
  radio.addEventListener("change", syncProfileFields);
});

descricaoInput.addEventListener("input", updateDescriptionCounter);
copyButton.addEventListener("click", copyProtocol);

syncProfileFields();
updateDescriptionCounter();
