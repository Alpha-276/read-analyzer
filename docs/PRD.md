# Product Requirements Document (PRD)

# 🎙️ Read Analyzer: Ekosystém pre Zber a Analýzu Reči Žiakov ZŠ

* **Názov produktu:** Read Analyzer
* **Verzia dokumentu:** 2.1.0 (Aktualizácia po mítingu s mentorom — 22.10.2026)
* **Dátum:** Október 2026
* **Cieľová architektúra:** Mobilný Android klient (terén) + Vzdialený analytický server + Webový dashboard (špecialisti) + Google Drive
* **Product Owner:** Artsiom Beniash
* **Tím:** Alpha-276 (Team Alpha)
* **Konzultant / Mentor:** doc. Ing. Stanislav Ondáš, PhD.
* **Jira Board:** [RA Board](https://uvb.atlassian.net/jira/software/projects/RA/boards/2)
* **GitLab TUKE:** [git.kpi.fei.tuke.sk/alpha/read-analyzer](https://git.kpi.fei.tuke.sk/alpha/read-analyzer)
* **GitHub Mirror:** [Alpha-276/read-analyzer](https://github.com/Alpha-276/read-analyzer)

---

## 1. Celková Architektúra Ekosystému

Na základe požiadaviek zákazníka je systém rozdelený na tri kooperujúce vrstvy:

```text
       ┌─────────────────────────────────────────────────────────┐
       │             1. MOBILNÝ KLIENT (Android App)             │
       │                (Učiteľ v školskej triede)               │
       │ - Nahrávanie nekomprimovaného WAV (16 / 44.1 kHz)       │
       │ - Výber cieľového priečinka v zariadení (SAF)           │
       │ - Lokálna SQLite databáza (plná funkčnosť offline)      │
       │ - Pripájanie textových poznámok k nahrávkam             │
       │ - Synchronizácia na server a záloha do Google Drive     │
       └────────────────────────────┬────────────────────────────┘
                                    │
                        (Obojsmerná synchronizácia)
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             2. VZDIALENÝ ANALYTICKÝ SERVER              │
       │             (FastAPI / GPU výpočtový uzol)              │
       │ - Centrálne úložisko dát a tried                        │
       │ - Multimodelový ASR pipeline:                           │
       │     * Model 1: Slovak Whisper (kinit/whisper-large-v3)  │
       │     * Model 2: Google Cloud Speech-to-Text API          │
       │ - Porovnávací engine: prepis vs. textová predloha (T0X) │
       │ - Výpočet metrík (WPM, pauzy, skóre zrozumiteľnosti)    │
       └────────────────────────────┬────────────────────────────┘
                                    │
                               (REST API)
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             3. WEBOVÁ ANALYTICKÁ APLIKÁCIA              │
       │       (Logopédi, výskumníci, špeciálni pedagógovia)     │
       │ - Detailná analýza zvukových nahrávok a spektrogramov   │
       │ - Porovnanie výsledkov viacerých ASR modelov            │
       │ - Prehľad poznámok učiteľov z terénu                    │
       │ - Dlhodobé trendy dieťaťa a export odborných reportov   │
       └─────────────────────────────────────────────────────────┘
```

---

## 2. Kľúčové Požiadavky z Mítingu (22.10.2026)

1. **Vzdialený analytický server:** Náročný výpočtový proces (ASR a analýza) je presunutý z mobilného zariadenia na server.
2. **Lokálna databáza a synchronizácia:** Mobilná aplikácia ukladá triedy, žiakov a záznamy do lokálnej SQLite databázy a po pripojení k internetu sa synchronizuje so vzdialeným serverom.
3. **Výber cieľového priečinka:** Učiteľ si môže v nastaveniach zvoliť vlastný priečinok v zariadení na ukladanie nahrávok (Storage Access Framework).
4. **Presun rozpoznávania do webu/servera:** Mobil nahráva a ukladá; rozpoznávanie a hĺbková analýza prebiehajú na serveri a zobrazujú sa vo webovom rozhraní.
5. **Analytická webová aplikácia pre novú cieľovú skupinu:** Web je primárne určený pre logopédov, výskumníkov a metodikov (nie je to len zjednodušený tabletový pohľad učiteľa, ale expertný nástroj).
6. **Integrácia s Google Drive a ekosystémom Google:** Možnosť automatickej zálohy nahrávok a dát tried priamo na Google Drive školy.
7. **Multimodelový prístup pri analýze:** Podpora viacerých modelov (Whisper vs. Google Speech-to-Text) s možnosťou porovnania ich prepisov.
8. **Poznámky k nahrávkam:** Možnosť pripojiť textovú poznámku k čítaniu (napr. zdravotný stav, únava, rušivé vplyvy v triede).

---

## 3. Špecifikácia Modulov

### 3.1 Mobilná Aplikácia (Android)
* **Záznam zvuku:** Nekomprimovaný PCM WAV (16/44.1 kHz, 16-bit).
* **Poznámky k čítaniu:** Vstupné pole `Poznámka` na obrazovke nahrávania.
* **Správa úložísk:** Voľba predvoleného adresára v Android OS.
* **Offline režim:** Všetky dáta sú lokálne v SQLite. Synchronizačný stav: `Synced` / `Pending`.

### 3.2 Vzdialený Analytický Server
* **REST API:**
  * `POST /api/v1/sync/push` — príjem nových nahrávok a tried z mobilu.
  * `GET /api/v1/sync/pull` — aktualizácia zoznamov zo servera.
  * `POST /api/v1/analyze` — spustenie multimodelového rozpoznávania.
* **Multimodelový ASR Runner:**
  * Engine 1: Slovak Whisper (`kinit/whisper-large-v3-sk`).
  * Engine 2: Google Cloud Speech-to-Text (Slovak language code: `sk-SK`).
* **Text Comparison:** Levenshtein / Word Error Rate diff oproti predlohe (`T01..T0X`).

### 3.3 Webová Aplikácia (Expertný Dashboard)
* **Cieľová skupina:** Školskí logopédi, výskumníci a detskí psychológovia.
* **Funkcie:**
  * Prehrávač s vizualizáciou zvukovej stopy.
  * Porovnávací pohľad na prepisy (Whisper vs. Google Speech API).
  * Zvýraznenie chýb čítania voči predlohe.
  * Prehľad textových poznámok zadaných učiteľom pri nahrávaní.

---

## 4. Mapovanie Úloh v Šprinte 2 (Jira)

* **Alina Kuznetsova (Backend & Sync):**
  * `RA-13`: Vzdialený analytický server a synchronizačné rozhranie s mobilom.
  * `RA-14`: Lokálna SQLite databáza a offline synchronizácia.
  * `RA-26`: Integrácia so službami Google Drive a ekosystémom Google.

* **Сергей Бойко (Mobile & Web Frontend):**
  * `RA-24`: Výber vlastného priečinka pre ukladanie nahrávok a textové poznámky k čítaniu.
  * `RA-25`: Vývoj analytickej webovej aplikácie pre výskumníkov a logopédov.
  * `RA-15`: Obrazovka po nahrávaní a prepojenie s lokálnym úložiskom.
  * `RA-23`: Obrazovka 'Manažment triedy' a správa žiakov.

* **dvisty (ML & Speech Engines):**
  * `RA-11`: Multimodelové rozpoznávanie: podpora viacerých modelov (Whisper vs. Google Speech API).
  * `RA-5`: Príprava sady čítaných textov (T01..T0X) a audit slovenského datasetu.
  * `RA-12`: Výpočet rýchlosti čítania (WPM) a detekcia páuz z WAV nahrávky.
