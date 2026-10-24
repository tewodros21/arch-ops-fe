# ArchOps frontend

Purchase approval, vendor and site labor app for architecture firms, by Ethix. React 19, TypeScript, Vite, Tailwind 4.
The backend is a Django REST API built to the contract in `public/docs/openapi.yaml`.

## Run it

```bash
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL to the Django API, e.g. http://localhost:8000/api/v1
npm run dev                  # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type check and production build into `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve the production build |

## API

- Contract: `public/docs/openapi.yaml`, browsable as Swagger UI at `/docs` (https://arc-crm-fe.vercel.app/docs).
- Client: `src/api/` (`django.ts` has one function per endpoint; `http.ts` handles JWT, refresh, pagination and errors).
- Screens call `src/services/*` only, never `fetch` directly.

## Layout

```
src/
  api/         REST client and the Backend contract
  services/    what screens call (requests, labor, vendors, admin, audit, account)
  pages/       one folder per route
  components/  layout, ui kit, dashboard, modals
  context/     AuthContext (session and profile)
  lib/         workflow actions, file upload rules, toasts
  types/       domain types shared with the API
```

Deployed on Vercel; `vercel.json` serves the SPA and the `/docs` page.
