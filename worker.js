const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function text(value, status = 200) {
  return new Response(value, { status, headers: { ...JSON_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}
async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
function nowISO() { return new Date().toISOString(); }
function normalizeProtocol(value) { return String(value || "").trim().replace(/\s+/g, "").toUpperCase(); }
function generateProtocol() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `FALA-CETI-${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")); }
function sanitizeText(value, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function publicManifestation(row) {
  if (!row) return null;
  return {
    protocolo: row.protocolo,
    identificado: Boolean(row.identificado),
    nome: row.identificado ? row.nome : "",
    turma: row.turma,
    email: "",
    tipo: row.tipo,
    assunto: row.assunto,
    prioridade: row.prioridade,
    status: row.status,
    resposta: row.resposta,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em
  };
}
function adminManifestation(row) {
  if (!row) return null;
  return { ...row, identificado: Boolean(row.identificado) };
}
async function sha256Text(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function base64url(input) {
  let bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return atob(value);
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(new Uint8Array(signature));
}
async function createToken(email, env) {
  const payload = { email, exp: Date.now() + 1000 * 60 * 60 * 8 };
  const encoded = base64url(JSON.stringify(payload));
  const signature = await sign(encoded, env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD || "troque-este-segredo");
  return `${encoded}.${signature}`;
}
async function verifyAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !token.includes(".")) return false;
  const [encoded, signature] = token.split(".");
  const expected = await sign(encoded, env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD || "troque-este-segredo");
  if (signature !== expected) return false;
  try {
    const payload = JSON.parse(fromBase64url(encoded));
    return payload.exp && payload.exp > Date.now();
  } catch { return false; }
}
async function requireAdmin(request, env) {
  const ok = await verifyAdmin(request, env);
  if (!ok) return json({ message: "Sessão administrativa inválida ou expirada." }, 401);
  return null;
}
async function sendBrevoEmail(env, { toEmail, toName = "", subject, htmlContent, textContent }) {
  if (!env.BREVO_API_KEY || !toEmail) return { skipped: true };
  const senderEmail = env.MAIL_FROM_EMAIL || env.OUVIDORIA_EMAIL;
  const senderName = env.MAIL_FROM_NAME || "Ouvidoria Escolar";
  if (!senderEmail) return { skipped: true };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName || undefined }],
      subject,
      htmlContent,
      textContent
    })
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("Erro Brevo:", response.status, body.slice(0, 300));
    return { ok: false, status: response.status };
  }
  return { ok: true };
}
async function notifyNewManifestation(env, data) {
  if (!env.OUVIDORIA_EMAIL) return;
  const html = `
    <h2>Nova manifestação recebida</h2>
    <p><strong>Protocolo:</strong> ${data.protocolo}</p>
    <p><strong>Tipo:</strong> ${data.tipo}</p>
    <p><strong>Assunto:</strong> ${data.assunto}</p>
    <p><strong>Turma:</strong> ${data.turma || "Não informada"}</p>
    <p><strong>Nome:</strong> ${data.nome || "Manifestação anônima"}</p>
    <p><strong>E-mail:</strong> ${data.email || "Não informado"}</p>
    <p><strong>Prioridade:</strong> ${data.prioridade}</p>
    <p><strong>Mensagem:</strong></p>
    <p>${String(data.descricao).replace(/\n/g, "<br>")}</p>
  `;
  await sendBrevoEmail(env, {
    toEmail: env.OUVIDORIA_EMAIL,
    subject: `Nova manifestação - ${data.protocolo}`,
    htmlContent: html,
    textContent: `Nova manifestação recebida\nProtocolo: ${data.protocolo}\nAssunto: ${data.assunto}\nMensagem: ${data.descricao}`
  });
}
async function notifyStudentAnswer(env, data) {
  if (!data.email || !data.resposta) return;
  const html = `
    <h2>Resposta da Ouvidoria Escolar</h2>
    <p>Olá${data.nome ? `, ${data.nome}` : ""}.</p>
    <p>Sua manifestação de protocolo <strong>${data.protocolo}</strong> recebeu uma resposta:</p>
    <p>${String(data.resposta).replace(/\n/g, "<br>")}</p>
    <p>Atenciosamente,<br>Ouvidoria Escolar</p>
  `;
  await sendBrevoEmail(env, {
    toEmail: data.email,
    toName: data.nome || "",
    subject: `Resposta da Ouvidoria - ${data.protocolo}`,
    htmlContent: html,
    textContent: `Sua manifestação ${data.protocolo} recebeu uma resposta:\n\n${data.resposta}`
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return text("ok");
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") return json({ ok: true, service: "ouvidoria-ceti-cloudflare", time: nowISO() });

      if (path === "/api/admin/login" && request.method === "POST") {
        const body = await readJson(request);
        const email = sanitizeText(body.email, 200).toLowerCase();
        const password = String(body.password || "");
        if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return json({ message: "ADMIN_EMAIL e ADMIN_PASSWORD ainda não foram configurados no Worker." }, 500);
        if (email !== String(env.ADMIN_EMAIL).toLowerCase() || password !== String(env.ADMIN_PASSWORD)) {
          return json({ message: "E-mail ou senha incorretos." }, 401);
        }
        const token = await createToken(email, env);
        return json({ token });
      }

      if (path === "/api/manifestacoes" && request.method === "POST") {
        const body = await readJson(request);
        const identificado = Boolean(body.identificado);
        const nome = identificado ? sanitizeText(body.nome, 180) : "";
        const turma = identificado ? sanitizeText(body.turma, 80) : "";
        const email = sanitizeText(body.email, 180).toLowerCase();
        const tipo = sanitizeText(body.tipo, 60);
        const assunto = sanitizeText(body.assunto, 180);
        const descricao = sanitizeText(body.descricao, 2000);
        const prioridade = sanitizeText(body.prioridade, 40);
        if (email && !isEmail(email)) return json({ message: "E-mail inválido." }, 400);
        if (identificado && !nome) return json({ message: "Informe o nome." }, 400);
        if (identificado && !turma) return json({ message: "Informe a turma." }, 400);
        if (!tipo || !assunto || !descricao || !prioridade) return json({ message: "Preencha todos os campos obrigatórios." }, 400);
        let protocolo = generateProtocol();
        for (let i = 0; i < 3; i++) {
          const exists = await env.DB.prepare("SELECT protocolo FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
          if (!exists) break;
          protocolo = generateProtocol();
        }
        const data = { protocolo, identificado, nome, turma, email, tipo, assunto, descricao, prioridade, status: "Recebida" };
        await env.DB.prepare(`
          INSERT INTO manifestacoes
          (protocolo, identificado, nome, turma, email, tipo, assunto, descricao, prioridade, status, resposta, observacao_interna, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebida', '', '', ?, ?)
        `).bind(protocolo, identificado ? 1 : 0, nome, turma, email, tipo, assunto, descricao, prioridade, nowISO(), nowISO()).run();
        await notifyNewManifestation(env, data);
        if (email) {
          await sendBrevoEmail(env, {
            toEmail: email,
            toName: nome,
            subject: `Manifestação recebida - ${protocolo}`,
            htmlContent: `<h2>Manifestação recebida</h2><p>Seu protocolo é <strong>${protocolo}</strong>.</p><p>Guarde este código para acompanhar sua manifestação.</p>`,
            textContent: `Manifestação recebida. Seu protocolo é ${protocolo}.`
          });
        }
        return json({ ok: true, protocolo }, 201);
      }

      const publicManifestationMatch = path.match(/^\/api\/manifestacoes\/([^/]+)$/);
      if (publicManifestationMatch && request.method === "GET") {
        const protocolo = normalizeProtocol(decodeURIComponent(publicManifestationMatch[1]));
        const row = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Protocolo não encontrado." }, 404);
        const { results: mensagens } = await env.DB.prepare("SELECT id, autor, mensagem, criado_em FROM mensagens WHERE protocolo = ? ORDER BY criado_em ASC").bind(protocolo).all();
        return json({ manifestacao: publicManifestation(row), mensagens: mensagens || [] });
      }

      const messageMatch = path.match(/^\/api\/manifestacoes\/([^/]+)\/mensagens$/);
      if (messageMatch && request.method === "POST") {
        const protocolo = normalizeProtocol(decodeURIComponent(messageMatch[1]));
        const row = await env.DB.prepare("SELECT protocolo FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Protocolo não encontrado." }, 404);
        const body = await readJson(request);
        const mensagem = sanitizeText(body.mensagem, 1000);
        if (!mensagem) return json({ message: "Digite uma mensagem." }, 400);
        const t = nowISO();
        await env.DB.prepare("INSERT INTO mensagens (protocolo, autor, mensagem, criado_em) VALUES (?, 'aluno', ?, ?)").bind(protocolo, mensagem, t).run();
        await env.DB.prepare("UPDATE manifestacoes SET atualizado_em = ? WHERE protocolo = ?").bind(t, protocolo).run();
        return json({ ok: true }, 201);
      }

      if (path === "/api/admin/manifestacoes" && request.method === "GET") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const { results } = await env.DB.prepare("SELECT * FROM manifestacoes ORDER BY criado_em DESC").all();
        return json({ manifestacoes: (results || []).map(adminManifestation) });
      }

      const adminOneMatch = path.match(/^\/api\/admin\/manifestacoes\/([^/]+)$/);
      if (adminOneMatch && request.method === "GET") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const protocolo = normalizeProtocol(decodeURIComponent(adminOneMatch[1]));
        const row = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!row) return json({ message: "Manifestação não encontrada." }, 404);
        const { results: mensagens } = await env.DB.prepare("SELECT id, autor, mensagem, criado_em FROM mensagens WHERE protocolo = ? ORDER BY criado_em ASC").bind(protocolo).all();
        return json({ manifestacao: adminManifestation(row), mensagens: mensagens || [] });
      }
      if (adminOneMatch && request.method === "PUT") {
        const authError = await requireAdmin(request, env); if (authError) return authError;
        const protocolo = normalizeProtocol(decodeURIComponent(adminOneMatch[1]));
        const current = await env.DB.prepare("SELECT * FROM manifestacoes WHERE protocolo = ?").bind(protocolo).first();
        if (!current) return json({ message: "Manifestação não encontrada." }, 404);
        const body = await readJson(request);
        const status = sanitizeText(body.status || current.status || "Recebida", 60);
        const resposta = sanitizeText(body.resposta, 1000);
        const observacaoInterna = sanitizeText(body.observacaoInterna, 500);
        const t = nowISO();
        const respostaMudou = resposta && resposta !== (current.resposta || "");
        await env.DB.prepare(`
          UPDATE manifestacoes
          SET status = ?, resposta = ?, observacao_interna = ?, atualizado_em = ?, respondido_em = CASE WHEN ? != '' THEN ? ELSE respondido_em END
          WHERE protocolo = ?
        `).bind(status, resposta, observacaoInterna, t, resposta, t, protocolo).run();
        if (respostaMudou) {
          await env.DB.prepare("INSERT INTO mensagens (protocolo, autor, mensagem, criado_em) VALUES (?, 'admin', ?, ?)").bind(protocolo, resposta, t).run();
          await notifyStudentAnswer(env, { ...current, protocolo, status, resposta });
        }
        return json({ ok: true });
      }

      return json({ message: "Rota não encontrada." }, 404);
    } catch (error) {
      console.error("Erro interno:", error);
      return json({ message: "Erro interno no servidor." }, 500);
    }
  }
};
