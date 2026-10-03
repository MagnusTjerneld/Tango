# Tango

Ett Tango-pussel för mobil och webbläsare med förgenererade banor (6x6 och 8x8), i samma upplägg som Queens.

Regler: fyll brädet med solar och månar. Inte fler än två lika får ligga bredvid varandra, varken vågrätt eller lodrätt. Varje rad och kolumn har lika många solar som månar. Rutor med ett **=** mellan sig är lika, rutor med ett **×** mellan sig är olika. Varje bana har en enda lösning och går att lösa med logik, du behöver aldrig gissa.

## Spela

Den publicerade versionen byggs och läggs ut av GitHub Actions (se Publicering). För att spela lokalt: kör `node scripts/build-page.js` och öppna sedan `index.html` i en webbläsare. Banorna ligger inbäddade i sidan.

### Installera som app (PWA)

Spelet är en PWA. Publicerat över https (t.ex. GitHub Pages) kan det installeras på hemskärmen och spelas helt offline:

- Android/Chrome: menyn → Installera app.
- iPhone/Safari: Dela → Lägg till på hemskärmen.

En service worker förcachar sidan, ikonerna och typsnitten vid första besöket. När en ny version publiceras hämtas den i bakgrunden och används från nästa start. Service workers kräver http(s), så öppnad direkt från disk (`file://`) fungerar sidan som vanligt men utan offline-stöd och installation. Lokalt: `npx http-server .`

Manifestet har avsiktligt inget `id`. Ett `id` tolkas mot sajtens origin, inte mot manifestets mapp, så `"id": "./"` blir `https://<ägare>.github.io/` och krockar med andra appar på samma origin (t.ex. Queens): Chrome säger då att appen redan är installerad. Utan `id` används `start_url`, som pekar på `…/Tango/`.

- Tryck på en ruta för att växla mellan sol, måne och tom. Rutor som är ifyllda från start är låsta.
- Felmarkeringen visas först när brädet legat stilla en sekund, eftersom man ofta passerar en ruta som tillfälligt bryter mot en regel på vägen från sol till måne.
- Tips pekar ut nästa logiska steg. Den markerade rutan får vit ram, rutorna som är skälet får ränder, och en kort text förklarar varför. Alla banor går att lösa med Tips utan att behöva prova antaganden över flera rader.
- Liggande telefon får en egen layout: brädet till vänster, rubrik, status och knappar till höger.
- Appen öppnar på en startskärm med logon, antal klarade banor och knapparna Spela (fortsätter på aktuell bana), Välj bana och Regler. Regler (även via **?** i spelet) har små exempelbräden som ritas med spelets egna färger.
- Klarade banor och bästa tid sparas i webbläsaren (localStorage), och appen öppnas på nästa bana.

## Struktur

| Sökväg | Innehåll |
| --- | --- |
| `index.html` | Den färdiga sajten (byggs, checkas inte in) |
| `dist/tango.html` | En enda självständig sida med samma spel (byggs, checkas inte in). Används som artefakt och i testet |
| `sw.js` | Service worker för offline (byggs, checkas inte in) |
| `manifest.webmanifest` | PWA-manifest: namn, färger, ikoner |
| `icons/` | `icon.svg` (appikon) och `og.svg` (delningsbild 1200 x 630); PNG-filerna renderas från dem vid bygget och checkas inte in |
| `fonts/` | Bricolage Grotesque och IBM Plex Mono, latin-delmängd (SIL Open Font License) |
| `src/app.template.html` | Spelets gränssnitt och logik, ett komplett HTML-dokument med platshållarna `__HEAD__` (sajtens PWA- och delningstaggar), `__FONTS__`, `__ENGINE__`, `__LEVELS__` och `__SW__` |
| `src/sw.template.js` | Mall för `sw.js` |
| `src/tango.js` | Generator, unikhetskontroll och logiklösare med förklaringar (används också av Tips i spelet) |
| `levels.json` | Banorna |
| `scripts/build-page.js` | Bygger `index.html`, `dist/tango.html` och `sw.js` (adressen för delningsbilden från `SITE_URL`, versionen på startskärmen från git) |
| `scripts/build-icons.js` | Renderar PNG-ikonerna och delningsbilden från `icons/*.svg` (kräver playwright) |
| `scripts/generate-levels.js` | Genererar om `levels.json` (deterministiskt, samma frön ger samma banor) |
| `scripts/verify-levels.py` | Oberoende kontroll att varje bana har exakt en lösning och att inget tecken sitter intill en ifylld startruta |
| `test/hints.test.js` | Följer Tips på alla banor i en headless-webbläsare (kräver playwright och `dist/tango.html`) |

## Publicering (GitHub Pages)

`.github/workflows/pages.yml` gör allt vid push till `main`: kontrollerar banorna, bygger ikoner, `index.html` och `sw.js`, kör tipstestet i Chromium och publicerar. Pull requests byggs och testas men publiceras inte. Byggda filer checkas inte in, så sajten byggs alltid från källan.

Engångsinställning i repot: Settings → Pages → Source: **GitHub Actions**.

Delningsbilden (`og:image`) måste vara en fullständig adress. Bygget använder `https://<ägare>.github.io/<repo>/`; vid egen domän, sätt repo-variabeln `SITE_URL` (Settings → Secrets and variables → Actions → Variables).

## Arbetsflöde

```
node scripts/generate-levels.js   # valfritt, ger nya banor om fröna ändras
python3 scripts/verify-levels.py  # kontrollera banorna
node scripts/build-icons.js       # valfritt lokalt (kräver playwright), behövs bara för offline/installation
node scripts/build-page.js        # bygg index.html, dist/tango.html och sw.js (görs även i Actions)
node test/hints.test.js           # testa tipsen (kräver playwright och en byggd dist/tango.html)
```

## Hur banorna genereras

1. En fullständig giltig bräda slumpas med backtracking: tre av varje i varje rad och kolumn, aldrig tre lika i rad.
2. Alla rutor och alla tecken mellan intilliggande rutor är först ledtrådar. De tas bort i slumpad ordning så länge lösningen förblir unik, och några läggs tillbaka för att ge lättare banor.
3. Ett tecken får aldrig sitta intill en ifylld startruta, eftersom det då avslöjar den andra rutan. Par som ändå uppstår repareras genom att ta bort tecknet eller rutan.
4. En logiklösare måste klara banan utan att prova antaganden: tecken, två lika bredvid varandra, en ruta mellan två lika, och att pröva alla sätt att fylla en rad eller kolumn. Nivån sätts efter hur många gånger det sista behövs: 0 är Lätt, upp till en gräns är Medel, över den Svår.

## Kända begränsningar

- Banorna genereras om när lösaren eller reglerna för ledtrådar ändras, så numreringen och sparat framsteg (localStorage) följer inte med mellan versioner.
- Sparat framsteg är knutet till adressen. På iPhone får en hemskärmsapp egen lagring, så framsteg från Safari-fliken följer inte med in i den installerade appen.
- Brädet ritas på en canvas i hela skärmpixlar för jämna linjer. Det är testat i simulerade telefoner, inte på riktiga enheter.
