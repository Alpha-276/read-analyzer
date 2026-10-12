# Machine Learning & Audio Processing (Read Analyzer)

Audio preprocessing, Automatic Speech Recognition (ASR), and speech development anomaly detection.

## Sprint 1 Goals
* [RA-5](https://uvb.atlassian.net/browse/RA-5): 500-child audio dataset format exploration & validation.
* [RA-6](https://uvb.atlassian.net/browse/RA-6): Whisper (tiny/base/small) benchmark on children's speech.

## Dataset Management (CRITICAL)
* ⚠️ **Do not push raw dataset audio files to GitHub.**
* Store the primary dataset locally in `data/` (ignored by git) or on the supercomputer cluster.
* Use short (< 5s) test clips in `ml/samples/` for unit tests and CI.

## Installation
```bash
pip install -r requirements.txt
```
