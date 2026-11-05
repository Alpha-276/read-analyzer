# Технический аудит и код-ревью: Дмитрий Чалых (`dvisty`)

- **Роль:** ML Engineer / Разработчик модуля распознавания речи (ASR)
- **Основной скоуп:** `ml/benchmark.py`, `ml/requirements.txt`, `ml/README.md`, `ml/ai/README.md`, `ml/samples/manifest.tsv`
- **Связанные задачи Jira:** [RA-6](https://uvb.atlassian.net/browse/RA-6), [RA-11](https://uvb.atlassian.net/browse/RA-11), [RA-12](https://uvb.atlassian.net/browse/RA-12)

---

## 1. Общий вердикт и резюме
Дмитрий успешно выбрал актуальные модели ASR для словацкого языка (`Whisper-large-v3-sk`, `Whisper-Turbo`, `wav2vec2-xls-r-300m-sk-cv8-with-lm`) и настроил вычисление стандартных метрик качества (WER/CER). Однако текущий скрипт бенчмарка написан как сугубо локальный одноразовый скрипт («работает только на моём компьютере») и не готов к командному использованию, интеграции в CI или передаче заказчику.

---

## 2. Критические замечания (Blockers)

### 2.1. Жестко захардкоженные локальные пути к весам (скрипт падает у всех остальных)
В файле [`ml/benchmark.py`](file:///D:/Dev/read-analyzer/ml/benchmark.py#L19-L23):
```python
MODELS = {
    "whisper_large_v3_sk": ROOT / "ml" / "ai" / "whisper-large-v3-sk",
    "whisper_turbo_sk": ROOT / "ml" / "ai" / "turbo_sk_SCHD_final_0.124",
    "wav2vec2_sk": ROOT / "ml" / "ai" / "wav2vec2-xls-r-300m-sk-cv8-with-lm",
}
```
И проверка на строках 79–80:
```python
if not model_path.is_dir():
    raise FileNotFoundError(f"Model directory not found: {model_path}")
```
* **Суть проблемы:** Веса моделей весят десятки гигабайт и отсутствуют в репозитории. В коде **нет ни fallback-скачивания с Hugging Face Hub**, ни передачи путей через аргументы CLI (`argparse`), ни через переменные окружения.
* **Последствие:** Любой другой разработчик, ментор или сервер CI при попытке выполнить `python ml/benchmark.py` сразу получает фатальную ошибку `FileNotFoundError: Model directory not found`.

### 2.2. Недекларированная зависимость от системного бинарника `ffmpeg`
В [`ml/benchmark.py`](file:///D:/Dev/read-analyzer/ml/benchmark.py#L26-L45):
```python
def load_audio(audio_path: Path, target_sr: int):
    command = [
        "ffmpeg",
        "-v", "error",
        "-i", str(audio_path),
        "-f", "f32le",
        "-ac", "1",
        "-ar", str(target_sr),
        "pipe:1",
    ]
    result = subprocess.run(command, capture_output=True, check=True)
    ...
```
* **Суть проблемы:** Скрипт требует установленного в операционной системе `ffmpeg` в глобальном `PATH`. При его отсутствии скрипт падает с неинформативной системной ошибкой (`[WinError 2] The system cannot find the file specified`).
* **Несоответствие:** При этом в строке 6 импортируется библиотека `librosa`, которая способна декодировать аудио самостоятельно, но в коде вообще не используется.

---

## 3. Архитектурные и научные проблемы

### 3.1. Репрезентативность бенчмарка: выборка из 1 файла
В файле [`ml/samples/manifest.tsv`](file:///D:/Dev/read-analyzer/ml/samples/manifest.tsv) содержится **всего 1 аудиозапись**. 
* В критериях приемки (Acceptance Criteria) [RA-11](https://uvb.atlassian.net/browse/RA-11) прямо указано: отобрать 10–20 записей разного качества для валидной оценки.
* Считать средний WER/CER по выборке из одного сэмпла недопустимо для научного проекта.

### 3.2. Грубая нормализация текста для словацкого языка
В функции `normalize_text` (строки 48–52):
```python
def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    return " ".join(text.split())
```
* Стираются дефисы (`čierno-biely` превращается в `čiernobiely`).
* Не обрабатываются словацкие парные кавычки (`„ “`), числа («5» vs «päť»), апострофы.
* Если одна модель выдает расшифровку без диакритики, а эталон с диакритикой, метрика WER подскакивает в разы, что искажает сравнительный анализ.

### 3.3. Отсутствие обработки ошибок внутри цикла инференса
Если при обработке 15-го файла из 20 возникнет Out Of Memory (OOM) на GPU или аудиофайл окажется битым, весь скрипт аварийно завершится, а результаты предыдущих 14 файлов будут утеряны. Необходим блок `try...except` на уровне отдельного сэмпла.

---

## 4. Качество кода и документации

1. **Неиспользуемый импорт:** Строка 6 `import librosa` — мертвый импорт.
2. **Ошибки копипасты в исключениях:**
   В строке 62:
   ```python
   raise ValueError("dev_50.tsv must contain audio_path and reference columns")
   ```
   Файл называется `manifest.tsv`, но в сообщении об ошибке остался старый `dev_50.tsv`.
3. **Рассинхрон `ml/README.md` с кодом:**
   - В README указано, что скрипт читает `data/benchmark_100/manifest.csv` и запускает `infinitejoy/wav2vec2-large-xls-r-300m-slovak`. По факту скрипт читает `ml/samples/manifest.tsv` и использует три другие модели.
   - В строке 133 `ml/README.md` команда установки содержит невалидный синтаксис:
     `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130    (CUDA)` — слово `(CUDA)` ломает копирование в терминал.
4. **Файл-пустышка:** В `ml/ai/README.md` строка 3: `whisper_turbo_sk: -`. Нет ни ссылки, ни описания источника модели.

---

## 5. Git-гигиена
В коммите `50283a1` Дмитрий закоммитил системные файлы кэша сборки Gradle:
`frontend/modules/wav-recorder/android/.gradle/9.7.1/checksums/checksums.lock` и др.
Перед выполнением `git commit` необходимо проверять `git status` и не использовать слепой `git add .`.

---

## 6. План действий (Action Items)

1. **Параметризовать источники моделей:**
   ```python
   DEFAULT_MODELS = {
       "whisper_large_v3_sk": "kinit/whisper-large-v3-sk",
       "wav2vec2_sk": "anuragshas/wav2vec2-xls-r-300m-sk-cv8-with-lm",
   }
   ```
   Добавить проверку: если локальная папка существует — брать её, иначе загружать с Hugging Face Hub по идентификатору.
2. **Проверять наличие `ffmpeg` или использовать `soundfile`:**
   Либо обрабатывать `shutil.which("ffmpeg")` с понятным сообщением, либо использовать `torchaudio.load()` / `soundfile.read()`.
3. **Расширить датасет:** Добавить в `manifest.tsv` минимум 15–20 эталонных записей от Indícia.
4. **Написать тесты:** Создать `ml/tests/test_benchmark.py` для тестирования `normalize_text` и валидации схемы манифеста.
