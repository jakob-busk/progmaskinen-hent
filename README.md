# Sådan henter du Progmaskinen

Progmaskinen er træning til programmeringseksamen på 1. semester (JavaScript, HTML og CSS). Her henter du den.

## Det skal du have først

- **Node.js** (nyeste LTS-version): https://nodejs.org
- **Claude Code**: https://claude.com/claude-code
- **Claude Pro** (eller en større plan). Den gratis Claude-plan kan ikke bruges med Claude Code.

## Hent den

Åbn en terminal (macOS: Terminal. Windows: PowerShell) og skriv:

```
npx progmaskinen
```

Programmet spørger, hvor Progmaskinen skal ligge. Tryk Enter for at bruge forslaget (`Dokumenter/Progmaskinen`). Bagefter åbner din browser af sig selv, og der står, hvad du skal gøre næste gang.

Virker den ikke, kan du bruge denne i stedet:

```
npx github:jakob-busk/progmaskinen-hent
```

Den kræver, at git er installeret (uden git fejler den med "spawn git ENOENT"). Har du ikke git, så brug denne adresse, som ikke kræver git:

```
npx https://github.com/jakob-busk/progmaskinen-hent/tarball/main
```

Eller hent zip-filen under [Releases](https://github.com/jakob-busk/progmaskinen-hent/releases) og pak den ud i Dokumenter.

## Har du den allerede?

Kører du kommandoen igen, rører den ikke din mappe. Den siger bare, at du allerede har Progmaskinen. Opdatering sker inde i programmet: skriv "opdater" til Claude.

## Licens

Alle rettigheder forbeholdes. Se [LICENSE](LICENSE).
