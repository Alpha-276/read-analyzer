import re
import time
from pathlib import Path

import librosa
import pandas as pd
import torch
from jiwer import wer, cer
from transformers import pipeline

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "benchmark_100" / "manifest.csv"
OUTPUT_DIR = ROOT / "results" / "benchmark"
MODEL_NAME = "infinitejoy/wav2vec2-large-xls-r-300m-slovak"


def normalize_text(text: str) -> str:
    """Lowercase and remove punctuation for consistent WER/CER."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    return " ".join(text.split())


def main():
    if not MANIFEST.exists():
        raise FileNotFoundError(f"Manifest not found: {MANIFEST}")

    manifest = pd.read_csv(MANIFEST)
    required = {"audio_path", "reference"}
    if not required.issubset(manifest.columns):
        raise ValueError("manifest.csv must contain audio_path and reference columns")

    manifest = manifest.dropna(subset=["audio_path", "reference"])
    if manifest.empty:
        raise ValueError("Manifest contains no valid samples.")

    for relative_path in manifest["audio_path"]:
        audio_path = ROOT / str(relative_path)
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

    device = 0 if torch.cuda.is_available() else -1
    print(f"Device: {'cuda' if device == 0 else 'cpu'}")
    print(f"Samples: {len(manifest)}")
    print(f"Loading model: {MODEL_NAME}")

    recognizer = pipeline(
        "automatic-speech-recognition",
        model=MODEL_NAME,
        device=device,
    )

    rows = []
    for _, sample in manifest.iterrows():
        audio_path = ROOT / str(sample["audio_path"])
        reference = str(sample["reference"])
        print(f"\n[{len(rows) + 1}/{len(manifest)}] {audio_path.name}")

        audio, _ = librosa.load(str(audio_path), sr=16000, mono=True)

        start = time.perf_counter()
        prediction = recognizer({"raw": audio, "sampling_rate": 16000})
        elapsed = time.perf_counter() - start
        predicted_text = prediction["text"].strip()

        ref_norm = normalize_text(reference)
        pred_norm = normalize_text(predicted_text)
        sample_wer = wer(ref_norm, pred_norm)
        sample_cer = cer(ref_norm, pred_norm)

        rows.append({
            "audio_path": str(sample["audio_path"]),
            "reference": reference,
            "wav2vec_text": predicted_text,
            "wav2vec_wer": sample_wer,
            "wav2vec_cer": sample_cer,
            "wav2vec_seconds": round(elapsed, 3),
        })

        print(f"Reference: {reference}")
        print(f"Prediction: {predicted_text}")
        print(f"WER: {sample_wer:.4f} | CER: {sample_cer:.4f}")
        print(f"Inference time: {elapsed:.3f} s")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = pd.DataFrame(rows)
    predictions_path = OUTPUT_DIR / "predictions.csv"
    summary_path = OUTPUT_DIR / "summary.csv"
    results.to_csv(predictions_path, index=False, encoding="utf-8-sig")

    summary = pd.DataFrame([{
        "model": MODEL_NAME,
        "samples": len(results),
        "mean_wer": results["wav2vec_wer"].mean(),
        "mean_cer": results["wav2vec_cer"].mean(),
        "mean_seconds": results["wav2vec_seconds"].mean(),
        "total_seconds": results["wav2vec_seconds"].sum(),
    }])
    summary.to_csv(summary_path, index=False, encoding="utf-8-sig")

    print("\n=== WAV2VEC BENCHMARK SUMMARY ===")
    print(summary.to_string(index=False))
    print(f"\nSaved predictions: {predictions_path}")
    print(f"Saved summary: {summary_path}")


if __name__ == "__main__":
    main()
