export interface PublicConfig {
  supabaseUrl: string
  supabaseKey: string
}

export function getPublicConfig(env: Pick<ImportMetaEnv, 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY'> = import.meta.env): PublicConfig | null {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) return null
  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null
  } catch {
    return null
  }
  return { supabaseUrl, supabaseKey }
}
