CREATE TABLE IF NOT EXISTS debates (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  principles TEXT NOT NULL DEFAULT '',
  synthesizer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  deepseek_config TEXT NOT NULL DEFAULT '{"mode":"fast","deepThink":false,"smartSearch":false}',
  claude_config TEXT NOT NULL DEFAULT '{"model":"sonnet-4-6"}'
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id TEXT NOT NULL,
  phase INTEGER NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (debate_id) REFERENCES debates(id)
);

CREATE TABLE IF NOT EXISTS summaries (
  debate_id TEXT PRIMARY KEY,
  comparison TEXT NOT NULL,
  final_proposal TEXT NOT NULL,
  dissent TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (debate_id) REFERENCES debates(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_debate ON messages(debate_id);
