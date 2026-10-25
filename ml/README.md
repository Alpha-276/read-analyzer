# 🧠 Read Analyzer — Machine Learning & ASR Benchmark Module

This module contains tools, scripts, and evaluation pipelines for Automatic Speech Recognition (ASR) benchmarking within the **Read Analyzer** project, specifically optimized for Slovak speech.

---

## 📋 Overview

The primary purpose of this module is to benchmark and evaluate Slovak speech recognition models against reading datasets. The benchmarking pipeline computes transcription accuracy and computational throughput, providing data-driven metrics for selecting and tuning ASR models used in child reading analysis (e.g., calculating reading speed (WPM), speech intelligibility, and reading mistake tracking).

### 🤖 Model Specification

- **Model Identifier**: [`infinitejoy/wav2vec2-large-xls-r-300m-slovak`](https://huggingface.co/infinitejoy/wav2vec2-large-xls-r-300m-slovak)
- **Architecture**: Facebook Wav2Vec 2.0 (XLS-R 300M checkpoint fine-tuned on Slovak speech corpora)
- **Audio Requirements**: 16 kHz sampling rate, single-channel (mono)
- **Hardware Acceleration**: Automatic device detection — utilizes CUDA GPU (`cuda:0`) if available, falling back to CPU (`cpu`).

---

## 📁 Directory Structure & Layout

```text
read-analyzer/
├── data/
│   └── benchmark_100/             # Benchmark audio dataset (local / not tracked in git)
│       ├── manifest.csv           # Benchmark manifest referencing audio samples
│       └── *.mp3 / *.wav          # Audio recordings
├── ml/
│   ├── benchmark.py               # Main ASR benchmarking and evaluation script
│   ├── requirements.txt           # Python dependencies for the ML module
│   ├── README.md                  # Module documentation (this file)
│   └── samples/
│       └── manifest.csv           # Reference / template manifest with sample entries
└── results/
    └── benchmark/                 # Output directory generated upon execution
        ├── predictions.csv        # Detailed per-sample predictions & error rates
        └── summary.csv            # Aggregated benchmark metrics
```

---

## 📊 Dataset & Manifest Schema

The benchmark script expects a dataset manifest located at `data/benchmark_100/manifest.csv`.

### Manifest Format (`manifest.csv`)

The manifest is a comma-separated CSV with two required columns:

| Column | Type | Description |
| :--- | :--- | :--- |
| `audio_path` | `string` | Relative path from the repository root to the audio file (e.g. `data/benchmark_100/sample.mp3`) |
| `reference` | `string` | Ground-truth reference text (transcription or reading prompt) |

#### Example Manifest Rows:
```csv
audio_path,reference
data/benchmark_100/common_voice_sk_25749945.mp3,"Keď vás vyrušia, intuitívne si siahnete na ucho."
data/benchmark_100/common_voice_sk_25647005.mp3,"klobúk"
```

A reference template is available at [`ml/samples/manifest.csv`](samples/manifest.csv).

---

## ⚙️ Installation & Setup

### 1. Prerequisites

- Python 3.10+
- Virtual environment manager (`venv` or `conda`)
- *(Optional)* NVIDIA GPU with CUDA support for accelerated inference

### 2. Create and Activate Virtual Environment

From the repository root:

```bash
# Create virtual environment
python -m venv .venv

# Activate on Linux / macOS:
source .venv/bin/activate

# Activate on Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Activate on Windows (Command Prompt):
.venv\Scripts\activate.bat
```

### 3. Install Dependencies

Install the required Python packages:

```bash
pip install --upgrade pip
pip install -r ml/requirements.txt
```

> **Note (PyTorch with CUDA):** If running with GPU acceleration, ensure your PyTorch installation matches your installed CUDA version. Refer to [pytorch.org](https://pytorch.org/get-started/locally/) for specific wheel installation commands.

---

## 🚀 Running the Benchmark

Run the benchmark script from the **repository root**:

```bash
python ml/benchmark.py
```

### Execution Flow:
1. **Validation**: Verifies the presence of `data/benchmark_100/manifest.csv` and checks that all referenced audio files exist.
2. **Model Loading**: Initializes the Hugging Face ASR pipeline with `infinitejoy/wav2vec2-large-xls-r-300m-slovak` on the detected device (CUDA or CPU).
3. **Audio Preprocessing**: Loads and resamples audio files to 16,000 Hz mono using `librosa`.
4. **Inference & Evaluation**:
   - Performs speech-to-text inference and tracks processing duration.
   - Applies text normalization (lowercasing, punctuation stripping, whitespace trimming).
   - Computes **WER** (Word Error Rate) and **CER** (Character Error Rate) via `jiwer`.
5. **Output Generation**: Exports per-sample predictions and aggregated metrics to `results/benchmark/`.

---

## 📈 Evaluation Metrics & Normalization

To ensure objective and consistent error rate calculations, both reference and predicted texts undergo normalization prior to metric computation:

- **Lowercasing**: Text is converted to lowercase.
- **Punctuation Removal**: Punctuation symbols are stripped using Unicode regex (`re.sub(r"[^\w\s]", "", text)`).
- **Whitespace Collapsing**: Redundant whitespace and trailing spaces are removed.

### Evaluated Metrics:

- **Word Error Rate (WER)**: Proportion of word insertions, deletions, and substitutions relative to the reference length.
- **Character Error Rate (CER)**: Proportion of character edits relative to total reference characters.
- **Inference Latency**: Per-sample elapsed time (seconds), mean inference duration, and total execution time.

---

## 📄 Output Artifacts

Upon completion, outputs are saved into `results/benchmark/`:

### 1. `results/benchmark/predictions.csv`
Detailed results for each audio sample:
- `audio_path`: Relative path to the audio file.
- `reference`: Ground-truth text.
- `wav2vec_text`: Raw model transcription.
- `wav2vec_wer`: Sample Word Error Rate.
- `wav2vec_cer`: Sample Character Error Rate.
- `wav2vec_seconds`: Inference runtime for the sample in seconds.

### 2. `results/benchmark/summary.csv`
Overall benchmark summary:
- `model`: Evaluated model identifier.
- `samples`: Total number of evaluated audio samples.
- `mean_wer`: Average Word Error Rate across all samples.
- `mean_cer`: Average Character Error Rate across all samples.
- `mean_seconds`: Average inference duration per sample.
- `total_seconds`: Total benchmark processing time.

---

## 🛠️ Troubleshooting & Notes

- **`FileNotFoundError: Manifest not found`**: Ensure that `data/benchmark_100/manifest.csv` exists and that audio files are placed according to the paths in the manifest.
- **`Audio file not found`**: Check that all relative paths in `manifest.csv` start from the project root (`data/benchmark_100/...`).
- **Resource Considerations**: Audio files, downloaded model weights (cache), and output directories (`results/`) are excluded from version control to keep repository size minimal.
