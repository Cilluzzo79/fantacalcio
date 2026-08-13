# Fantacalcio App (fondamenta — Piano 2a)

Expo + TypeScript. Dominio puro in `src/domain/` (prezzi per lega, asta, live),
servizi in `src/services/`, store Zustand persistiti in `src/store/`.

## Comandi

- `npm test -- --watchAll=false` — test Jest (40 test, 8 suite)
- `npm run typecheck` — TypeScript strict
- `npx expo start` — dev server (app Expo Go sul telefono)
- `npx expo export --platform android` — verifica bundle

## Dati

Il dataset arriva da https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json
(cache locale in documentDirectory/dataset.json; refresh all'avvio, best-effort).

La UI completa (5 schermate con design) è il Piano 2b.
