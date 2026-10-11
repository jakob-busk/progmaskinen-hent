# Sådan henter du Progmaskinen

Progmaskinen er træning til programmeringseksamen på 1. semester (JavaScript, HTML og CSS). Her står trin for trin, hvordan du får den på din computer. Det tager ca. 15-25 minutter første gang.

> **Krav:** Du skal have en Claude Pro-konto (eller en større plan). Den gratis Claude-plan kan ikke bruges med Claude Code.

Du skal installere tre programmer først: **Node.js**, **VS Code** og **Claude Code**. Derefter henter du Progmaskinen med én kommando.

Vælg din computer:

- [Mac](#mac)
- [Windows](#windows)

## Mac

1. **Node.js** (det, der kører din JavaScript). Gå til https://nodejs.org, og klik på knappen, hvor der står **LTS**. Hent **macOS Installer (.pkg)**, åbn filen, og klik dig igennem installationen.
2. **VS Code** (der, hvor du skriver kode). Gå til https://code.visualstudio.com, og hent VS Code til Mac. Åbn den hentede fil, og flyt **Visual Studio Code** over i mappen **Programmer**.
3. **Claude Code.** Åbn programmet **Terminal** (tryk Cmd+mellemrum, skriv `Terminal`, og tryk Enter). Kopiér denne linje ind, og tryk Enter:

   ```
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   Den viser ikke noget, mens den henter. Vent, til den er færdig. Luk så Terminal helt (Cmd+Q), og åbn den igen. Hjælp fra Claude Code selv: https://code.claude.com/docs/en/setup (på engelsk)
4. **Progmaskinen.** Skriv denne kommando i Terminal, og tryk Enter:

   ```
   npx progmaskinen
   ```

   Spørger den `Ok to proceed? (y)`, så skriv `y`, og tryk Enter. Når den spørger, hvor Progmaskinen skal ligge, så tryk bare Enter. Så kommer den i **Dokumenter/Progmaskinen**. Bagefter åbner din browser af sig selv og viser, hvad du skal gøre nu.

## Windows

1. **Node.js** (det, der kører din JavaScript). Gå til https://nodejs.org, og klik på knappen, hvor der står **LTS**. Hent **Windows Installer (.msi)**, åbn filen, og klik **Next** hele vejen igennem.
2. **VS Code** (der, hvor du skriver kode). Gå til https://code.visualstudio.com, og hent VS Code til Windows. Åbn filen, og klik dig igennem installationen.
3. **Claude Code.** Åbn **PowerShell** (tryk på Windows-tasten, skriv `PowerShell`, og tryk Enter). Kopiér denne linje ind, og tryk Enter:

   ```
   irm https://claude.ai/install.ps1 | iex
   ```

   Den viser ikke noget, mens den henter. Vent, til den er færdig. Luk så PowerShell, og åbn den igen. Hjælp fra Claude Code selv: https://code.claude.com/docs/en/setup (på engelsk)
4. **Progmaskinen.** Skriv denne kommando i PowerShell, og tryk Enter:

   ```
   npx.cmd progmaskinen
   ```

   Husk `.cmd` til sidst i `npx.cmd`. Uden den kan Windows nægte at køre kommandoen. Spørger den `Ok to proceed? (y)`, så skriv `y`, og tryk Enter. Når den spørger, hvor Progmaskinen skal ligge, så tryk bare Enter. Så kommer den i **Dokumenter\Progmaskinen**. Bagefter åbner din browser af sig selv og viser, hvad du skal gøre nu.

## Hvis noget går galt

- **"claude" eller "node" kan ikke findes:** luk terminalen (eller VS Code) helt, og åbn den igen. Hjælper det ikke, så genstart computeren.
- **Installeren siger, at Claude Code eller VS Code mangler:** Progmaskinen er hentet alligevel. Installér det, der mangler (trin 2 eller 3 ovenfor).
- **Kommandoen i trin 4 virker slet ikke:** brug reserven herunder.

## Reserve: hent zip-filen

Virker kommandoen i trin 4 ikke, kan du hente Progmaskinen som en zip-fil i stedet. Du skal stadig have installeret Node.js, VS Code og Claude Code (trin 1 til 3).

1. Gå til https://github.com/jakob-busk/progmaskinen-hent/releases/latest, og klik på filen `progmaskinen-…zip` under **Assets**.
2. Pak zip-filen ud i **Dokumenter**:
   - **Mac:** dobbeltklik på zip-filen i Overførsler. Flyt mappen **Progmaskinen**, der kommer frem, over i Dokumenter.
   - **Windows:** højreklik på zip-filen i Overførsler, og vælg **Pak alle ud**. Klik **Gennemse**, vælg **Dokumenter**, og klik **Pak ud**.
3. Find den rigtige mappe. Windows laver ofte en ekstra mappe udenom, som hedder det samme som zip-filen (fx `progmaskinen-1.0.1`). Den mappe, du skal bruge, er **Progmaskinen** inde i den. Det er den mappe, hvor filen `START-HER.html` ligger.
4. Åbn VS Code. Vælg **File**, **Open Folder** (på dansk: **Filer**, **Åbn mappe**), og vælg mappen **Progmaskinen**.
5. Vælg **Terminal**, **New Terminal** (på dansk: **Terminal**, **Ny terminal**). Skriv `claude`, og tryk Enter. Første gang logger du ind med din Claude-konto.
6. Claude spørger, om du stoler på mappen. Svar **Yes**. Så åbner opsætningen af sig selv i din browser, præcis som efter kommandoen i trin 4.

## Har du den allerede?

Kører du kommandoen igen, rører den ikke din mappe. Den siger bare, at du allerede har Progmaskinen. Opdatering sker inde i programmet: skriv `/opdater` til Claude.

## Licens

Alle rettigheder forbeholdes. Se [LICENSE](LICENSE).
