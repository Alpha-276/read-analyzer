# Product Requirements Document (PRD)

# 🎙️ Read Analyzer: Systém na zber a analýzu čítania žiakov ZŠ

* **Názov produktu:** Read Analyzer
* **Verzia dokumentu:** 2.1.0 (aktualizované podľa stretnutí so zadávateľom a mentorom 22. 10. 2026)
* **Dátum:** 28. október 2026
* **Platforma:** Android aplikácia pre učiteľov (React Native + Expo) + vzdialený analytický server (Python, FastAPI) + webová analytická aplikácia
* **Zadávateľ:** Indícia (Viktória Barátová)
* **Mentor:** doc. Ing. Stanislav Ondáš, PhD. (KKUI FEI TUKE)
* **Konzultant (model na detskú reč):** Juraj Kováč
* **Product Owner:** Artsiom Beniash
* **Scrum Master:** Yevhenii Medushivskyi
* **Tím:** Alpha-276 (Team Alpha)
* **Jira Board:** [RA Board](https://uvb.atlassian.net/jira/software/projects/RA/boards/2)
* **Repozitár:** [Alpha-276/read-analyzer](https://github.com/Alpha-276/read-analyzer)

---

## 1. Vízia a účel produktu

**Read Analyzer** pomáha učiteľom 1. stupňa ZŠ jednoducho a štandardizovane nahrávať čítanie detí a výskumnému tímu tieto nahrávky automaticky analyzovať.

Systém má dve časti:

1. **Aplikácia pre učiteľa (Android):** učiteľ v triede vyberie žiaka a text, nahrá čítanie vo formáte WAV, uloží ho do telefónu a neskôr ho odošle na úložisko.
2. **Analytická časť (server + web):** výskumníci a logopédi nad úložiskom spúšťajú prepis reči viacerými modelmi, porovnanie s predlohou a výpočet metrík.

V **pilotnej fáze** vidí výsledky analýzy len výskumný tím. Učiteľ dostane spätnú väzbu až v ďalšej fáze, keď budú metriky a kritériá hodnotenia overené.

**Pilot:** 100 detí z 2. ročníka (prvá vlna), potom ďalších 400 detí z 1. ročníka – spolu 500 detí.

---

## 2. Kľúčové požiadavky (zadávateľ a mentor)

1. **Platforma:** Android aplikácia v **React Native + Expo** (TypeScript), použiteľná na tablete aj smartfóne.
2. **Offline-first, lokálne ukladanie:**
   * Nahrávka sa vždy najprv uloží do telefónu. Aplikácia musí fungovať aj bez internetu.
   * Povinnou súčasťou metadát je **dátum merania (!)**.
   * Učiteľ si môže zvoliť priečinok na ukladanie, vrátane **SD karty** (interné úložisko býva malé).
3. **Odoslanie na úložisko (Google Drive):**
   * Prihlásenie **Google účtom** (raz v nastaveniach), cieľové úložisko je Google Drive zadávateľa.
   * Odoslanie **jedného žiaka** alebo **celej triedy** naraz; odoslanie spúšťa učiteľ.
   * Štruktúra priečinkov z telefónu sa zrkadlí na úložisko.
   * Učiteľ vidí **len svoju triedu** a nemôže nič mazať na serveri.
4. **Poznámka učiteľa:** ku každej nahrávke možno pridať textovú poznámku (napr. únava, choroba, typ diagnózy), ktorá sa odošle spolu s nahrávkou.
5. **Kvalita nahrávania:** nekomprimovaný **WAV**, minimálne 16 kHz / 16-bit, voliteľne 44,1 kHz / 48 kHz.
6. **Čítanie podľa predlohy (Ground Truth):** dieťa číta vopred definovaný text s kódom (`T01`, `T02`, `T03`…), prepis sa porovnáva s touto predlohou.
7. **Analýza na serveri, nie v telefóne:**
   * Spracovanie nemusí byť v reálnom čase – môže bežať dávkovo (napr. v noci nad všetkými novými nahrávkami).
   * Viac rozpoznávačov paralelne: Whisper pre slovenčinu (`kinit/whisper-large-v3-sk`), model TUKE na detskú reč, prípadne fonémový model; aktuálne je nasadený model Meta MMS.
   * Google Speech API **nepoužívať na reálne dáta** – nahrávky by odchádzali do Googlu (súkromie detí).
8. **Metriky:**
   * **WER** (word error rate), **SER** (sentence error rate), **CER** (character error rate).
   * **Confidence score** pre každé slovo – slová s nízkou istotou modelu sa označia ako problematické.
   * Sledovanie progresu dieťaťa v čase (napr. priemerné skóre 0,4 → 0,5 → 0,7).
9. **GDPR a anonymizácia:**
   * Mimo zadávateľa sa pracuje len s **anonymizovanými** dátami (kód dieťaťa namiesto mena).
   * Členovia tímu podpisujú dohodu o mlčanlivosti.
   * Vo finálnej prezentácii nesmú byť mená ani diagnózy; materiály pred zverejnením schváli zadávateľ.

---

## 3. Používateľské scenáre (User Stories)

**Učiteľ (Android aplikácia):**

* **US-1 (Správa triedy):** *Ako učiteľ si chcem vytvoriť triedu a vložiť do nej žiakov (meno, priezvisko), aby som mal pripravenú evidenciu na čítanie.*
* **US-2 (Príprava čítania):** *Ako učiteľ chcem vybrať zo zoznamu dieťa, kód textu (napr. T03) a dátum.*
* **US-3 (Nahrávanie):** *Ako učiteľ chcem veľkým tlačidlom Record/Stop nahrať, ako dieťa číta. Nahrávka sa uloží do zvoleného priečinka vo formáte WAV s dátumom a označením žiaka.*
* **US-4 (Poznámka):** *Ako učiteľ chcem k nahrávke pridať poznámku, aby analytik vedel o okolnostiach čítania.*
* **US-5 (Odoslanie):** *Ako učiteľ chcem odoslať nahrávky jedného žiaka alebo celej triedy na úložisko, keď mám internet.*

**Výskumník / logopéd (webová analytická aplikácia):**

* **US-6 (Analýza):** *Ako výskumník chcem nad nahrávkami na úložisku spustiť prepis a porovnanie s predlohou pre konkrétneho žiaka alebo celú triedu.*
* **US-7 (Výsledky):** *Ako výskumník chcem vidieť prepis, chybné/vynechané slová, WER/CER, confidence score po slovách a porovnanie s minulými čítaniami dieťaťa.*
* **US-8 (Manuálne hodnotenie – neskôr):** *Ako expert chcem k nahrávke pridať vlastné hodnotenie, aby slúžilo ako podklad na trénovanie modelov.*

---

## 4. Architektúra systému

```text
[Android aplikácia učiteľa]  --(odoslanie, Google účet)-->  [Google Drive zadávateľa]
   triedy, žiaci, nahrávanie,                                     │
   lokálne úložisko, poznámky                                     v
                                                     [Analytický server (Python, FastAPI)]
                                                       dávkový prepis viacerými modelmi,
                                                       porovnanie s predlohou, metriky
                                                                  │
                                                                  v
                                                     [Webová analytická aplikácia]
                                                       pre výskumníkov a logopédov
```

### Obrazovky Android aplikácie

```text
[1. Entry Page (Vitajte)]
    ├── [Vytvoriť triedu] ──> [2. Manažment triedy]
    │                             ├── Vytvorenie triedy
    │                             ├── Pridanie žiaka: Meno, Priezvisko
    │                             └── Zoznam žiakov (úprava, mazanie)
    │
    ├── [Nahrávky] ─────────> [3. Zoznam nahrávok]
    │                             ├── Zoskupenie podľa tried a žiakov, dátumy, kódy textov
    │                             ├── Prehratie nahrávky
    │                             └── [Odoslať žiaka] / [Odoslať celú triedu]
    │
    └── [Spustiť čítanie] ──> [4. Recording Page]
                                  ├── Výber dieťaťa, textu (T01, T02…) a dátumu
                                  ├── Ikona nastavení ──> [Setup Page]
                                  │                         ├── WAV, vzorkovacia frekvencia, bitová hĺbka
                                  │                         ├── Priečinok na ukladanie (aj SD karta)
                                  │                         └── Prihlásenie Google účtom
                                  ├── Tlačidlo [RECORD] (červené) / [STOP]
                                  │
                                  └── Po zastavení:
                                        ├── [Uložiť nahrávku] (lokálne)
                                        ├── [Pridať poznámku]
                                        └── [Odoslať na server]
```

> Pozn.: Obrazovka s prepisom v aplikácii učiteľa (RA-15) slúžila ako ukážka. Podľa dohody z 22. 10. sa prepis a analýza presúvajú do analytickej časti; v aplikácii učiteľa ostáva uloženie a odoslanie.

---

## 5. Štruktúra úložiska

Rovnaká štruktúra je v telefóne aj na Google Drive.

```text
ReadAnalyzerData/
├── texty/
│   ├── T01.txt                          # Štandardizovaná predloha 1
│   ├── T02.txt
│   └── T03.txt
│
└── triedy/
    └── 2A/
        ├── JN_001/                      # Iniciály + ID žiaka (bez celého mena na serveri)
        │   ├── 2026-10-16_0915_T01.wav
        │   ├── 2026-10-16_0915_T01_poznamka.txt   # Poznámka učiteľa
        │   ├── 2026-10-16_0915_T01.txt            # Prepis (vytvorí server)
        │   └── 2026-10-16_0915_T01.json           # Výsledky: WER, confidence, metriky (server)
        └── ZK_002/
            └── 2026-10-16_0930_T01.wav
```

Názov súboru: `{dátum}_{čas}_{kód textu}` – čas rozlišuje viac nahrávok v ten istý deň.

> Pozn.: Aktuálna implementácia (RA-8) ukladá do `deti/{Meno_Priezvisko}/{YYYY-MM-DD}_{KodTextu}.wav`. Úprava na štruktúru vyššie (trieda, ID žiaka, čas) súvisí s RA-24 a RA-26.

---

## 6. Technológie

| Časť | Technológie |
|---|---|
| Android aplikácia | React Native + Expo (TypeScript), Expo Router, development build |
| Nahrávanie | `react-native-audio-record` (PCM WAV), `expo-file-system` |
| Lokálne dáta | SQLite (`expo-sqlite`) |
| Úložisko | Google Drive API, prihlásenie Google účtom |
| Server | Python 3.11+, FastAPI, Docker |
| Rozpoznávanie reči | Whisper SK (`kinit/whisper-large-v3-sk`), model TUKE na detskú reč, Meta MMS |
| Analýza | `jiwer` (WER/CER), word-level confidence, `silero-vad` (pauzy) |
| Webová analytika | webová aplikácia nad serverom |
| Testy | Appium 2 + UiAutomator2, Python + `pytest` |

---

## 7. Rozdelenie úloh (stav v Jire k 28. 10. 2026)

Šprinty sú týždenné (štvrtok – streda). Review so zadávateľom každý **štvrtok o 18:00**.

**Android / Frontend – Sergiy Boyko**

* `RA-9` Inicializácia Android aplikácie a úvodná obrazovka 
* `RA-10` Obrazovka nahrávania s výberom dieťaťa a textu 
* `RA-23` Obrazovka Manažment triedy 
* `RA-15` Obrazovka po nahrávaní (uloženie, prepis) 
* `RA-16` Nastavenia nahrávania (Setup Page) 
* `RA-24` Výber priečinka na ukladanie a poznámky k čítaniu 
* `RA-25` Webová analytická aplikácia pre výskumníkov a logopédov 
* `RA-20` Zoznam nahrávok a profil dieťaťa s históriou 

**Backend / Core – Alina Kuznetsova**

* `RA-7` Dátová vrstva pre triedy a žiakov 
* `RA-8` Lokálne ukladanie WAV do priečinka žiaka s dátumom
* `RA-13` Vzdialený analytický server a synchronizácia s mobilnou aplikáciou 
* `RA-14` Lokálna SQLite databáza a offline synchronizácia so serverom 
* `RA-26` Integrácia s Google Drive a ekosystémom Google 
* `RA-19` Porovnanie s predchádzajúcim čítaním žiaka
* `RA-21` Export výsledkov (PDF/CSV)

**ML / Data – Dmytrii Chalykh**

* `RA-5` Príprava textov (T01..T0X) a audit datasetu 
* `RA-6` Prototyp rozpoznávania reči pre slovenčinu 
* `RA-11` Multimodelové rozpoznávanie (viac modelov paralelne) 
* `RA-12` Výpočet WPM a detekcia páuz  
* `RA-17` Skóre zrozumiteľnosti reči 
* `RA-18` Dávkové spracovanie datasetu 500 detí na superpočítači

---

## 8. Ďalšie kroky a otvorené otázky

* Prístup tímu na Google Drive zadávateľa a testovacie Google účty (gmail).
* Skúšobné nahrávky od zadávateľa na porovnanie modelov.
* Nasadenie a otestovanie modelu TUKE na detskú reč (kontakt: Juraj Kováč).
* Dohody o mlčanlivosti (GDPR) pre všetkých členov tímu.
* Metodické kritériá od zadávateľa: čo presne sledovať v jednotlivých fázach učenia čítania.
* Súhlas rodičov a licenčná zmluva na použitie nahrávok na trénovanie modelov (rieši mentor so zadávateľom).
* Finálna prezentácia projektu: január 2027.