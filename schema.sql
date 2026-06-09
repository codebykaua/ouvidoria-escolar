CREATE TABLE IF NOT EXISTS manifestacoes (
  protocolo TEXT PRIMARY KEY,
  identificado INTEGER NOT NULL DEFAULT 0,
  nome TEXT DEFAULT '',
  turma TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tipo TEXT NOT NULL,
  assunto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recebida',
  resposta TEXT DEFAULT '',
  observacao_interna TEXT DEFAULT '',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  respondido_em TEXT
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT 'aluno',
  mensagem TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  FOREIGN KEY (protocolo) REFERENCES manifestacoes(protocolo) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_manifestacoes_criado_em ON manifestacoes(criado_em);
CREATE INDEX IF NOT EXISTS idx_manifestacoes_status ON manifestacoes(status);
CREATE INDEX IF NOT EXISTS idx_mensagens_protocolo ON mensagens(protocolo);
