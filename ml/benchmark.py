import gc
import re
import time
from pathlib import Path

import librosa
import numpy as np
import pandas as pd
import soundfile as sf
import torch
from jiwer import cer, wer
from transformers import pipeline


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "ml" / "samples" / "dev_50.tsv"
OUTPUT_DIR = ROOT / "ml" / "output"

MODELS = {
    "whisper_large_v3_sk": ROOT / "ml" / "ai" / "whisper-large-v3-sk",
    "whisper_turbo_sk": ROOT / "ml" / "ai" / "turbo_sk_SCHD_final_0.124",
    "wav2vec2_sk": ROOT / "ml" / "ai" / "wav2vec2-xls-r-300m-sk-cv8-with-lm",
}


def load_audio(audio_path: Path, target_sampling_rate: int) -> np.ndarray:
    audio, sampling_rate = sf.read(audio_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1, dtype=np.float32)
    if sampling_rate != target_sampling_rate:
        audio = librosa.resample(
            audio, orig_sr=sampling_rate, target_sr=target_sampling_rate
        )
    return np.asarray(audio, dtype=np.float32)


def normalize_text(text: str) -> str:
    """Lowercase and remove punctuation for consistent WER/CER."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    return " ".join(text.split())


def load_manifest() -> pd.DataFrame:
    if not MANIFEST.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST}")

    manifest = pd.read_csv(MANIFEST, sep="\t")
    required = {"audio_path", "reference"}
    if not required.issubset(manifest.columns):
        raise ValueError("dev_50.tsv must contain audio_path and reference columns")

    manifest = manifest.dropna(subset=["audio_path", "reference"])
    if manifest.empty:
        raise ValueError("Manifest contains no valid samples.")

    manifest["audio_path"] = manifest["audio_path"].map(str)
    for relative_path in manifest["audio_path"]:
        audio_path = ROOT / relative_path
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
    return manifest


def transcribe_model(
    model_name: str, model_path: Path, manifest: pd.DataFrame, device: int
) -> list[dict]:
    if not model_path.is_dir():
        raise FileNotFoundError(f"Model directory not found: {model_path}")

    print(f"\nLoading {model_name}: {model_path}")
    recognizer = pipeline(
        "automatic-speech-recognition",
        model=str(model_path),
        device=device,
        dtype=torch.float16 if device >= 0 else torch.float32,
    )
    is_whisper = "whisper" in model_name
    rows = []

    for index, sample in manifest.iterrows():
        audio_path = ROOT / sample["audio_path"]
        print(f"[{index + 1}/{len(manifest)}] {model_name}: {audio_path.name}")

        start = time.perf_counter()
        audio = {
            "raw": load_audio(audio_path, recognizer.feature_extractor.sampling_rate),
            "sampling_rate": recognizer.feature_extractor.sampling_rate,
        }
        if is_whisper:
            prediction = recognizer(
                audio,
                generate_kwargs={"language": "slovak", "task": "transcribe"},
            )
        else:
            prediction = recognizer(audio)
        elapsed = time.perf_counter() - start
        predicted_text = prediction["text"].strip()
        reference = str(sample["reference"])

        rows.append(
            {
                "model": model_name,
                "audio_path": sample["audio_path"],
                "reference": reference,
                "prediction": predicted_text,
                "wer": wer(normalize_text(reference), normalize_text(predicted_text)),
                "cer": cer(normalize_text(reference), normalize_text(predicted_text)),
                "seconds": round(elapsed, 3),
            }
        )

    del recognizer
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return rows


def main():
    manifest = load_manifest()

    device = 0 if torch.cuda.is_available() else -1
    print(f"Device: {'cuda' if device == 0 else 'cpu'}")
    print(f"Samples: {len(manifest)}")

    rows = []
    for model_name, model_path in MODELS.items():
        rows.extend(transcribe_model(model_name, model_path, manifest, device))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = pd.DataFrame(rows)
    predictions_path = OUTPUT_DIR / "predictions.csv"
    summary_path = OUTPUT_DIR / "summary.csv"
    results.to_csv(predictions_path, index=False, encoding="utf-8-sig")

    summary = (
        results.groupby("model", as_index=False)
        .agg(
            samples=("audio_path", "count"),
            mean_wer=("wer", "mean"),
            mean_cer=("cer", "mean"),
            mean_seconds=("seconds", "mean"),
            total_seconds=("seconds", "sum"),
        )
    )
    summary.to_csv(summary_path, index=False, encoding="utf-8-sig")

    print("\n=== ASR BENCHMARK SUMMARY ===")
    print(summary.to_string(index=False))
    print(f"\nSaved predictions: {predictions_path}")
    print(f"Saved summary: {summary_path}")


if __name__ == "__main__":
    main()
