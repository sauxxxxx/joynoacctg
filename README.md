# Joyno Accounting

Vue 3 frontend for the accounting system. The shared shell contains the sidebar, topbar, navigation search, mobile drawer, and visual tokens. Supabase integration is a later slice.

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

Menu selections update the URL, so a page can be linked and reloaded.

## Owner B frontend preview

Open **Accounting → Journal Entries → Purchase Journal**, or visit `/?page=purchase-journal`. This page uses labeled sample entries. Date filtering, search, review selection, and entry details work in the browser. **Move to CDJ** remains disabled until the transfer rules and data service are defined.
