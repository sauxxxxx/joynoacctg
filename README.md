# Joyno Accounting

Vue 3 application shell for the accounting system. This first slice contains the sidebar, topbar, navigation search, mobile drawer, and shared visual tokens. Feature pages and Supabase integration are the next slices.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Use `npm.cmd run build` to type-check and create a production build.

## Structure

- `src/navigation.ts` — menu hierarchy shared by the sidebar and topbar search.
- `src/components/` — shell components.
- `src/styles.css` — visual tokens and responsive shell styling.
- `src/App.vue` — selected section and shell layout.

The selected menu item currently updates the shell heading. It does not load a feature page yet; feature owners can add routes and page content as their modules are built.
