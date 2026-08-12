# Fantacalcio Asta — Design

**Data:** 2026-08-12
**Stato:** approvato dall'utente (brainstorming completato)

## 1. Obiettivo

App mobile personale (Android prioritario, iOS possibile in futuro) per il fantacalcio
Serie A modalità **Classic**. La funzione centrale è l'**assistente d'asta**: aiutare
l'utente a fare le offerte giuste durante l'asta a chiamata, in base a numero di
partecipanti, crediti disponibili e a un algoritmo che valuta i giocatori per ruolo
e statistiche storiche.

L'app è usata da **un solo utente** (l'utente registra manualmente tutti gli acquisti
durante l'asta). Nessun backend applicativo, nessun account, funzionamento **100%
offline durante l'asta**.

## 2. Decisioni chiave (dal brainstorming)

| Tema | Decisione |
|---|---|
| Modalità d'uso | Preparazione pre-asta **+** assistente live durante l'asta |
| Modalità di gioco | Solo Classic (P/D/C/A), rosa default 3P/8D/8C/6A configurabile |
| Tipo asta | A chiamata (rilancio libero) |
| Utenti live | Solo l'utente registra gli acquisti; nessun sync multi-utente |
| Distribuzione | Uso personale: APK Android installato direttamente |
| Dispositivo utente | Android |
| Fonte statistiche | `sofascore-pp-cli` (già installato: `C:\Users\Mauro\printing-press\library\sofascore\sofascore-pp-cli.exe`) |
| Fonte quotazioni | Export Excel listone Fantacalcio.it (login automatizzato, fallback manuale) |
| Pubblicazione dataset | **GitHub raw** (nessun server; scelto anche per provare il servizio) |
| Aggiornamento dataset | **Autonomo**: pipeline schedulata sul PC + download automatico nell'app (requisito per le aste di riparazione di gennaio) |
| Multi-lega | Fino a **5 leghe/aste in parallelo**, stato indipendente per ciascuna |
| Stack | Pipeline Python sul PC + app React Native/Expo (TypeScript) |

## 3. Architettura

```
fantacalcio/
├── pipeline/     # Python — gira sul PC (Task Scheduler, es. settimanale)
│   └── produce dataset.json → push su repo GitHub → servito via GitHub raw
└── app/          # Expo / React Native (TypeScript) — consuma dataset.json
```

Flusso dati:

1. **Pipeline (PC, schedulata)**: sync SofaScore → import quotazioni → matching →
   algoritmo di valutazione → `dataset.json` → commit/push su GitHub.
2. **App (telefono)**: all'avvio, se online, controlla la versione di `dataset.json`
   su GitHub raw e scarica se più recente. Usa sempre l'ultima copia locale; durante
   l'asta non serve alcuna connessione. Import manuale da file come fallback.

Motivazione della divisione: l'algoritmo si itera meglio in Python sul PC (dove vive
il CLI SofaScore); l'app resta leggera e fa solo i ricalcoli live che dipendono da
dati nati durante l'asta.

## 4. Pipeline dati (Python)

### 4.1 Sorgenti

- **SofaScore** via `sofascore-pp-cli` (`sync` per la Serie A, `player` per il
  dettaglio carriera). Statistiche per stagione: presenze, minuti, gol, assist,
  rigori calciati/segnati, ammonizioni/espulsioni, rating medio; per i portieri:
  gol subiti, clean sheet, rigori parati.
- **Listone Fantacalcio.it** (export Excel): quotazioni Classic (Qt.A), ruolo,
  squadra. Il download richiede login: la pipeline lo automatizza con le credenziali
  dell'utente (best-effort); se fallisce, avviso e import manuale del file.

### 4.2 Carriera multi-campionato e coefficienti di lega

Per ogni giocatore del listone si scarica la **carriera completa**, incluse le
stagioni in campionati diversi dalla Serie A. Le statistiche estere sono
riproporzionate con un **coefficiente di lega** (es. Premier > Serie A ≈ Liga >
Ligue 1 > Eredivisie > ...) così i neoacquisti hanno sempre una valutazione fondata,
mai "al buio".

### 4.3 Profilo caratteristiche (tratti storici permanenti)

Dalla carriera completa si derivano tratti che alimentano sia l'algoritmo sia le
badge visibili nel dettaglio giocatore:

- 🎯 **Rigorista** (rigori calciati/segnati in carriera) e specialista punizioni
- 🅰️ **Assist-man** (produzione assist costante nel tempo)
- 🧤 **Para-rigori** (percentuale rigori parati, per i portieri)
- ⚠️ **Rischio cartellini** (ammonizioni/espulsioni ricorrenti → malus attesi)
- ⚽ **Vocazione offensiva** di difensori/centrocampisti (gol, tiri, inserimenti)
- 🏥 **Durabilità** (storico infortuni / minuti persi)

### 4.4 Matching nomi

Matching fuzzy SofaScore ↔ listone su nome + squadra. I casi dubbi finiscono in un
report per conferma manuale; le corrispondenze confermate si salvano in una tabella
di mapping riusata nelle esecuzioni successive. I giocatori senza match ricevono una
valutazione dalla sola quotazione, marcata "affidabilità bassa".

### 4.5 Output `dataset.json`

~600 giocatori, < 2 MB. Per giocatore: anagrafica, ruolo, squadra, quotazione,
statistiche sintetiche per stagione, profilo caratteristiche, proiezioni
(fantamedia attesa, titolarità), VORP normalizzato, fascia, indice affidabilità.
Header con versione e timestamp per il check di aggiornamento dell'app.

**Nota**: il prezzo in crediti NON sta nel dataset — lo calcola l'app per ciascuna
lega, perché dipende da partecipanti × crediti.

### 4.6 Scheduling

Attività pianificata di Windows (settimanale). Prima di un'asta l'utente può
lanciare la pipeline a mano per dati freschissimi. Se un passo fallisce (es. cambio
struttura del sito quotazioni), la pipeline notifica l'errore e pubblica comunque
ciò che può con i dati precedenti ancora validi.

## 5. Algoritmo di valutazione

### Fase A — Valutazione base (pipeline, per giocatore)

1. **Fantamedia attesa a giornata**: voto base atteso dal rating SofaScore storico
   (mappato sulla scala voto italiana), pesato sulle ultime 2-3 stagioni (peso
   maggiore alla più recente, coefficiente di lega applicato alle stagioni estere).
   Bonus/malus attesi Classic: +3 × gol attesi/giornata, +1 × assist, quota
   rigorista, −0,5 × ammonizioni attese; portieri: −1 × gol subiti attesi, bonus
   imbattibilità, bonus para-rigori.
2. **Titolarità attesa**: presenze proiettate da minuti storici, età, gerarchie di
   squadra. Il rendimento a giornata viene combinato con la probabilità di giocare.
3. **VORP** (Value Over Replacement Player): fantapunti attesi in più rispetto al
   miglior giocatore acquistabile a 1 credito nello stesso ruolo, dato il numero di
   slot totali della lega. Rende confrontabili i ruoli tra loro.
4. **Fascia**: Top / Semi-top / Titolare solido / Scommessa / Low cost.
5. **Indice affidabilità**: penalizza infortuni ricorrenti, discontinuità, mancanza
   di storico (matching fallito, esordienti).

### Fase B — Conversione in crediti (app, per ciascuna lega)

Monte crediti rilevante = partecipanti × crediti − (1 credito × ogni slot
obbligatorio). Distribuito sui giocatori in proporzione al VORP → **prezzo equo**
per quella lega. Proprietà di sanità: la somma dei prezzi equi ≈ monte crediti.

### Fase C — Aggiustamenti live (app, ricalcolo a ogni acquisto registrato)

1. **Inflazione reale**: rapporto tra prezzi pagati e prezzi equi dei giocatori già
   venduti → corregge i prezzi equi dei rimanenti (crediti residui in lega vs valore
   residuo sul mercato).
2. **Scarsità di ruolo**: pochi giocatori di fascia alta rimasti + tanti slot da
   riempire in quel ruolo → il valore dei rimanenti sale.
3. **Vincoli di budget personali**: massimo spendibile lasciando ≥ 1 credito per
   ogni slot vuoto della propria rosa.
4. **Pressione avversari**: per ogni avversario, offerta massima teorica = crediti
   residui − slot da riempire. Mostrata quando si valuta un'offerta.

Output al momento della chiamata di un giocatore: **prezzo equo aggiornato, massimo
consigliato personalizzato, offerta massima di ciascun avversario**.

## 6. App mobile (Expo / React Native, TypeScript)

### 6.1 Multi-lega

Fino a **5 leghe** attive contemporaneamente. Ogni lega ha: parametri (squadre con
nomi, crediti, composizione rosa), piano strategia, target e stato d'asta
indipendenti. Selettore lega sempre accessibile (cambio in un tap, anche a metà
asta). Il dataset giocatori è unico e condiviso; i prezzi equi sono ricalcolati per
lega (Fase B).

### 6.2 Schermate

1. **Lega** — creazione/modifica profilo lega. **Modalità riparazione**: si
   inseriscono le rose attuali e i crediti residui di ogni squadra; l'asta live
   parte dalla situazione reale (slot già occupati, budget già spesi).
2. **Listone** — ricerca e filtri (ruolo, squadra, fascia); ordinamento per prezzo
   equo, quotazione, affidabilità. Dettaglio giocatore: prezzo equo di lega, fascia,
   badge caratteristiche, statistiche storiche (incluse stagioni estere), "perché"
   del prezzo.
3. **Strategia** — allocazione budget per reparto (riparto suggerito
   dall'algoritmo, modificabile); lista target con prezzi obiettivo; avviso se i
   target sforano il piano.
4. **Asta live** — barra sempre visibile: budget proprio + slot residui per ruolo.
   Ricerca rapida del giocatore chiamato → schermata offerta (prezzo equo live, max
   consigliato, pressione avversari). Registrazione acquisto in 2-3 tap (squadra +
   prezzo). Vista rose/budget di tutte le squadre. **Undo** e correzione di
   qualsiasi registrazione. Giocatore già venduto → bloccato con avviso.
5. **Riepilogo** — a fine asta: rosa completa, spesa per reparto, affari e
   strapagati vs prezzo equo.

### 6.3 Persistenza e aggiornamento

- Dataset e stato app salvati in locale (storage su file/SQLite via Expo).
- Lo stato d'asta si persiste **a ogni azione** (crash-safe, ripresa esatta).
- All'avvio con connessione: check versione dataset su GitHub raw → download se più
  recente. Avviso se il dataset locale ha più di 30 giorni.
- Import manuale del dataset da file come fallback.

### 6.4 Design visivo

Curato in fase di implementazione (skill di frontend design): estetica distintiva,
tema scuro da app sportiva, tipografia forte, leggibilità immediata nella
concitazione dell'asta. Le informazioni critiche (max consigliato, budget) devono
leggersi a colpo d'occhio.

## 7. Gestione errori

| Caso | Comportamento |
|---|---|
| Giocatore senza match SofaScore | Valutazione dalla sola quotazione + badge "affidabilità bassa" |
| Download quotazioni fallito | Notifica; pipeline usa l'ultimo listone valido; import manuale possibile |
| Dataset vecchio (>30 gg) | Avviso non bloccante nell'app |
| Acquisto duplicato | Bloccato con avviso |
| Errore di registrazione | Undo/modifica sempre disponibili |
| Crash/spegnimento durante l'asta | Stato persistito a ogni azione → ripresa esatta |
| App offline all'avvio | Usa l'ultima copia locale senza errori |

## 8. Testing

- **Pipeline (pytest)**: matching nomi (casi noti + casi limite), calcolo proiezioni
  su giocatori campione, proprietà di sanità (somma prezzi equi ≈ monte crediti,
  nessun prezzo < 1, ordinamento coerente con VORP), coefficienti di lega.
- **App (Jest)**: logica live pura (inflazione, scarsità, max bid, vincoli budget,
  pressione avversari), riduttori di stato asta (registra/undo/correggi), calcolo
  prezzi per lega.
- **Manuale**: UI provata sul dispositivo Android dell'utente (Expo dev build / APK).

## 9. Fuori scope (v1)

- Modalità Mantra e composizione ruoli non-Classic
- Sync multi-utente / asta condivisa in tempo reale
- Pubblicazione sugli store (Play/App Store)
- Build iOS (resa possibile dal framework, ma non prodotta in v1)
- Consigli di formazione settimanale, mercato svincolati, scambi (possibili evoluzioni future)

## 10. Rischi noti

- **Automazione download listone**: il login/export di Fantacalcio.it può cambiare;
  mitigato dal fallback manuale e dalla notifica di errore.
- **Rate limit SofaScore**: il CLI ha rate limiting integrato (default 2 req/s);
  la sync completa delle carriere va fatta in modo incrementale/cachata.
- **Qualità coefficienti di lega**: valori iniziali da letteratura/buon senso,
  raffinabili nel tempo confrontando le proiezioni con i rendimenti reali.
