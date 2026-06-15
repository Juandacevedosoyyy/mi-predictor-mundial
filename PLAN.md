PLAN.md — Mundial 2026 IA Predictor
Plan de implementación por fases. Objetivo: app en Next.js que recalcula a diario y proyecta todos los mercados estadísticos por partido, lista para grabar contenido.
Fases
Fase 0 — Setup

create-next-app con TS, Tailwind, App Router.
shadcn/ui init, Recharts, better-sqlite3, vitest.

Fase 1 — Ingesta y DB

Schema SQLite: teams, players, fixtures, match_events, match_stats, predictions.
Cliente de API-Football con retry y cache.

Fase 2 — Modelo de predicción

lib/model/poisson.ts: goles esperados, matriz de marcadores.
Derivar: 1X2, over/under, BTTS, marcador exacto, tarjetas, corners, goleadores.

Fase 3 — Cron diario

scripts/cron.ts: trae resultados, recalcula predicciones.

Fase 4 — Dashboard

Home: proyección campeón + Bota de Oro.
Vista grupo: tabla proyectada.
Vista partido: todos los mercados en cards visuales.

Fase 5 — Deploy

Deploy a Vercel con Cron activo.
Banner: "Análisis estadístico de entretenimiento. No es asesoría de apuestas."
