import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const configuredBase = process.env.VITE_PAGES_BASE_PATH?.trim()

export default defineConfig({
  plugins: [react()],
  base: configuredBase || (process.env.GITHUB_ACTIONS === 'true' && repoName ? `/${repoName}/` : '/'),
})
