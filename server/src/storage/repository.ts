import { db } from './db.js'
import type { ModelName } from '../browser/adapters/index.js'

export type DebateStatus = 'pending' | 'running' | 'done' | 'error'
// 5-phase iteration: 1=conceptual (no output); 2=各自方案; 3=匿名互评+排名;
// 4=作者修订; 5=综合; 6=终稿复核 (ratify/veto). The numbering keeps phase 1
// reserved for the conceptual "开题" so existing DB rows stay valid.
export type DebatePhase = 1 | 2 | 3 | 4 | 5 | 6

export interface DebateRow {
  id: string
  topic: string
  principles: string
  synthesizer: ModelName
  status: DebateStatus
  created_at: number
  completed_at: number | null
  deepseek_config: string
  claude_config: string
}

export interface DebateListRow {
  id: string
  topic: string
  synthesizer: ModelName
  status: DebateStatus
  created_at: number
  completed_at: number | null
}

export interface MessageRow {
  phase: DebatePhase
  model: ModelName
  content: string
  created_at: number
}

export interface SummaryRow {
  debate_id: string
  comparison: string
  final_proposal: string
  dissent: string
}

export const debates = {
  create(args: {
    id: string
    topic: string
    principles: string
    synthesizer: ModelName
    deepseekConfigJson: string
    claudeConfigJson: string
  }): void {
    db.prepare(
      'INSERT INTO debates (id, topic, principles, synthesizer, status, created_at, deepseek_config, claude_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(args.id, args.topic, args.principles, args.synthesizer, 'pending', Date.now(),
      args.deepseekConfigJson, args.claudeConfigJson)
  },

  setStatus(id: string, status: DebateStatus): void {
    db.prepare('UPDATE debates SET status = ? WHERE id = ?').run(status, id)
  },

  markDone(id: string): void {
    db.prepare("UPDATE debates SET status = 'done', completed_at = ? WHERE id = ?").run(Date.now(), id)
  },

  get(id: string): DebateRow | undefined {
    return db.prepare('SELECT * FROM debates WHERE id = ?').get(id) as DebateRow | undefined
  },

  getStatus(id: string): DebateStatus | undefined {
    const row = db.prepare('SELECT status FROM debates WHERE id = ?').get(id) as { status: DebateStatus } | undefined
    return row?.status
  },

  list(): DebateListRow[] {
    return db.prepare(
      'SELECT id, topic, synthesizer, status, created_at, completed_at FROM debates ORDER BY created_at DESC'
    ).all() as DebateListRow[]
  },

  delete(id: string): void {
    // Schema has no ON DELETE CASCADE — clean children first
    db.prepare('DELETE FROM messages WHERE debate_id = ?').run(id)
    db.prepare('DELETE FROM summaries WHERE debate_id = ?').run(id)
    db.prepare('DELETE FROM debates WHERE id = ?').run(id)
  },
}

export const messages = {
  insert(debateId: string, phase: DebatePhase, model: ModelName, content: string): void {
    db.prepare(
      'INSERT INTO messages (debate_id, phase, model, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(debateId, phase, model, content, Date.now())
  },

  listByDebate(debateId: string): MessageRow[] {
    return db.prepare(
      'SELECT phase, model, content, created_at FROM messages WHERE debate_id = ? ORDER BY id'
    ).all(debateId) as MessageRow[]
  },
}

export const summaries = {
  upsert(debateId: string, comparison: string, finalProposal: string, dissent: string = ''): void {
    db.prepare(
      'INSERT OR REPLACE INTO summaries (debate_id, comparison, final_proposal, dissent) VALUES (?, ?, ?, ?)'
    ).run(debateId, comparison, finalProposal, dissent)
  },

  get(debateId: string): SummaryRow | undefined {
    return db.prepare('SELECT * FROM summaries WHERE debate_id = ?').get(debateId) as SummaryRow | undefined
  },
}
