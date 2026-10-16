# Product Requirements Document (PRD)

# 🎙️ Read Analyzer: Android Aplikácia pre Analýzu Čítania Žiakov ZŠ

* **Názov produktu:** Read Analyzer
* **Verzia dokumentu:** 2.0.0 (Aktualizované podľa zadania mentora — doc. Ing. Stanislav Ondáš, PhD.)
* **Dátum:** Október 2026
* **Platforma:** Android aplikácia (tablety a smartfóny pre učiteľov) + Spracovanie reči (Whisper / Google Speech API)
* **Product Owner:** Artsiom Beniash
* **Tím:** Alpha-276 (Team Alpha)
* **Jira Board:** [RA Board](https://uvb.atlassian.net/jira/software/projects/RA/boards/2)
* **Repozitár:** [Alpha-276/read-analyzer](https://github.com/Alpha-276/read-analyzer)

---

## 1. Vízia a Účel Produktu

Aplikácia **Read Analyzer** slúži učiteľom základných škôl (1. stupeň) a špeciálnym pedagógom na jednoduchý, štandardizovaný zber a automatickú analýzu hlasových nahrávok čítania detí. 

Učiteľ priamo v triede na tablete/smartfóne vyberie žiaka, predlohu textu, nahrá dieťa v nekomprimovanom WAV formáte a nechá systém vyhodnotiť plynulosť čítania, zrozumiteľnosť a odchýlky oproti originálnej textovej predlohe.

---

## 2. Kľúčové Zmeny a Požiadavky od Mentora

1. **Cieľová platforma:** Natívna/hybridná **Android aplikácia** prispôsobená pre použitie učiteľom v triede.
2. **Lokálne ukladanie (Privacy & GDPR):**
   * Nahrávky sa primárne ukladajú lokálne na zariadení do štruktúry:  
     `.../deti/{Meno_Priezvisko}/{YYYY-MM-DD}_{KodTextu}.wav`
   * Povinnou súčasťou metadát je **dátum merania (!)**.
3. **Kvalita nahrávania:**
   * Nekomprimovaný formát **WAV**.
   * Minimálne 16 kHz, 16-bit. Voliteľne štúdiová kvalita 44.1 kHz / 48 kHz (16/32-bit).
4. **Čítanie podľa predlohy (Ground Truth):**
   * Dieťa číta vopred definovaný text označený kódom (napr. `T01`, `T02`, `T03`).
   * ASR model (Whisper pre slovenčinu / Google Speech API) vytvorí prepis, ktorý sa **priamo porovnáva s predlohou textu**.
5. **Pragmatický rozsah (Scope):**
   * Zložité fonetické matice a akademické delenie na fonémy sú odložené na neskôr.
   * Priorita MVP: **Správa triedy → Výber žiaka a textu → Nahrávanie do WAV → Uloženie do zložky → Prepis a porovnanie s predlohou.**

---

## 3. Používateľské Scenáre (User Stories)

* **US-1 (Správa triedy):** *Ja ako učiteľ si chcem v aplikácii vytvoriť triedu a vložiť tam zoznam žiakov (meno, priezvisko), aby som mal pripravenú evidenciu na čítanie.*
* **US-2 (Príprava čítania):** *Ja ako učiteľ chcem vybrať zo zoznamu dieťa, ktoré ide čítať, a vybrať zo zoznamu kód textu (napr. T03).*
* **US-3 (Nahrávanie):** *Ja ako učiteľ chcem cez aplikáciu nahrať dieťa ako číta (veľké tlačidlo Record/Stop). Nahrávka sa uloží do lokálneho úložiska vo formáte WAV s dátumom a označením žiaka.*
* **US-4 (Spracovanie a Prepis):** *Ja ako učiteľ chcem mať voľbu buď len 'Uložiť nahrávku', alebo 'Uložiť a spracovať nahrávku', čo spustí model Whisper a zobrazí prepis.*
* **US-5 (Analýza a Štatistika):** *Ja ako učiteľ chcem stlačiť 'Analyzuj' a vidieť:*
  1. Porovnanie prepisu rozpoznávača s originálnym textom predlohy (chybné/vynechané slová).
  2. Vypočítané skóre zrozumiteľnosti reči.
  3. Porovnanie s minulým čítaním dieťaťa (ak už existujú staršie nahrávky).

---

## 4. Architektúra Obrazoviek Android Aplikácie

```text
[1. Entry Page (Vitajte)]
    ├── [Vytvoriť triedu] ──> [2. Manažment triedy]
    │                             ├── Pridanie žiaka: Meno, Priezvisko
    │                             └── Zoznam existujúcich žiakov v triede
    │
    ├── [Nahrávky] ─────────> [3. Zoznam nahrávok / História]
    │                             ├── Zoskupenie podľa detí
    │                             └── História záznamov s dátumami a skóre
    │
    └── [Spustiť čítanie] ──> [4. Recording Page]
                                  ├── Dropdown: Výber dieťaťa
                                  ├── Dropdown: Výber textu (T01, T02, T03...)
                                  ├── Ikona nastavení ──> [Setup Page] (WAV 16/44.1kHz, bitová hĺbka)
                                  ├── Tlačidlo [RECORD] (červené)
                                  ├── Tlačidlo [STOP]
                                  │
                                  └── Po zastavení:
                                        ├── [Uložiť nahrávku] (iba lokálne uloženie do priečinka)
                                        └── [Uložiť a spracovať nahrávku]
                                                  │
                                                  v
                                        [5. Obrazovka Prepisu a Analýzy]
                                              ├── Okno: Prepis čítaného textu (Whisper / Google API)
                                              ├── Tlačidlo [Analyzuj]
                                              └── Štatistiky:
                                                    * Porovnanie prepisu s textom predlohy
                                                    * Skóre zrozumiteľnosti
                                                    * Rýchlosť čítania (WPM) a pauzy
                                                    * Porovnanie s predchádzajúcim čítaním
```

---

## 5. Štruktúra Lokálneho Úložiska

```text
ReadAnalyzerData/
├── texty/
│   ├── T01.txt           # Štandardizovaná predloha 1
│   ├── T02.txt           # Štandardizovaná predloha 2
│   └── T03.txt           # Štandardizovaná predloha 3
│
└── deti/
    ├── Jan_Novak/
    │   ├── 2026-10-16_T01.wav
    │   ├── 2026-10-16_T01.json   # Výsledky: skóre, WPM, prepis
    │   └── 2026-11-20_T02.wav
    │
    └── Zuzana_Kovacova/
        └── 2026-10-16_T01.wav
```

---

## 6. Rozdelenie Úloh a Šprintov (Jira Mapovanie)

* **Frontend / Android Lead (Сергей Бойко):**
  * `RA-9`: Inicializácia Android aplikácie a úvodná obrazovka (Entry Page).
  * `RA-10`: Obrazovka nahrávania čítania (Recording Page) s výberom dieťaťa a textu.
  * `RA-15`: Obrazovka prepisu textu a štatistík.
  * `RA-16`: Nastavenia parametrov audia (Setup Page).

* **Backend / Core Logic (Alina Kuznetsova):**
  * `RA-7`: Manažment triedy a evidencia žiakov (Meno, Priezvisko).
  * `RA-8`: Modul lokálneho ukladania WAV do priečinka žiaka s dátumom.
  * `RA-13`: Pipeline prepojenia 'Uložiť a spracovať nahrávku'.
  * `RA-14`: Databáza SQLite/Room pre uchovávanie metadát a histórie.

* **ML / Data Engineer (dvisty):**
  * `RA-5`: Príprava sady textov (T01..T0X) a audit existujúceho datasetu 500 detí.
  * `RA-6`: Prepis slovenského audia cez Whisper (`kinit/whisper-large-v3-sk`) / Google Speech API.
  * `RA-11`: Algoritmus porovnania prepisu z ASR s predlohou textu (Word Error Rate / Text Diff).
  * `RA-12`: Výpočet WPM a dĺžky páuz z nahrávky.
  * `RA-18`: Dávkové spracovanie datasetu 500 detí na superpočítači.
