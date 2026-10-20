# Webapp deployment (Vercel)

- Production: https://halora-ten.vercel.app (demo mode: `NEXT_PUBLIC_HALORA_DATA_MODE` unset, so seeded data in the browser and no network writes).
- Vercel project `halora` (team "Jefferson's projects"), root directory `apps/webapp`, framework Next.js, install `bun install --frozen-lockfile`, build `bun run build` (webpack, see `next.config.ts`), Node 22, source files outside the root directory included (the webapp imports `@halora/shared` and `@halora/sdk`).
- `.vercelignore` keeps the Rust build output (about 2 GB under `apps/contracts/target`) and local tooling out of uploads.

## Deploy by hand

```bash
npx vercel deploy --prod --yes --scope jeffersons-projects-d679b89f
```

## Deploy on push

Install the Vercel GitHub app on the `haloralabs` organization (https://github.com/apps/vercel/installations/new), then run `npx vercel git connect https://github.com/haloralabs/halora`. Pushes to `main` then deploy to production and pull requests get preview URLs.
