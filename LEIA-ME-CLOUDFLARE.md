# Ouvidoria CETI - Versão Cloudflare + D1 + Brevo

Esta versão remove o Firebase do front-end e deixa o sistema pronto para usar:

- Cloudflare Pages para hospedar o site
- Cloudflare Worker para API
- Cloudflare D1 como banco de dados
- Brevo para enviar e-mails

## Arquivos principais alterados

- `assets/js/manifestacao.js`
- `assets/js/acompanhar.js`
- `assets/js/admin.js`
- `assets/js/acessoadministrativo.js`
- `assets/js/api.js`
- `pages/manifestacao.html`
- `pages/acessoadministrativo.html`
- `worker.js`
- `schema.sql`
- `wrangler.toml`

## Variáveis obrigatórias no Worker

Configure no painel da Cloudflare:

- `ADMIN_EMAIL`: e-mail usado para entrar no painel admin
- `ADMIN_PASSWORD`: senha do painel admin
- `ADMIN_TOKEN_SECRET`: segredo grande para assinar sessão

## Variáveis para e-mail Brevo

- `BREVO_API_KEY`: chave API da Brevo
- `OUVIDORIA_EMAIL`: e-mail que recebe novas manifestações
- `MAIL_FROM_EMAIL`: e-mail remetente validado na Brevo
- `MAIL_FROM_NAME`: nome do remetente, exemplo `Ouvidoria CETI Amargosa`

## Teste da API

Depois do deploy do Worker, abra:

`https://SEU-WORKER.workers.dev/api/health`

Deve retornar um JSON com `ok: true`.

## Observação importante

Se o site e a API ficarem em domínios diferentes, adicione no `index.html` e nas páginas, antes dos scripts JS:

```html
<script>
  window.OUVIDORIA_API_URL = "https://SEU-WORKER.workers.dev";
</script>
```

Se você configurar o Worker como rota do mesmo domínio do Pages, não precisa disso.
