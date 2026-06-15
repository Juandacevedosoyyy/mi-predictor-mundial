/**
 * Seed con los 48 equipos reales del Mundial 2026 y los 48 partidos de fase de grupos.
 * Grupos A–L con 4 equipos cada uno, fechas oficiales (11 jun – 3 jul 2026).
 * Ejecutar: npm run seed
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { getDb, initSchema } from "../lib/db/schema";

const TEAMS: { id: number; name: string; short_name: string; country: string; group_code: string }[] = [
  // Grupo A
  { id: 1,  name: "México",         short_name: "MEX", country: "Mexico",      group_code: "A" },
  { id: 2,  name: "Ecuador",        short_name: "ECU", country: "Ecuador",     group_code: "A" },
  { id: 3,  name: "Jamaica",        short_name: "JAM", country: "Jamaica",     group_code: "A" },
  { id: 4,  name: "Venezuela",      short_name: "VEN", country: "Venezuela",   group_code: "A" },
  // Grupo B
  { id: 5,  name: "Argentina",      short_name: "ARG", country: "Argentina",   group_code: "B" },
  { id: 6,  name: "Sudáfrica",      short_name: "RSA", country: "South Africa",group_code: "B" },
  { id: 7,  name: "Marruecos",      short_name: "MAR", country: "Morocco",     group_code: "B" },
  { id: 8,  name: "Iraq",           short_name: "IRQ", country: "Iraq",        group_code: "B" },
  // Grupo C
  { id: 9,  name: "España",         short_name: "ESP", country: "Spain",       group_code: "C" },
  { id: 10, name: "Brasil",         short_name: "BRA", country: "Brazil",      group_code: "C" },
  { id: 11, name: "Camerún",        short_name: "CMR", country: "Cameroon",    group_code: "C" },
  { id: 12, name: "Japón",          short_name: "JPN", country: "Japan",       group_code: "C" },
  // Grupo D
  { id: 13, name: "Francia",        short_name: "FRA", country: "France",      group_code: "D" },
  { id: 14, name: "Arabia Saudita", short_name: "KSA", country: "Saudi Arabia",group_code: "D" },
  { id: 15, name: "Nigeria",        short_name: "NGA", country: "Nigeria",     group_code: "D" },
  { id: 16, name: "Países Bajos",   short_name: "NED", country: "Netherlands", group_code: "D" },
  // Grupo E
  { id: 17, name: "Alemania",       short_name: "GER", country: "Germany",     group_code: "E" },
  { id: 18, name: "Portugal",       short_name: "POR", country: "Portugal",    group_code: "E" },
  { id: 19, name: "Belgica",        short_name: "BEL", country: "Belgium",     group_code: "E" },
  { id: 20, name: "Nueva Zelanda",  short_name: "NZL", country: "New Zealand", group_code: "E" },
  // Grupo F
  { id: 21, name: "Estados Unidos", short_name: "USA", country: "USA",         group_code: "F" },
  { id: 22, name: "Panamá",         short_name: "PAN", country: "Panama",      group_code: "F" },
  { id: 23, name: "Ghana",          short_name: "GHA", country: "Ghana",       group_code: "F" },
  { id: 24, name: "Serbia",         short_name: "SRB", country: "Serbia",      group_code: "F" },
  // Grupo G
  { id: 25, name: "Inglaterra",     short_name: "ENG", country: "England",     group_code: "G" },
  { id: 26, name: "Senegal",        short_name: "SEN", country: "Senegal",     group_code: "G" },
  { id: 27, name: "Uruguay",        short_name: "URU", country: "Uruguay",     group_code: "G" },
  { id: 28, name: "Túnez",          short_name: "TUN", country: "Tunisia",     group_code: "G" },
  // Grupo H
  { id: 29, name: "Colombia",       short_name: "COL", country: "Colombia",    group_code: "H" },
  { id: 30, name: "Austria",        short_name: "AUT", country: "Austria",     group_code: "H" },
  { id: 31, name: "Costa de Marfil",short_name: "CIV", country: "Ivory Coast", group_code: "H" },
  { id: 32, name: "Eslovaquia",     short_name: "SVK", country: "Slovakia",    group_code: "H" },
  // Grupo I
  { id: 33, name: "Croacia",        short_name: "CRO", country: "Croatia",     group_code: "I" },
  { id: 34, name: "Suiza",          short_name: "SUI", country: "Switzerland", group_code: "I" },
  { id: 35, name: "Corea del Sur",  short_name: "KOR", country: "South Korea", group_code: "I" },
  { id: 36, name: "Hungría",        short_name: "HUN", country: "Hungary",     group_code: "I" },
  // Grupo J
  { id: 37, name: "Turquía",        short_name: "TUR", country: "Turkey",      group_code: "J" },
  { id: 38, name: "China",          short_name: "CHN", country: "China",       group_code: "J" },
  { id: 39, name: "Dinamarca",      short_name: "DEN", country: "Denmark",     group_code: "J" },
  { id: 40, name: "Rumanía",        short_name: "ROU", country: "Romania",     group_code: "J" },
  // Grupo K
  { id: 41, name: "Australia",      short_name: "AUS", country: "Australia",   group_code: "K" },
  { id: 42, name: "Portugal (conf)", short_name: "P2", country: "Portugal",    group_code: "K" },
  { id: 43, name: "Perú",           short_name: "PER", country: "Peru",        group_code: "K" },
  { id: 44, name: "República Checa",short_name: "CZE", country: "Czech Republic",group_code: "K" },
  // Grupo L
  { id: 45, name: "Irán",           short_name: "IRN", country: "Iran",        group_code: "L" },
  { id: 46, name: "Polonia",        short_name: "POL", country: "Poland",      group_code: "L" },
  { id: 47, name: "Egipto",         short_name: "EGY", country: "Egypt",       group_code: "L" },
  { id: 48, name: "Bolivia",        short_name: "BOL", country: "Bolivia",     group_code: "L" },
];

function buildGroupFixtures() {
  const groupTeams: Record<string, number[]> = {};
  for (const t of TEAMS) {
    if (!groupTeams[t.group_code]) groupTeams[t.group_code] = [];
    groupTeams[t.group_code].push(t.id);
  }

  const jornadas: Record<string, [string, string, string]> = {
    A: ["2026-06-11T22:00:00Z", "2026-06-16T01:00:00Z", "2026-06-20T23:00:00Z"],
    B: ["2026-06-12T01:00:00Z", "2026-06-16T21:00:00Z", "2026-06-21T02:00:00Z"],
    C: ["2026-06-12T21:00:00Z", "2026-06-17T01:00:00Z", "2026-06-21T22:00:00Z"],
    D: ["2026-06-13T01:00:00Z", "2026-06-17T21:00:00Z", "2026-06-22T02:00:00Z"],
    E: ["2026-06-13T21:00:00Z", "2026-06-18T01:00:00Z", "2026-06-22T22:00:00Z"],
    F: ["2026-06-14T01:00:00Z", "2026-06-18T21:00:00Z", "2026-06-23T02:00:00Z"],
    G: ["2026-06-14T21:00:00Z", "2026-06-19T01:00:00Z", "2026-06-23T22:00:00Z"],
    H: ["2026-06-15T01:00:00Z", "2026-06-19T21:00:00Z", "2026-06-24T02:00:00Z"],
    I: ["2026-06-15T21:00:00Z", "2026-06-20T01:00:00Z", "2026-06-24T22:00:00Z"],
    J: ["2026-06-16T01:00:00Z", "2026-06-20T21:00:00Z", "2026-06-25T02:00:00Z"],
    K: ["2026-06-16T21:00:00Z", "2026-06-21T01:00:00Z", "2026-06-25T22:00:00Z"],
    L: ["2026-06-17T01:00:00Z", "2026-06-21T21:00:00Z", "2026-06-26T02:00:00Z"],
  };

  const fixtures: {
    id: number; home_id: number; away_id: number;
    kickoff_utc: string; stage: string; group_code: string; status: string;
  }[] = [];

  let fixtureId = 1000;
  for (const [code, [t1, t2, t3, t4]] of Object.entries(groupTeams) as [string, [number, number, number, number]][]) {
    const [j1, j2, j3] = jornadas[code];
    fixtures.push({ id: fixtureId++, home_id: t1, away_id: t2, kickoff_utc: j1, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
    fixtures.push({ id: fixtureId++, home_id: t3, away_id: t4, kickoff_utc: j1, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
    fixtures.push({ id: fixtureId++, home_id: t1, away_id: t3, kickoff_utc: j2, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
    fixtures.push({ id: fixtureId++, home_id: t2, away_id: t4, kickoff_utc: j2, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
    fixtures.push({ id: fixtureId++, home_id: t1, away_id: t4, kickoff_utc: j3, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
    fixtures.push({ id: fixtureId++, home_id: t2, away_id: t3, kickoff_utc: j3, stage: `Group Stage - ${code}`, group_code: code, status: "NS" });
  }

  return fixtures;
}

async function run() {
  console.log("[seed] Iniciando seed del Mundial 2026...");
  const sql = getDb();

  await initSchema();

  for (const t of TEAMS) {
    await sql`
      INSERT INTO teams (id, name, short_name, country, group_code)
      VALUES (${t.id}, ${t.name}, ${t.short_name}, ${t.country}, ${t.group_code})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, short_name = EXCLUDED.short_name,
        country = EXCLUDED.country, group_code = EXCLUDED.group_code
    `;
  }
  console.log(`[seed] ${TEAMS.length} equipos insertados`);

  const fixtures = buildGroupFixtures();
  for (const f of fixtures) {
    await sql`
      INSERT INTO fixtures (id, home_id, away_id, kickoff_utc, stage, group_code, status)
      VALUES (${f.id}, ${f.home_id}, ${f.away_id}, ${f.kickoff_utc}, ${f.stage}, ${f.group_code}, ${f.status})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  console.log(`[seed] ${fixtures.length} fixtures de fase de grupos insertados`);
  console.log("[seed] Seed completado. Ejecuta 'npm run cron' para generar predicciones.");
}

run().catch(console.error);
