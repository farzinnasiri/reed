# Reed Control Panel

Local-only admin web app for Reed operator tasks.

## Run

From the repo root:

```sh
make control-panel
```

This loads `.env.dev` and passes `EXPO_PUBLIC_CONVEX_URL` to Vite as `VITE_CONVEX_URL`.

To point at production:

```sh
make control-panel ENV=prod
```

`make run control-panel` also works if you prefer that command shape.

## Secrets

Do not put `REED_CONTROL_PANEL_SECRET` in frontend env. Paste it into the UI when the page opens. The app keeps it in memory for the current browser session only.
