import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Connect, type Plugin } from 'vite'
import path from 'path'

// /docs is the static Swagger page in public/docs, not an app route (vercel.json does the same in production)
const docsRewrite: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/docs' || req.url === '/docs/') req.url = '/docs/index.html'
  next()
}

const apiDocs: Plugin = {
  name: 'api-docs',
  configureServer: (server) => void server.middlewares.use(docsRewrite),
  configurePreviewServer: (server) => void server.middlewares.use(docsRewrite),
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDocs],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
