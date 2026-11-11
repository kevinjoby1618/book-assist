# Book Assist

Book Assist is a TanStack Start + React application using Supabase for authentication and data.

## Requirements

- Node.js (current LTS)
- npm
- A Supabase project with the app's database schema and authentication configured

## Environment variables

Create a local `.env` or `.env.local` file from `.env.example` and set:

- `VITE_SUPABASE_URL`: your Supabase project's Project URL (browser/client)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase publishable key (starts with `sb_publishable_`)

For server-side requests, also set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the same project URL and publishable key. Do not put a Supabase secret/service-role key in any `VITE_*` variable or expose it in client code.

In Vercel, add the same variables under **Project → Settings → Environment Variables** for Production, Preview, and Development as needed. Redeploy after changing environment variables.

## Development

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run build
```

The Vercel project should use the repository's production branch (`main`) and the project name `book-assist`. Ensure the Supabase project is initialized and required environment variables are set before expecting the deployed app to work.
