import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7w15W56H0pskgLA0J-1Y_PRfcocDaPlo",
  authDomain: "ouvidoria-ceti-amargosa.firebaseapp.com",
  projectId: "ouvidoria-ceti-amargosa",
  storageBucket: "ouvidoria-ceti-amargosa.firebasestorage.app",
  messagingSenderId: "92079175069",
  appId: "1:92079175069:web:2a1581195c2dd869e3eb74",
  measurementId: "G-J12J3QY5FN"
};

const ADMIN_PAGE = "acessoadministrativo.html";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-senha");
const submitButton = document.getElementById("entrar-admin");
const resetPasswordLink = document.getElementById("recuperar-senha");
const showPasswordButton = document.getElementById("mostrar-senha");
const feedback = document.getElementById("admin-feedback");
const feedbackTitle = document.getElementById("admin-feedback-title");
const feedbackMessage = document.getElementById("admin-feedback-message");

let loginInProgress = false;

const friendlyErrorMessages = {
  "auth/user-not-found": "Usuário não encontrado.",
  "auth/wrong-password": "Senha incorreta.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
  "auth/invalid-credential": "E-mail ou senha incorretos."
};

function getFriendlyErrorMessage(error) {
  return friendlyErrorMessages[error?.code] || "Não foi possível entrar. Verifique seus dados e tente novamente.";
}

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

function getCredentials() {
  return {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };
}

onAuthStateChanged(auth, (user) => {
  if (user && !loginInProgress) {
    redirectToAdminPanel();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { email, password } = getCredentials();

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
    loginInProgress = true;
    setSubmitState(true);

    await signInWithEmailAndPassword(auth, email, password);
    showFeedback("success", "Login realizado com sucesso.", "Redirecionando para o painel administrativo.");
    redirectToAdminPanel(900);
  } catch (error) {
    console.error("Erro ao fazer login administrativo:", error);
    loginInProgress = false;
    showFeedback("error", "Não foi possível entrar", getFriendlyErrorMessage(error));
  } finally {
    setSubmitState(false);
  }
});

resetPasswordLink.addEventListener("click", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showFeedback("error", "E-mail necessário", "Digite seu e-mail para redefinir a senha.");
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showFeedback("success", "Link enviado", "Enviamos um link de recuperação para seu e-mail.");
  } catch (error) {
    console.error("Erro ao enviar recuperação de senha:", error);
    showFeedback("error", "Não foi possível enviar o link", getFriendlyErrorMessage(error));
  }
});

showPasswordButton.addEventListener("click", () => {
  const isPasswordVisible = passwordInput.type === "text";
  passwordInput.type = isPasswordVisible ? "password" : "text";
  showPasswordButton.setAttribute("aria-label", isPasswordVisible ? "Mostrar senha" : "Ocultar senha");
});
