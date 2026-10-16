# 🎙️ Read Analyzer

> **Android aplikácia na nahrávanie a analýzu čítania žiakov na základných školách (ZŠ).**

Projekt tímu **Alpha-276 (Team Alpha)** v spolupráci s mentorom doc. Ing. Stanislavom Ondášom, PhD.

[![Jira Project](https://img.shields.io/badge/Jira-Read%20Analyzer%20(RA)-blue?logo=jira)](https://uvb.atlassian.net/jira/software/projects/RA/boards/2)
[![GitHub Team](https://img.shields.io/badge/GitHub-Alpha--276-black?logo=github)](https://github.com/Alpha-276)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎯 Hlavný Cieľ Projektu

Aplikácia pre učiteľov na tabletoch/smartfónoch (Android), ktorá umožňuje priamo v školskej triede:
1. **Spravovať triedu a zoznam žiakov** (Meno, Priezvisko).
2. **Nahrávať čítanie dieťaťa** podľa vopred zvolenej textovej predlohy (`T01`, `T02`, `T03`...) v nekomprimovanom formáte WAV (16kHz / 44.1kHz).
3. **Ukladať nahrávky lokálne** s povinným dátumom do priečinka každého žiaka (`/deti/{Meno_Priezvisko}/{YYYY-MM-DD}_{KodTextu}.wav`).
4. **Prepisovať reč** pomocou ASR modelu (Whisper pre slovenčinu / Google Speech API).
5. **Porovnávať prepis s originálnou textovou predlohou**, počítať rýchlosť čítania (WPM), skóre zrozumiteľnosti a sledovať pokrok dieťaťa v čase.

---

## 👥 Tím Alpha (Team Alpha)

* **Product Owner:** Artsiom Beniash ([@n0namedeveloper](https://github.com/n0namedeveloper))
* **Scrum Master:** yevhenii medushivskyi ([@yvhdpdngr276](https://github.com/yvhdpdngr276))
* **Android / Frontend Lead:** Sergei Boiko ([@sergiyboyko2006](https://github.com/sergiyboyko2006))
* **Backend / Core Engineer:** Alina Kuznetsova ([@val966](https://github.com/val966))
* **ML / Data Engineer:** dvisty ([@dvisty](https://github.com/dvisty))
* **Konzultant / Mentor:** doc. Ing. Stanislav Ondáš, PhD.

Riadenie šprintov prebieha na [Jira: Read Analyzer Board](https://uvb.atlassian.net/jira/software/projects/RA/boards/2).

---

## 📱 Architektúra a Tok Aplikácie

```text
[Entry page (Vitajte)]
    ├── [Vytvoriť triedu]  ──> Manažment triedy (Pridanie mena a priezviska žiaka)
    ├── [Nahrávky]         ──> Lokálny archív nahrávok zoradený podľa detí a dátumov
    └── [Spustiť čítanie]  ──> Výber dieťaťa + Výber textu (T01..T0X)
                                 ├── Nastavenie kvality audia (.wav 16/44.1kHz)
                                 ├── Tlačidlá [RECORD] / [STOP]
                                 ├── [Uložiť nahrávku] (iba lokálne)
                                 └── [Uložiť a spracovať nahrávku]
                                           └── Prepis (Whisper) + Porovnanie s predlohou textu
```

Podrobná špecifikácia požiadaviek sa nachádza v dokumente: [`docs/PRD.md`](docs/PRD.md).
