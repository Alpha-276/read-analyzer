# Технический аудит и код-ревью: Алина Кузнецова (`val966`)

- **Роль:** Backend & Fullstack Engineer / Разработчик серверной аналитики и облачной синхронизации
- **Основной скоуп:** `backend/app/*`, `backend/Dockerfile`, `frontend/services/*sync*`, `frontend/services/*drive*`, `frontend/screens/GoogleDriveScreen.tsx`
- **Связанные задачи Jira:** [RA-7](https://uvb.atlassian.net/browse/RA-7), [RA-13](https://uvb.atlassian.net/browse/RA-13), [RA-14](https://uvb.atlassian.net/browse/RA-14), [RA-26](https://uvb.atlassian.net/browse/RA-26), [RA-28](https://uvb.atlassian.net/browse/RA-28)

---

## 1. Общий вердикт и резюме
Алина проделала огромный объем работы: создала полноценный протокол оптимистичной синхронизации (push/pull с tombstone-удалениями), написала FastAPI-сервер с очередью фоновых задач, настроила Docker-окружение и реализовала клиент к Google Drive v3 API. 

Однако в архитектуре серверной части и синхронизации присутствуют критические проблемы с многопоточностью, производительностью базы данных и безопасностью, которые приведут к сбоям при боевой эксплуатации 150 учителями.

---

## 2. Критические замечания (Blockers & Performance)

### 2.1. Блокирующий синхронный I/O внутри асинхронных эндпоинтов FastAPI
В эндпоинте [`backend/app/main.py`](file:///D:/Dev/read-analyzer/backend/app/main.py#L83-L112):
```python
@app.post('/api/v1/transcribe', ...)
async def transcribe_upload(file: UploadFile = File(...), ...):
    ...
    with store.connect() as db:           # СИНХРОННЫЙ вызов базы в async def!
        exists = db.execute(...)
    with target.open('wb') as output:
        while block := await file.read(1024 * 1024):
            output.write(block)           # СИНХРОННАЯ запись на диск!
    with wave.open(str(target), 'rb') as wav:  # СИНХРОННЫЙ парсинг аудио!
```
* **Суть проблемы:** Функция объявлена как `async def`, но внутри выполняются синхронные дисковые операции и синхронные запросы к SQLite.
* **Последствие:** Запись 30 МБ аудиофайла и парсинг заголовков `wave.open` блокируют единый Event Loop сервера. В это время сервер не может отвечать на запросы других пользователей (даже на `/health`). Либо функция должна быть синхронной (`def`), чтобы FastAPI запускал её в threadpool, либо I/O должен быть асинхронным (`aiofiles`).

### 2.2. Использование SQLite с внутрипроцессным `RLock` на бэкенде
В файле [`backend/app/services/store.py`](file:///D:/Dev/read-analyzer/backend/app/services/store.py#L13-L32):
```python
_LOCK = threading.RLock()
```
* **Суть проблемы:** Исходная архитектура предполагала PostgreSQL. Сейчас используется локальный SQLite-файл с внутрипроцессной блокировкой `RLock()`.
* **Последствие:** При запуске Uvicorn в продакшене с несколькими рабочими процессами (`--workers 2+`) внутрипроцессный `RLock` не защищает от конкурентного доступа разных процессов ОС. База данных начнет выбрасывать `sqlite3.OperationalError: database is locked`.

### 2.3. Монолитная модель безопасности с единым статическим токеном
В [`backend/app/main.py`](file:///D:/Dev/read-analyzer/backend/app/main.py#L22-L29):
* Вся безопасность держится на одном статическом ключе `RA_API_TOKEN`.
* Нет понятия учётных записей учителей, сессий, JWT или разделения прав.
* Если хотя бы один учитель или сторонний человек случайно скомпрометирует токен, злоумышленник получит доступ к полному дампу данных всех школ, классов, заметок и аудиозаписей детей.

### 2.4. Неконтролируемый рост таблицы событий (`sync_events`)
В [`backend/app/services/store.py`](file:///D:/Dev/read-analyzer/backend/app/services/store.py#L54-L58):
* Каждое изменение в мобильном приложении порождает неуничтожимую запись в таблице `sync_events`.
* Отсутствует механизм компактизации (compact), ротации или очистки старых событий (tombstone vacuum). При работе десятков классов база начнет лавинообразно увеличиваться в объеме.

---

## 3. Архитектурные расхождения с требованиями заказчика

### 3.1. Реализация функционала «Share with Colleague», прямо отвергнутого заказчиком
В [`frontend/services/googleDriveApi.ts`](file:///D:/Dev/read-analyzer/frontend/services/googleDriveApi.ts#L146-L153) реализована функция:
```typescript
export async function shareWithColleague(email: string, fileId: string, colleagueEmail: string): Promise<void>
```
* На встрече с заказчиком (Indícia) и в постановке задачи [RA-28](https://uvb.atlassian.net/browse/RA-28) было четко зафиксировано: *«Funkcia posielania nahrávky kolegovi odstránená (nie je potrebná)»*.
* В проект был включен функционал, который заказчик прямо просил исключить.

### 3.2. Жесткая зависимость от необязательного `EXPO_PUBLIC_API_URL`
В [`frontend/services/serverAuth.ts`](file:///D:/Dev/read-analyzer/frontend/services/serverAuth.ts#L14-L18):
```typescript
export function getServerUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!url || !/^https?:\/\//.test(url)) throw new Error('Nastavte EXPO_PUBLIC_API_URL.');
  return url;
}
```
* Если мобильное приложение запущено без предварительно созданного `.env`, при попытке любой синхронизации приложение падает с необработанным исключением.

---

## 4. Качество кода и производительность

### 4.1. Дублирующаяся авторизация на каждый запрос
В [`backend/app/main.py`](file:///D:/Dev/read-analyzer/backend/app/main.py):
1. Строки 45–59: кастомный middleware `restrict_api_uploads`, проверяющий `RA_API_TOKEN` через `hmac.compare_digest`.
2. Строки 22–29: зависимость `Depends(authorize)`, выполняющая **ту же самую проверку**.
Один и тот же токен валидируется дважды на каждый сетевой запрос.

### 4.2. Проблема N+1 запросов в `driveBackup.ts`
В [`frontend/services/driveBackup.ts`](file:///D:/Dev/read-analyzer/frontend/services/driveBackup.ts#L84-L100):
Для обхода дерева данных вызываются отдельные запросы в циклах:
```
classesWithIds() -> studentIds(classId) -> audioRows(studentId)
```
Для школы на 15 классов и 300 детей приложение отправляет более 300 последовательных запросов к SQLite вместо единого выборки через `JOIN`.

### 4.3. Отсутствие реальных тестов в репозитории
В репозитории создана папка `backend/tests/`, однако в ней присутствуют только бинарные файлы кэша `__pycache__/*.pyc` (например, `test_main.cpython-312...`). Самих файлов тестов `.py` в Git нет. Тестовое покрытие бэкенда равно 0%.

### 4.4. Неоптимизированный размер Docker-образа
В `backend/Dockerfile` команда `pip install -r backend/requirements-asr.txt` скачивает сборку PyTorch по умолчанию из PyPI. Это приводит к загрузке пакетов CUDA runtime размером более 2.5 ГБ внутри контейнера, хотя бэкенд может запускаться в окружении без GPU. Необходимо использовать `--index-url https://download.pytorch.org/whl/cpu` для CPU-образа.

---

## 5. План действий (Action Items)

1. **Исправить блокирующий I/O в FastAPI:**
   Переписать дисковые операции через `aiofiles` или изменить сигнатуру эндпоинтов на обычный `def transcribe_upload(...)`, позволяя FastAPI передавать синхронный I/O в threadpool.
2. **Перейти на PostgreSQL (согласно RA-7) либо настроить пул соединений:**
   Заменить локальный `sqlite3` на SQLAlchemy/PostgreSQL для устойчивости при высоких нагрузках.
3. **Удалить невостребованный код шеринга:**
   Удалить `shareWithColleague` и связанные элементы UI согласно требованиям [RA-28](https://uvb.atlassian.net/browse/RA-28).
4. **Восстановить исходники тестов:**
   Закоммитить исходные файлы тестов из `backend/tests/` и настроить запуск `pytest` в CI.
5. **Оптимизировать Dockerfile:**
   Разделить зависимости на базовые и ASR, использовать CPU-колеса PyTorch для уменьшения веса образа с 5 ГБ до ~600 МБ.
