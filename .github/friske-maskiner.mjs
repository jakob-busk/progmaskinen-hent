// Testen på friske maskiner (workflowen friske-maskiner.yml kører den på Windows og Mac). Kun node:-moduler.
//
//   node .github/friske-maskiner.mjs installer     installerer VERSION med guidens kommando (Windows: npx.cmd i PowerShell
//                                                  med standard-ExecutionPolicy), og installeren herfra (ikke fra npm)
//   node .github/friske-maskiner.mjs installation  tjekker, at installationen er komplet (manifest, skills, ASCII-mappenavne)
//   node .github/friske-maskiner.mjs onboarding    onboarding-siden svarer (uden browser)
//   node .github/friske-maskiner.mjs ovelse        lægger en Øvelse klar og tjekker den med den medfølgende tjek-kommando
//   node .github/friske-maskiner.mjs opdatering    installerer FORRIGE, laver elevdata og egne filer, opdaterer til VERSION
//                                                  og viser med sha256-fingeraftryk, at intet af det er ændret (ADR 0006)
//
// Miljø: VERSION (påkrævet), FORRIGE (tom: opdateringen springes over), GH_TOKEN (kun for at undgå GitHubs grænse for
// opslag), HENT_REPO (standard jakob-busk/progmaskinen-hent), GITHUB_API_URL, ARBEJDSMAPPE (standard RUNNER_TEMP).
// Installeren og opdateringen får udgivelseslisten fra en lille lokal server, der kun indeholder den ene udgivelse,
// så det er præcis den version, der installeres. Filerne hentes fra GitHub som hos den studerende.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const WIN = process.platform === 'win32';
const INSTALLER = resolve(import.meta.dirname, '..');
const VERSION = process.env.VERSION;
const FORRIGE = process.env.FORRIGE?.trim() || '';
const REPO = process.env.HENT_REPO || 'jakob-busk/progmaskinen-hent';
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const ARBEJD = resolve(process.env.ARBEJDSMAPPE || process.env.RUNNER_TEMP || tmpdir(), 'friske-maskiner');
const HJEM = (WIN ? process.env.USERPROFILE : process.env.HOME) || homedir();
const INSTALLERET = join(HJEM, 'Documents', 'Progmaskinen');
const SKILLS = ['videre', 'emne', 'overblik', 'opdater'];

class Fejl extends Error {}
const fejl = (tekst) => {
  throw new Fejl(tekst);
};
const sikr = (betingelse, tekst) => betingelse || fejl(tekst);
const log = (tekst) => console.log(`· ${tekst}`);
const sha256 = (sti) => createHash('sha256').update(readFileSync(sti)).digest('hex');

// ---------- udgivelser ----------

async function udgivelse(version) {
  const svar = await fetch(`${API}/repos/${REPO}/releases/tags/v${version}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'progmaskinen-friske-maskiner', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
  });
  sikr(svar.ok, `Udgivelsen v${version} findes ikke i ${REPO} (GitHub svarede ${svar.status}).`);
  return svar.json();
}

/** En lokal udgivelsesliste med kun den ene udgivelse. Returnerer { url, luk }. */
async function listeMed(version) {
  const liste = JSON.stringify([await udgivelse(version)]);
  const server = createServer((_, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(liste));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}/`, luk: () => new Promise((ok) => server.close(ok)) };
}

// ---------- kørsel af programmer ----------

/** Kører et program asynkront (den lokale server skal kunne svare imens). Returnerer { kode, ud }. */
function koer(kommando, args, valg = {}) {
  return new Promise((ok) => {
    const barn = spawn(kommando, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...valg });
    let ud = '';
    barn.stdout.on('data', (d) => ((ud += d), process.stdout.write(d)));
    barn.stderr.on('data', (d) => ((ud += d), process.stderr.write(d)));
    barn.on('error', (f) => ok({ kode: -1, ud: `${ud}\n${f.message}` }));
    barn.on('close', (kode) => ok({ kode, ud }));
  });
}

const npm = (args, cwd) => koer(WIN ? 'npm.cmd' : 'npm', args, { cwd, shell: WIN });
const node = (mappe, script, args = [], env = {}) => koer(process.execPath, [join('scripts', script), ...args], { cwd: mappe, env: { ...process.env, ...env } });

/** Fælles miljø for installer og opdatering: ingen browser, og forhåndsudgivelser tæller (versionen er skjult under testen). */
const miljoe = (url, pidfil) => ({ ...process.env, PROGMASKINEN_UDGIVELSER_URL: url, PROGMASKINEN_PRERELEASE: '1', PROGMASKINEN_INGEN_BROWSER: '1', PROGMASKINEN_INSTALLER_PID_FIL: pidfil });

function stopOnboarding(pidfil) {
  if (!existsSync(pidfil)) return;
  try {
    process.kill(Number(readFileSync(pidfil, 'utf8')));
  } catch {
    /* allerede lukket */
  }
  rmSync(pidfil, { force: true });
}

// ---------- tjek af en installation ----------

/** Alle poster under mappen (relativt, med '/'), uden at følge genveje. */
function poster(mappe, rel = '') {
  const ud = [];
  for (const navn of readdirSync(join(mappe, rel))) {
    const r = rel ? `${rel}/${navn}` : navn;
    const info = lstatSync(join(mappe, r));
    ud.push({ sti: r, navn, info });
    if (info.isDirectory()) ud.push(...poster(mappe, r));
  }
  return ud;
}

function tjekKomplet(mappe, version) {
  sikr(existsSync(join(mappe, 'version.json')), `${mappe} har ingen version.json. Ligger Progmaskinen i en ekstra ydre mappe?`);
  sikr(!existsSync(join(mappe, 'Progmaskinen')), `Der ligger en ekstra mappe Progmaskinen inde i ${mappe}.`);
  const installeret = JSON.parse(readFileSync(join(mappe, 'version.json'), 'utf8')).version;
  sikr(installeret === version, `Installeret version er ${installeret}, ikke ${version}.`);
  const { filer } = JSON.parse(readFileSync(join(mappe, 'manifest.json'), 'utf8'));
  for (const [fil, sum] of Object.entries(filer)) {
    const sti = join(mappe, ...fil.split('/'));
    sikr(lstatSync(sti, { throwIfNoEntry: false })?.isFile() && sha256(sti) === sum, `${fil} mangler eller passer ikke med manifestet.`);
  }
  log(`alle ${Object.keys(filer).length} filer i manifestet er på plads og passer`);
  for (const skill of SKILLS) {
    const fil = join(mappe, '.claude', 'skills', skill, 'SKILL.md');
    sikr(existsSync(fil), `.claude/skills/${skill}/SKILL.md mangler.`);
    sikr(new RegExp(`^---[\\s\\S]*?\\nname: ${skill}\\n`).test(readFileSync(fil, 'utf8')), `.claude/skills/${skill}/SKILL.md har ikke name: ${skill}.`);
  }
  sikr(existsSync(join(mappe, '.claude', 'settings.json')), '.claude/settings.json mangler.');
  log(`skills: ${SKILLS.map((s) => `/${s}`).join(', ')} og .claude/settings.json findes`);
  const alle = poster(mappe);
  const genvej = alle.find((p) => p.info.isSymbolicLink());
  sikr(!genvej, `Installationen indeholder en genvej: ${genvej?.sti}`);
  const ikkeAscii = alle.filter((p) => p.info.isDirectory() && /[^\x20-\x7e]/.test(p.navn)).map((p) => p.sti);
  sikr(ikkeAscii.length === 0, `Mappenavne med andet end ASCII: ${ikkeAscii.slice(0, 5).join(', ')}`);
  log('ingen genveje, og alle mappenavne er ASCII');
}

// ---------- trinene ----------

async function installer() {
  sikr(!existsSync(INSTALLERET), `${INSTALLERET} findes allerede; maskinen er ikke frisk.`);
  const kaldested = join(ARBEJD, 'kaldested');
  rmSync(kaldested, { recursive: true, force: true });
  mkdirSync(kaldested, { recursive: true });
  // Installeren herfra (progmaskinen-hent), ikke fra npm: den pakkes og lægges, så guidens kommando finder den.
  sikr((await npm(['pack', INSTALLER, '--pack-destination', kaldested, '--silent'], kaldested)).kode === 0, 'npm pack af installeren fejlede.');
  const tgz = readdirSync(kaldested).find((f) => f.endsWith('.tgz'));
  writeFileSync(join(kaldested, 'package.json'), '{ "private": true }\n');
  sikr((await npm(['install', '--no-audit', '--no-fund', `./${tgz}`], kaldested)).kode === 0, 'npm install af installeren fejlede.');

  const pidfil = join(ARBEJD, 'onboarding-frisk.pid');
  const liste = await listeMed(VERSION);
  let svar;
  try {
    if (WIN) {
      // Guidens kommando i Windows PowerShell med Windows' standard-ExecutionPolicy (Restricted), som spærrer npm's .ps1-filer.
      const ps = (kommando) => koer('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Restricted', '-Command', kommando], { cwd: kaldested, env: miljoe(liste.url, pidfil) });
      const politik = await ps('Get-ExecutionPolicy');
      sikr(politik.ud.trim() === 'Restricted', `ExecutionPolicy er "${politik.ud.trim()}", ikke Restricted.`);
      const npx = await ps('(Get-Command npx).Source');
      if (/\.ps1\s*$/i.test(npx.ud)) {
        const spaerret = await ps('npx --version');
        sikr(spaerret.kode !== 0, 'npx.ps1 burde være spærret under Restricted; testen beviser ellers ikke, at npx.cmd er nødvendig.');
        log('bekræftet: "npx" (npx.ps1) er spærret under Restricted');
      }
      log('kører guidens kommando i PowerShell: npx.cmd progmaskinen');
      svar = await ps('npx.cmd progmaskinen; exit $LASTEXITCODE');
    } else {
      log('kører guidens kommando: npx progmaskinen');
      svar = await koer('npx', ['progmaskinen'], { cwd: kaldested, env: miljoe(liste.url, pidfil) });
    }
  } finally {
    await liste.luk();
  }
  sikr(svar.kode === 0, `Installeren stoppede med kode ${svar.kode}.`);
  sikr(svar.ud.includes(`Progmaskinen ${VERSION} ligger nu i`), `Installeren sagde ikke, at Progmaskinen ${VERSION} er installeret.`);
  sikr(/localhost:\d+/.test(svar.ud), 'Installeren startede ikke onboarding-siden.');
}

function installation() {
  tjekKomplet(INSTALLERET, VERSION);
}

async function onboarding() {
  const serverfil = join(INSTALLERET, 'elev', 'onboarding-server.json');
  sikr(existsSync(serverfil), 'Onboarding-serveren kører ikke (elev/onboarding-server.json mangler).');
  const { port } = JSON.parse(readFileSync(serverfil, 'utf8'));
  const side = await fetch(`http://localhost:${port}/`);
  const html = await side.text();
  sikr(side.ok && /Progmaskinen/.test(html), `Onboarding-siden svarede ${side.status}.`);
  log(`onboarding-siden svarer på http://localhost:${port}/ (uden browser)`);
  stopOnboarding(join(ARBEJD, 'onboarding-frisk.pid'));
}

async function lavOevelseKlar(mappe) {
  for (let i = 0; i < 3 && !existsSync(join(mappe, 'elev', 'opgaver')); i++) sikr((await node(mappe, 'naeste.mjs')).kode === 0, '/videre (scripts/naeste.mjs) fejlede.');
  const [oevelse] = existsSync(join(mappe, 'elev', 'opgaver')) ? readdirSync(join(mappe, 'elev', 'opgaver')) : [];
  sikr(oevelse, '/videre lagde ingen Øvelse klar i elev/opgaver.');
  return oevelse;
}

async function ovelse() {
  const oevelse = await lavOevelseKlar(INSTALLERET);
  log(`Øvelsen ${oevelse} er lagt klar`);
  const loesning = join(INSTALLERET, 'elev', 'opgaver', oevelse, 'loesning.js');
  writeFileSync(loesning, `${readFileSync(loesning, 'utf8')}\n// et første forsøg\nconsole.log('hej');\n`);
  const tjek = await node(INSTALLERET, 'tjek.mjs');
  sikr(tjek.kode === 0 && /bestået/i.test(tjek.ud), 'Tjekket af Øvelsen gav ikke et svar.');
  sikr(/"type":"forsøg"/.test(readFileSync(join(INSTALLERET, 'elev', 'log.jsonl'), 'utf8')), 'Tjekket blev ikke logget i elev/log.jsonl.');
  log('tjekket kørte og blev logget');
}

/** sha256 af hver fil i elev/ og af de egne filer. */
function fingeraftryk(mappe, egne) {
  const aftryk = {};
  for (const p of poster(join(mappe, 'elev'))) if (p.info.isFile()) aftryk[`elev/${p.sti}`] = sha256(join(mappe, 'elev', ...p.sti.split('/')));
  for (const fil of egne) aftryk[fil] = sha256(join(mappe, ...fil.split('/')));
  return aftryk;
}

async function opdatering() {
  if (!FORRIGE) {
    log('ingen tidligere udgivelse at opdatere fra; springes over');
    return;
  }
  const mappe = join(ARBEJD, 'opdatering', 'Progmaskinen');
  rmSync(join(ARBEJD, 'opdatering'), { recursive: true, force: true });
  const pidfil = join(ARBEJD, 'onboarding-forrige.pid');
  let liste = await listeMed(FORRIGE);
  let svar;
  try {
    log(`installerer den forrige version ${FORRIGE}`);
    svar = await koer(process.execPath, [join(INSTALLER, 'bin', 'progmaskinen.mjs'), '--mappe', mappe], { env: miljoe(liste.url, pidfil) });
  } finally {
    await liste.luk();
    stopOnboarding(pidfil);
  }
  sikr(svar.kode === 0, `Den forrige version ${FORRIGE} kunne ikke installeres.`);

  // En rig elevtilstand: gennemgang, en udleveret Øvelse med kode, et tjek og et Hint, plus egne filer.
  const oevelse = await lavOevelseKlar(mappe);
  writeFileSync(join(mappe, 'elev', 'opgaver', oevelse, 'loesning.js'), "// min kode\nfunction hej() {\n  return 'hej';\n}\nconsole.log(hej());\n");
  await node(mappe, 'tjek.mjs');
  await node(mappe, 'hint.mjs');
  await node(mappe, 'naeste.mjs');
  const egne = {
    '.claude/settings.local.json': '{ "permissions": { "allow": ["Bash(ls:*)"] } }\n',
    '.claude/skills/min-egen/SKILL.md': '---\nname: min-egen\ndescription: Min egen skill.\n---\nHej.\n',
    '.vscode/mine.json': '{ "editor.fontSize": 16 }\n',
    'elev/mine-noter.md': '# Noter\nFunktioner returnerer.\n',
    'elev/noter-æøå.txt': 'Æbler og øl på Åen.\n',
    'elev/opgaver/egen-mappe/egen.js': 'console.log(1);\n',
    'mine-filer/eksamen.js': 'let x = 1;\n',
  };
  const { filer: produktfiler } = JSON.parse(readFileSync(join(mappe, 'manifest.json'), 'utf8'));
  for (const [fil, indhold] of Object.entries(egne)) {
    sikr(!produktfiler[fil], `${fil} er en af produktets egne filer, ikke en egen fil; vælg et andet navn i testen.`);
    mkdirSync(join(mappe, ...fil.split('/').slice(0, -1)), { recursive: true });
    writeFileSync(join(mappe, ...fil.split('/')), indhold);
  }
  const egneUdenforElev = Object.keys(egne).filter((f) => !f.startsWith('elev/'));
  const foer = fingeraftryk(mappe, egneUdenforElev);
  log(`fingeraftryk af ${Object.keys(foer).length} filer i elev/ og egne filer`);

  liste = await listeMed(VERSION);
  try {
    log(`opdaterer ${FORRIGE} til ${VERSION} med programmets egen opdatering (scripts/opdater.mjs)`);
    svar = await koer(process.execPath, [join('scripts', 'opdater.mjs')], { cwd: mappe, env: miljoe(liste.url, pidfil) });
  } finally {
    await liste.luk();
  }
  sikr(svar.kode === 0, `Opdateringen fra ${FORRIGE} til ${VERSION} fejlede.`);
  const efter = fingeraftryk(mappe, egneUdenforElev);
  const aendret = [...new Set([...Object.keys(foer), ...Object.keys(efter)])].filter((f) => foer[f] !== efter[f]);
  sikr(aendret.length === 0, `Opdateringen ændrede elevdata eller egne filer: ${aendret.join(', ')}`);
  log(`alle ${Object.keys(foer).length} fingeraftryk er uændrede efter opdateringen`);
  tjekKomplet(mappe, VERSION);
}

const TRIN = { installer, installation, onboarding, ovelse, opdatering };
const trin = process.argv[2];
try {
  sikr(TRIN[trin], `Ukendt trin "${trin}". Brug: ${Object.keys(TRIN).join(', ')}.`);
  sikr(VERSION, 'VERSION mangler.');
  mkdirSync(ARBEJD, { recursive: true });
  await TRIN[trin]();
  console.log(`OK: ${trin}`);
} catch (f) {
  console.error(`FEJL i ${trin}: ${f instanceof Fejl ? f.message : f.stack}`);
  process.exitCode = 1;
}
