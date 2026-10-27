import { createClient } from '@supabase/supabase-js'
import { getPublicConfig } from './config'

const config = getPublicConfig()
export const supabase = config ? createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export const configurationMessage = 'Koneksi Supabase belum dikonfigurasi. Salin .env.example menjadi .env.local, lalu isi URL proyek dan publishable/anon key.'
