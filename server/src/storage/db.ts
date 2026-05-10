// @ts-ignore — node:sqlite available in Node 22.5+
import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const DATA_DIR = join(homedir(), '.making-debate')
const DB_PATH = join(DATA_DIR, 'debate.db')

mkdirSync(DATA_DIR, { recursive: true })

const _db = new DatabaseSync(DB_PATH)
_db.exec('PRAGMA journal_mode = WAL')
_db.exec('PRAGMA foreign_keys = ON')

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql')
const schema = readFileSync(schemaPath, 'utf-8')
_db.exec(schema)

// Minimal wrapper matching the better-sqlite3 API used in the codebase
export const db = {
  prepare(sql: string) {
    const stmt = _db.prepare(sql)
    return {
      run(...params: unknown[]) {
        return stmt.run(...params)
      },
      get(...params: unknown[]) {
        return stmt.get(...params)
      },
      all(...params: unknown[]) {
        return stmt.all(...params)
      },
    }
  },
  exec(sql: string) {
    return _db.exec(sql)
  },
}
