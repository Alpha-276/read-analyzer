# 🎙️ Read Analyzer

> **Intelligent voice analysis and speech development monitoring system for school students.**

Developed by team **Alpha-276 (Team Alpha)** as part of a 10-week development cycle (5 two-week sprints).

[![Jira Project](https://img.shields.io/badge/Jira-Read%20Analyzer%20(RA)-blue?logo=jira)](https://uvb.atlassian.net/jira/software/projects/RA/boards/2)
[![GitHub Team](https://img.shields.io/badge/GitHub-Alpha--276-black?logo=github)](https://github.com/Alpha-276)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎯 Objectives & Value Proposition

* **Problem:** Elementary and middle school teachers find it difficult to manually detect subtle articulation issues, stuttering, vocabulary deficiencies, and speech tempo/rhythm anomalies across dozens of students.
* **Solution:** An automated platform that accepts voice recordings of children reading or speaking, transcribes speech using Automatic Speech Recognition (ASR), and detects speech development indicators:
  * Abnormally long pauses and speech hesitancy.
  * Syllable and word repetitions (stuttering indicators).
  * Speech rate (Words Per Minute — WPM).
  * Lexical diversity and vocabulary breadth.
  * Historical progress tracking across quarters and school years.
* **Dataset:** 2-year longitudinal voice recordings from 500 children, utilized for model calibration and supercomputer batch experiments.

---

## 👥 Team Alpha

* **Product Owner:** Artsiom Beniash
* **Scrum Master:** yevhenii medushivskyi
* **Frontend Lead:** Sergei Boiko
* **Backend Engineer:** Alina Kuznetsova
* **ML / Data Engineer:** *TBD*

Sprint management and task tracking are hosted on [Jira: Read Analyzer Board](https://uvb.atlassian.net/jira/software/projects/RA/boards/2).

---

## 🏗️ Monorepo Architecture

The repository is organized as a modular monorepo:

```text
read-analyzer/
├── backend/            # Server-side application (FastAPI, PostgreSQL, background worker)
│   ├── app/            # API endpoints, data models, and business logic
│   └── tests/          # Unit and integration tests
│
├── frontend/           # Teacher dashboard web application (React / Vite / Tailwind)
│   └── src/            # Components, analytics dashboards, audio player
│
├── ml/                 # Audio processing and ML pipelines
│   ├── pipeline/       # Whisper inference, noise reduction, pause extraction
│   ├── scripts/        # SLURM batch job scripts for supercomputer
│   └── samples/        # Lightweight audio samples for testing
│
├── .github/workflows/  # CI/CD pipelines (linters, test automation)
├── docker-compose.yml  # Local multi-container development environment
└── README.md           # Project documentation
```

---

## 🚀 Quick Start

### Prerequisites
* **Python** 3.11+
* **Node.js** 20+
* **Docker & Docker Compose** (optional, for local database container)

### 1. Clone the repository
```bash
git clone https://github.com/Alpha-276/read-analyzer.git
cd read-analyzer
```

### 2. Run Backend
```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive API documentation (Swagger UI): `http://localhost:8000/docs`

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📋 Git Workflow Guidelines

1. **`main` branch is protected:** Direct commits to `main` are restricted. All code enters via Pull Request (PR) with at least 1 review approval.
2. **Branch naming linked to Jira issues:**
   * `feature/RA-5-dataset-validation`
   * `feature/RA-7-backend-init`
   * `feature/RA-9-frontend-init`
   * `bugfix/RA-XX-fix-audio-upload`
3. **Data hygiene:**  
   Raw dataset files (`*.wav`, `*.mp3`) and neural network model weights (`*.pt`, `*.bin`, `*.safetensors`) must **never** be committed to Git. Use short (< 5s) test audio clips located in `ml/samples/`.

---

## 📈 Sprint Roadmap

* **Sprint 1:** Architecture skeleton, audio upload API, UI foundation, 500-child dataset audit.
* **Sprint 2:** End-to-end Whisper ASR transcription pipeline, WPM and pause calculations, synced audio player.
* **Sprint 3:** Stuttering/anomaly detection algorithms, supercomputer SLURM batch scripts, student profiles, PDF report export.
* **Sprint 4:** Comprehensive speech progress dashboard, stress testing, inference optimization.
* **Sprint 5:** Bug fixing, load testing, final documentation, and demo presentation prep.
