import { describe, expect, it } from 'vitest'
import { getPublicConfig } from './config'

describe('getPublicConfig', () => {
  it('accepts the Supabase publishable key', () => {
    expect(getPublicConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    })).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseKey: 'sb_publishable_example',
    })
  })

  it('continues to accept the legacy anon key', () => {
    expect(getPublicConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
    })).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseKey: 'legacy-anon-key',
    })
  })

  it('prefers the publishable key when both keys are configured', () => {
    expect(getPublicConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
    })?.supabaseKey).toBe('sb_publishable_example')
  })
})
