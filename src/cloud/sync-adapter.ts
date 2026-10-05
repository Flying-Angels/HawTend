import type { Journal } from '../model'
import type { CloudClient } from './client'
import type { Json } from './database.types'
import { assertJournal } from './journal-validation'

export interface RemoteSnapshot {
  journal: Journal
  version: number
  updatedAt: string
}

export type SaveSnapshotResult =
  | { kind: 'saved'; snapshot: RemoteSnapshot }
  | { kind: 'conflict'; snapshot: RemoteSnapshot | null }

async function signedInUser(client: CloudClient): Promise<string> {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('请先登录，再同步手账。')
  return data.session.user.id
}

function snapshot(row: { journal: Json | null; version: number; updated_at: string | null }): RemoteSnapshot {
  assertJournal(row.journal)
  if (!Number.isSafeInteger(row.version) || row.version < 1 || !row.updated_at) {
    throw new Error('云端版本信息不完整，已保留本地内容。')
  }
  return { journal: row.journal, version: row.version, updatedAt: row.updated_at }
}

export async function readCloudJournal(client: CloudClient): Promise<RemoteSnapshot | null> {
  const userId = await signedInUser(client)
  const { data, error } = await client.from('user_journals')
    .select('journal, version, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('读取云端手账失败，已保留本地内容。')
  return data ? snapshot(data) : null
}

// The caller must persist requestId with its pending operation before sending, and reuse it on retry.
// A conflict is returned intact; it never silently overwrites either device's local copy.
export async function saveCloudJournal(
  client: CloudClient,
  journal: Journal,
  expectedVersion: number,
  requestId: string,
): Promise<SaveSnapshotResult> {
  assertJournal(journal)
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error('同步版本无效。')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('同步操作标识无效。')
  }
  await signedInUser(client)
  const { data, error } = await client.rpc('save_journal', {
    p_journal: JSON.parse(JSON.stringify(journal)) as Json,
    p_expected_version: expectedVersion,
    p_request_id: requestId,
  })
  if (error) throw new Error('上传未完成，需保留待同步记录并重试。')
  const row = data?.[0]
  if (!row) throw new Error('云端未返回同步结果，需保留待同步记录。')
  if (row.status === 'saved') return { kind: 'saved', snapshot: snapshot(row) }
  if (row.status === 'conflict') {
    return { kind: 'conflict', snapshot: row.version === 0 ? null : snapshot(row) }
  }
  throw new Error('同步结果无法识别，已保留本地内容。')
}
