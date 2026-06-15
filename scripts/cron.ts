/**
 * Cron diario: sincroniza desde football-data.org y recalcula predicciones.
 * Ejecutar: npm run cron
 * En Vercel: invocado desde app/api/cron/route.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
// Carga .env.local (Next.js no lo inyecta cuando se ejecuta tsx directo)
config({ path: resolve(process.cwd(), ".env.local") });

import { syncFromFootballData } from "../lib/sync";

async function run() {
  console.log("[cron] Iniciando —", new Date().toISOString());

  const { teams, fixtures, predictions } = await syncFromFootballData();

  console.log(`[cron] Equipos: ${teams} | Fixtures: ${fixtures} | Predicciones: ${predictions}`);
  console.log("[cron] Completo —", new Date().toISOString());
}

run().catch(console.error);
