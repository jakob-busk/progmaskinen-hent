// Installeren: henter den nyeste udgivelse af Progmaskinen fra GitHub, verificerer den og pakker den ud.
// Kun node:-moduler, ingen afhængigheder. Rører aldrig en eksisterende Progmaskinen-mappe (elev/ er den studerendes).

import { cpSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readdirSync, readFileSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';

export const UDGIVELSER = 'https://api.github.com/repos/jakob-busk/progmaskinen-hent/releases?per_page=30';
const MAPPENAVN = 'Progmaskinen';
const TMP_PRAEFIKS = '.progmaskinen-hent-';

class InstallationsFejl extends Error {}
const fejl = (tekst) => new InstallationsFejl(tekst);

// ---------- semver (en lille kopi af produktets kerne/semver.mjs; installeren har ingen afhængigheder) ----------
const TAL = '(0|[1-9]\\d*)';
const LED = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const SEMVER = new RegExp(`^${TAL}\\.${TAL}\\.${TAL}(?:-(${LED}(?:\\.${LED})*))?$`);
export const erSemver = (v) => typeof v === 'string' && SEMVER.test(v);
function dele(v) {
  const m = SEMVER.exec(v);
  return { tal: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4]?.split('.') ?? [] };
}
export function sammenlignSemver(a, b) {
  const [x, y] = [dele(a), dele(b)];
  for (let i = 0; i < 3; i++) if (x.tal[i] !== y.tal[i]) return x.tal[i] - y.tal[i];
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i], y.pre[i]];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const [pt, qt] = [/^\d+$/.test(p), /^\d+$/.test(q)];
    if (pt && qt) return Number(p) - Number(q);
    if (pt !== qt) return pt ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** Den højeste udgivelse (prereleases og kladder kun, hvis det udtrykkeligt bedes om). */
export function nyesteUdgivelse(liste, { prerelease = false } = {}) {
  if (!Array.isArray(liste)) return undefined;
  const version = (u) => u.tag_name?.replace(/^v/, '');
  return liste
    .filter((u) => !u.draft && erSemver(version(u)) && (prerelease || !u.prerelease))
    .sort((a, b) => sammenlignSemver(version(b), version(a)))[0];
}

export const nodeVersionOk = (v) => {
  const [major, minor] = v.split('.').map(Number);
  return major > 20 || (major === 20 && minor >= 11);
};

// ---------- hjælpere ----------
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function standardMappe(env = process.env, platform = process.platform) {
  const hjem = (platform === 'win32' ? env.USERPROFILE : env.HOME) || homedir();
  return join(hjem, 'Documents', MAPPENAVN);
}

function laesArgumenter(argv) {
  const valg = { prerelease: false, mappe: undefined, hjaelp: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prerelease') valg.prerelease = true;
    else if (a === '--mappe') valg.mappe = argv[++i];
    else if (a.startsWith('--mappe=')) valg.mappe = a.slice('--mappe='.length);
    else if (a === '--hjaelp' || a === '--hjælp' || a === '-h' || a === '--help') valg.hjaelp = true;
    else throw fejl(`Jeg kender ikke "${a}". Skriv --hjælp for at se, hvad du kan skrive.`);
  }
  if (valg.mappe !== undefined && !valg.mappe) throw fejl('--mappe mangler en mappe, fx --mappe "C:\\Studie\\Progmaskinen".');
  return valg;
}

const HJAELP = `Progmaskinen: henter og installerer Progmaskinen.

  npx progmaskinen                  hent den nyeste udgivelse
  npx progmaskinen --mappe <sti>    læg den i en anden mappe end Dokumenter/Progmaskinen
  npx progmaskinen --prerelease     tag også forhåndsudgivelser (kun til test)
`;

function spoerg(stdin, stdout, tekst) {
  return new Promise((ok) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(tekst, (svar) => {
      rl.close();
      ok(svar.trim());
    });
    rl.on('close', () => ok(''));
  });
}

function udvidSti(sti, env) {
  const hjem = (process.platform === 'win32' ? env.USERPROFILE : env.HOME) || homedir();
  const uden = sti.replace(/^["']|["']$/g, '');
  return resolve(uden === '~' ? hjem : uden.startsWith('~/') || uden.startsWith('~\\') ? join(hjem, uden.slice(2)) : uden);
}

async function hent(url, ventMs) {
  let svar;
  try {
    svar = await fetch(url, { headers: { 'User-Agent': 'progmaskinen-installer', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(ventMs) });
  } catch (f) {
    throw fejl(`Kunne ikke hente Progmaskinen (${f.name === 'TimeoutError' ? 'det tog for lang tid' : f.cause?.code ?? f.message}). Tjek din internetforbindelse, og prøv igen.`);
  }
  if (svar.status === 403 || svar.status === 429) throw fejl('GitHub siger, at der er spurgt for mange gange lige nu. Vent lidt, og prøv igen om en halv times tid.');
  if (!svar.ok) throw fejl(`Kunne ikke hente Progmaskinen (GitHub svarede ${svar.status}). Prøv igen senere.`);
  return svar;
}

async function hentUdgivelse(url, prerelease, skriv) {
  const liste = await (await hent(url, 20000)).json();
  const udgivelse = nyesteUdgivelse(liste, { prerelease });
  if (!udgivelse) throw fejl('Der er endnu ingen udgivelse af Progmaskinen at hente. Prøv igen senere.');
  const zip = udgivelse.assets?.find((a) => a.name.endsWith('.zip'));
  if (!zip) throw fejl('Udgivelsen har ingen zip-fil. Prøv igen senere.');
  const kontrol = udgivelse.assets.find((a) => a.name === `${zip.name}.sha256`);
  if (!kontrol) throw fejl('Udgivelsen har ingen kontrolsum (SHA256), så den installeres ikke.');
  const version = udgivelse.tag_name.replace(/^v/, '');
  skriv(`Henter Progmaskinen ${version} ...`);
  const forventet = (await (await hent(kontrol.browser_download_url, 20000)).text()).match(/\b[0-9a-f]{64}\b/i)?.[0]?.toLowerCase();
  let data;
  try {
    data = Buffer.from(await (await hent(zip.browser_download_url, 180000)).arrayBuffer());
  } catch (f) {
    if (f instanceof InstallationsFejl) throw f;
    throw fejl(`Hentningen blev afbrudt (${f.cause?.code ?? f.message}). Tjek din internetforbindelse, og prøv igen.`);
  }
  if (!forventet || sha256(data) !== forventet) throw fejl('Den hentede fil passer ikke med sin kontrolsum (SHA256), så den installeres ikke. Prøv igen senere.');
  return { data, version };
}

function pakUd(zip, til) {
  const r = spawnSync('tar', ['-xf', zip, '-C', til], { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw fejl(`Kunne ikke pakke Progmaskinen ud (${r.stderr?.trim() || r.error?.message || 'tar mangler'}). Du kan i stedet hente zip-filen på https://github.com/jakob-busk/progmaskinen-hent/releases og pakke den ud selv.`);
}

/** Finder produktmappen i det udpakkede (zip-filen har én mappe) og kontrollerer den mod sit manifest. */
function findOgVerificer(udpakket) {
  const under = readdirSync(udpakket).filter((f) => statSync(join(udpakket, f)).isDirectory());
  const rod = under.length === 1 ? join(udpakket, under[0]) : udpakket;
  if (!['kerne', 'scripts', 'version.json', 'manifest.json'].every((f) => existsSync(join(rod, f)))) throw fejl('Den hentede udgivelse ligner ikke Progmaskinen, så den installeres ikke.');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(rod, 'manifest.json'), 'utf8'));
  } catch {
    throw fejl('Udgivelsens manifest kan ikke læses, så den installeres ikke.');
  }
  for (const [fil, sum] of Object.entries(manifest.filer ?? {})) {
    const sti = join(rod, ...fil.split('/'));
    if (!existsSync(sti) || sha256(readFileSync(sti)) !== sum) throw fejl(`Filen ${fil} i udgivelsen mangler eller passer ikke med sin kontrolsum, så den installeres ikke.`);
  }
  return rod;
}

const erTom = (mappe) => readdirSync(mappe).length === 0;
const harProgmaskinen = (mappe) => existsSync(join(mappe, 'elev')) || existsSync(join(mappe, 'version.json')) || existsSync(join(mappe, 'kerne'));

function aabnMappen(mappe) {
  const [kommando, args] = process.platform === 'win32' ? ['explorer', [mappe]] : process.platform === 'darwin' ? ['open', [mappe]] : ['xdg-open', [mappe]];
  spawn(kommando, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

/** Starter onboarding-serveren (som åbner browseren selv), og venter kort på, at den melder sin adresse. */
async function startOnboarding(mappe, env) {
  const logSti = join(tmpdir(), `progmaskinen-onboarding-${process.pid}.log`);
  const ud = openSync(logSti, 'w');
  const barn = spawn(process.execPath, [join('scripts', 'onboarding.mjs')], { cwd: mappe, env, detached: true, stdio: ['ignore', ud, ud], windowsHide: true });
  barn.on('error', () => {});
  barn.unref();
  closeSync(ud);
  if (env.PROGMASKINEN_INSTALLER_PID_FIL) writeFileSync(env.PROGMASKINEN_INSTALLER_PID_FIL, String(barn.pid));
  let url;
  for (let i = 0; i < 100 && !url; i++) {
    await new Promise((ok) => setTimeout(ok, 100));
    url = readFileSync(logSti, 'utf8').match(/https?:\/\/localhost:\d+\//)?.[0];
  }
  try {
    rmSync(logSti, { force: true });
  } catch {
    /* på Windows kan filen være åben endnu; den ligger i den midlertidige mappe */
  }
  return url;
}

/**
 * Kører installationen. Returnerer exit-kode. Under test kan alt styres udefra via valgene.
 * Uden TTY (fx i tests) bruges forslaget til mappen uden at spørge.
 */
export async function koer({ argv = [], env = process.env, stdin = process.stdin, stdout = process.stdout, skriv = (t) => stdout.write(`${t}\n`) } = {}) {
  let tmp;
  try {
    const valg = laesArgumenter(argv);
    if (valg.hjaelp) {
      skriv(HJAELP.trimEnd());
      return 0;
    }
    if (!nodeVersionOk(process.versions.node)) throw fejl(`Din Node.js (${process.versions.node}) er for gammel. Progmaskinen kræver Node.js 20.11 eller nyere. Hent den nyeste LTS-version på https://nodejs.org.`);

    // 1. Hvor skal den ligge?
    const forslag = standardMappe(env);
    let mappe;
    if (valg.mappe) mappe = udvidSti(valg.mappe, env);
    else if (stdin.isTTY && stdout.isTTY) {
      const svar = await spoerg(stdin, stdout, `Progmaskinen lægges i ${forslag}\nTryk Enter for at bruge den, eller skriv en anden mappe: `);
      mappe = svar ? udvidSti(svar, env) : forslag;
    } else {
      mappe = forslag;
      skriv(`Progmaskinen lægges i ${mappe}.`);
    }

    // 2. Findes den allerede? Så røres intet.
    if (existsSync(mappe)) {
      if (!statSync(mappe).isDirectory()) throw fejl(`${mappe} er en fil, ikke en mappe. Vælg en anden mappe med --mappe.`);
      if (harProgmaskinen(mappe)) {
        skriv(`Du har allerede Progmaskinen her: ${mappe}`);
        skriv('Der er ikke ændret noget, og dit fremskridt er urørt. Opdatering sker inde i programmet: skriv "opdater" til Claude.');
        if (stdin.isTTY && stdout.isTTY) {
          const svar = (await spoerg(stdin, stdout, 'Vil du åbne mappen? (j/N) ')).toLowerCase();
          if (svar === 'j' || svar === 'ja') aabnMappen(mappe);
        }
        return 0;
      }
      if (!erTom(mappe)) throw fejl(`Mappen ${mappe} findes og indeholder allerede andre filer. Jeg lægger ikke Progmaskinen oven i dem. Vælg en anden mappe med --mappe.`);
    }

    // 3. Hent og verificér.
    const prerelease = valg.prerelease || (!!env.PROGMASKINEN_PRERELEASE && env.PROGMASKINEN_PRERELEASE !== '0');
    const { data, version } = await hentUdgivelse(env.PROGMASKINEN_UDGIVELSER_URL ?? UDGIVELSER, prerelease, skriv);

    // 4. Pak ud ved siden af målet (samme drev, så den kan flyttes på plads), og flyt den hele mappe på én gang.
    const foraeldre = dirname(mappe);
    mkdirSync(foraeldre, { recursive: true });
    tmp = mkdtempSync(join(foraeldre, TMP_PRAEFIKS));
    const zip = join(tmp, 'udgivelse.zip');
    writeFileSync(zip, data);
    const udpakket = join(tmp, 'udpakket');
    mkdirSync(udpakket);
    pakUd(zip, udpakket);
    const rod = findOgVerificer(udpakket);
    if (existsSync(mappe)) rmdirSync(mappe); // kun en tom mappe kan fjernes her; indhold giver en fejl og ændrer intet
    try {
      renameSync(rod, mappe);
    } catch (f) {
      if (existsSync(mappe)) throw fejl(`Mappen ${mappe} blev oprettet af et andet program lige nu. Intet er overskrevet; prøv igen.`);
      cpSync(rod, mappe, { recursive: true, force: false, errorOnExist: true });
    }

    // 5. Start onboarding.
    const url = await startOnboarding(mappe, env);
    skriv('');
    skriv(`Progmaskinen ${version} ligger nu i ${mappe}`);
    skriv(url ? `Næste skridt står i din browser (${url}). Åbner den ikke af sig selv, så gå til adressen.` : 'Næste skridt står i din browser. Åbner den ikke af sig selv, så åbn mappen i VS Code og skriv /næste i Claude Code.');
    return 0;
  } catch (f) {
    if (f instanceof InstallationsFejl) {
      console.error(f.message);
      return 1;
    }
    console.error(`Installationen fejlede uventet (${f.code ?? f.message}). Intet er ødelagt; prøv igen.`);
    return 1;
  } finally {
    // Kun vores egen midlertidige mappe slettes (navnet er kontrolleret).
    if (tmp && basename(tmp).startsWith(TMP_PRAEFIKS) && dirname(tmp) !== tmp && !tmp.endsWith(sep)) rmSync(tmp, { recursive: true, force: true });
  }
}
