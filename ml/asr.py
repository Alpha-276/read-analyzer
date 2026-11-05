"""ASR interface used by RA-13.

The backend relies only on transcribe(audio_path) -> str. A new model can
replace the implementation without changing the API or React Native code.
"""

import os
from functools import lru_cache
from pathlib import Path
from threading import Lock


DEFAULT_MODEL = "infinitejoy/wav2vec2-large-xls-r-300m-slovak"
SAMPLE_RATE = 16_000
_inference_lock = Lock()


@lru_cache(maxsize=1)
def _get_recognizer():
    """Load the current model once, at its first use."""
    import torch
    from transformers import pipeline

    model_name = os.getenv("READ_ANALYZER_ASR_MODEL", DEFAULT_MODEL)
    device = 0 if torch.cuda.is_available() else -1
    return pipeline("automatic-speech-recognition", model=model_name, device=device)


def transcribe(audio_path: str | Path) -> str:
    """Transcribe a WAV file to plain text (Slovak speech)."""
    import librosa

    audio, _ = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
    if len(audio) == 0:
        raise ValueError("Audio recording is empty")

    # A single shared model instance is not invoked concurrently.
    with _inference_lock:
        prediction = _get_recognizer()({"raw": audio, "sampling_rate": SAMPLE_RATE})

    return str(prediction["text"]).strip()
