import { apiRequest, setAdminToken } from "./api.js";

const ADMIN_PAGE = "acessoadministrativo.html";

const form = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-senha");
const submitButton = document.getElementById("entrar-admin");
const feedback = document.getElementById("admin-feedback");
const feedbackTitle = document.getElementById("admin-feedback-title");
const feedbackMessage = document.getElementById("admin-feedback-message");
const resetPasswordLink = document.getElementById("recuperar-senha");
const showPasswordButton = document.getElementById("mostrar-senha");

function showFeedback(type, title, message) {
  feedback.hidden = false;
  feedback.dataset.type = type;
  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;
}

function setSubmitState(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute("aria-busy", String(isSubmitting));
}

function redirectToAdminPanel(delay = 0) {
  window.setTimeout(() => {
    window.location.href = ADMIN_PAGE;
  }, delay);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    showFeedback("error", "Informe o e-mail", "O e-mail é obrigatório.");
    emailInput.focus();
    return;
  }

  if (!password) {
    showFeedback("error", "Informe a senha", "A senha é obrigatória.");
    passwordInput.focus();
    return;
  }

  try {
    setSubmitState(true);
    const data = await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setAdminToken(data.token);
    showFeedback("success", "Login realizado com sucesso.", "Redirecionando para o painel administrativo.");
    redirectToAdminPanel(700);
  } catch (error) {
    console.error("Erro ao fazer login administrativo:", error);
    showFeedback("error", "Não foi possível entrar", error.message || "Confira o e-mail e a senha.");
  } finally {
    setSubmitState(false);
  }
});

resetPasswordLink.addEventListener("click", (event) => {
  event.preventDefault();
  showFeedback(
    "error",
    "Recuperação indisponível",
    "No Cloudflare, a senha é configurada nas variáveis do Worker. Altere ADMIN_PASSWORD no painel da Cloudflare."
  );
});

showPasswordButton.addEventListener("click", () => {
  const isPasswordVisible = passwordInput.type === "text";
  passwordInput.type = isPasswordVisible ? "password" : "text";
  showPasswordButton.setAttribute("aria-label", isPasswordVisible ? "Mostrar senha" : "Ocultar senha");
});
