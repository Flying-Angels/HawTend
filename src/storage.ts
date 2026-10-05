import type { Journal } from './model'
import { emptyJournal, isUneditedSample } from './model'

// Keep the original database ID so the HawTend rename preserves existing local journals.
const DB = 'shiguang-prototype-v1'
const STORE = 'journal'
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
// Account IDs must come from authenticated sessions once Auth is connected.
// Account stores never inherit local or sample records.
const journalKey = (accountId?: string) => accountId ? `account:${accountId}:v1` : 'personal-local-v1'
export async function readJournal(accountId?: string): Promise<Journal | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const store = transaction.objectStore(STORE)
    const request = store.get(journalKey(accountId))
    request.onsuccess = () => {
      if (request.result || accountId) { db.close(); resolve(request.result); return }
      const legacy = store.get('current')
      legacy.onsuccess = () => {
        const previous = legacy.result as Journal | undefined
        db.close()
        resolve(previous && isUneditedSample(previous) ? emptyJournal(previous.theme) : previous)
      }
      legacy.onerror = () => { db.close(); reject(legacy.error) }
    }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}
export async function writeJournal(journal: Journal, accountId?: string): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(journal, journalKey(accountId))
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
    transaction.onabort = () => { db.close(); reject(transaction.error) }
  })
}
