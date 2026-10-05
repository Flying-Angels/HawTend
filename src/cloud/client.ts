import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export interface CloudConfiguration {
  url: string
  publishableKey: string
}

export function readCloudConfiguration(): CloudConfiguration | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url && !publishableKey) return null
  if (!url || !publishableKey || !publishableKey.startsWith('sb_publishable_')) {
    throw new Error('云端配置不完整，请由项目维护者检查。')
  }
  if (new URL(url).protocol !== 'https:') throw new Error('云端连接需要 HTTPS。')
  return { url, publishableKey }
}

// The UI does not call this yet: project access is separate from app login and sync rollout.
export function createCloudClient(configuration: CloudConfiguration) {
  return createClient<Database>(configuration.url, configuration.publishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export type CloudClient = ReturnType<typeof createCloudClient>
