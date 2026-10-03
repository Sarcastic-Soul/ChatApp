# Deployment

[Back to the README](../README.md)

Everything deploys from `main`.

## Frontend (Vercel)

- **Root directory:** `frontend`
- **Routing:** `vercel.json` forwards `/api/*` to the Render backend and sends every other path to `index.html`
- **Variables:** set `VITE_API_URL` to the Render URL

## Backend (Render)

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Node version | 22.18 or later (it runs the `.ts` files directly) |
| Build command | `corepack enable && pnpm install --frozen-lockfile` |
| Start command | `pnpm start` |
| Auto-deploy | Off |
| Variables | The required ones from [Environment variables](development.md#environment-variables) |

## CI and backend deploys (GitHub Actions)

- `.github/workflows/ci.yml` runs on every push.
- It calls the Render deploy hook when both of these are true on `main`:
  - the backend and end-to-end tests pass
  - the push changed something in `backend/`
- The hook URL is stored in the `RENDER_DEPLOY_HOOK_URL` repository secret.
- Running the workflow by hand from the Actions tab always deploys.

## Keep-alive (GitHub Actions)

- `.github/workflows/keep-alive.yml` calls `/healthz` every 10 minutes so the free Render instance doesn't fall asleep.
- GitHub may start scheduled runs a few minutes late.
- GitHub turns scheduled workflows off after 60 days without commits; turn it back on from the Actions tab.
- It can also be run by hand from there.
