# Технический аудит и код-ревью: Сергей Бойко (`sergiyboyko2006`)

- **Роль:** Mobile & Android Native Engineer / Разработчик мобильного интерфейса и нативного аудиомодуля
- **Основной скоуп:** `frontend/screens/RecordScreen.tsx`, `RecordingsScreen.tsx`, `AnalysisScreen.tsx`, `frontend/modules/wav-recorder/*`, `android/*`
- **Связанные задачи Jira:** [RA-9](https://uvb.atlassian.net/browse/RA-9), [RA-10](https://uvb.atlassian.net/browse/RA-10), [RA-16](https://uvb.atlassian.net/browse/RA-16), [RA-24](https://uvb.atlassian.net/browse/RA-24)

---

## 1. Общий вердикт и резюме
Сергей успешно создал нативный Expo-модуль на Kotlin для прямой записи несжатого PCM WAV, обеспечил селектор частоты дискретизации (16, 22.05, 32, 44.1 кГц) и настроил нативный Android-проект для сборки standalone APK.

Однако в низкоуровневом коде захвата звука допущены критические ошибки (искусственный `Thread.sleep`), искажающие звук, а код интерфейса React Native страдает от серьезных проблем с производительностью (100% инлайн-стилей, отсутствие виртуализации списков и фрагментация стейта).

---

## 2. Критические замечания (Audio & Native Android)

### 2.1. Искусственная задержка `Thread.sleep(10)` в цикле аудиозахвата
В файле [`RecordingSession.kt`](file:///D:/Dev/read-analyzer/frontend/modules/wav-recorder/android/src/main/java/expo/modules/wavrecorder/RecordingSession.kt#L50-L55):
```kotlin
while (running) {
    val count = audio.read(samples, 0, samples.size, AudioRecord.READ_NON_BLOCKING)
    check(count >= 0) { "AudioRecord read failed (code $count)." }
    if (count == 0) Thread.sleep(10) else output.write(samples, count)
}
```
* **Суть проблемы:** В цикле реального времени используется неблокирующее чтение (`READ_NON_BLOCKING`) с последующим ручным усыплением потока `Thread.sleep(10)`.
* **Последствие:** За 10 миллисекунд сна аппаратный кольцевой буфер микрофона переполняется. Это приводит к **потере фреймов (buffer overrun), щелчкам и джиттеру (jitter)** в итоговом WAV-файле. Для анализа детской речи и детекции пауз (WPM) это критический дефект, искажающий замеры длительности звуков.
* **Как правильно:** На фоновом потоке необходимо использовать стандартное блокирующее чтение `AudioRecord.READ_BLOCKING`. Поток сам будет спать на уровне ядра ОС ровно столько, сколько требуется до накопления сэмплов, без всяких `Thread.sleep`.

### 2.2. Опасность `UninitializedPropertyAccessException` в Kotlin
В [`RecordingSession.kt`](file:///D:/Dev/read-analyzer/frontend/modules/wav-recorder/android/src/main/java/expo/modules/wavrecorder/RecordingSession.kt#L13):
```kotlin
private lateinit var worker: Thread
```
* Если инициализация `audio.startRecording()` выбросит исключение (например, микрофон заблокирован системой или занят), переменная `worker` не будет проинициализирована.
* При последующем вызове `finish()` в блоке очистки обращение к `worker.join()` выбросит неконтролируемый краш `UninitializedPropertyAccessException`.

### 2.3. Использование `VOICE_RECOGNITION` искажает акустику речи
В строке 23 [`RecordingSession.kt`](file:///D:/Dev/read-analyzer/frontend/modules/wav-recorder/android/src/main/java/expo/modules/wavrecorder/RecordingSession.kt#L23):
```kotlin
MediaRecorder.AudioSource.VOICE_RECOGNITION
```
* Пресет `VOICE_RECOGNITION` в Android активирует агрессивное аппаратное шумоподавление, АРУ (автоматическую регулировку усиления) и подавление эха.
* Для распознавания дефектов речи, заикания, пауз и тихого детского голоса такое аппаратное вмешательство «проглатывает» согласные звуки и тихие паузы. Для исследовательских целей требуется чистый источник `MediaRecorder.AudioSource.MIC` или `UNPROCESSED`.

---

## 3. Архитектура React Native и производительность UI

### 3.1. Фрагментация состояния (15 независимых хуков в одном компоненте)
В [`frontend/screens/RecordScreen.tsx`](file:///D:/Dev/read-analyzer/frontend/screens/RecordScreen.tsx#L26-L45):
```typescript
const [showStudents, setShowStudents] = useState(false);
const [showTexts, setShowTexts] = useState(false);
const [showSampleRates, setShowSampleRates] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [isBusy, setIsBusy] = useState(false);
const [savedUri, setSavedUri] = useState<string | null>(null);
const [status, setStatus] = useState("Pripravené");
const [seconds, setSeconds] = useState(0);
const secondsRef = useRef(0);
const activeSessionRef = useRef<{ student: Student; textId: string } | null>(null);
const operationBusyRef = useRef(false);
const finalizeRef = useRef<() => Promise<void>>(async () => {});
const unmountedRef = useRef(false);
...
```
* Логика процесса записи (idle -> recording -> finalizing -> saved -> error) размазана по 15 независимым переменным и рефам.
* При быстром нажатии кнопок возникает состояние гонки (race conditions). Логику экрана необходимо перевести на конечный автомат через `useReducer`.

### 3.2. Рендеринг сотен элементов без виртуализации (`.map()` вместо `FlatList`)
В [`frontend/screens/RecordScreen.tsx`](file:///D:/Dev/read-analyzer/frontend/screens/RecordScreen.tsx#L275-L291):
```tsx
{showStudents &&
    students.map((student) => (
        <TouchableOpacity key={student.id} ...>
            <Text>{student.firstName} {student.lastName}</Text>
        </TouchableOpacity>
    ))}
```
* Загружаются сразу все ученики всех классов школы и рендерятся одновременно через `.map` внутри `ScrollView`. При 100+ детях это вызывает заметный фриз интерфейса при раскрытии выпадающего списка. Необходим `FlatList` либо модальное окно с поиском.

### 3.3. 100% Inline Styles (отсутствие `StyleSheet.create`)
Во всех компонентах Сергея (`RecordScreen.tsx`, `RecordingsScreen.tsx`, `AnalysisScreen.tsx`, `BottomNavigation.tsx`):
* Стили задаются как инлайн-объекты: `style={{ backgroundColor: "#3b82f6", padding: 16, ... }}`.
* Таймер записи тикает каждую секунду (`setSeconds`), вызывая полный ре-рендер компонента. На каждый тик в памяти создаются десятки новых JS-объектов стилей, создавая постоянную нагрузку на Garbage Collector движка Hermes.

### 3.4. 300 строк статичного хардкода в `AnalysisScreen.tsx`
Файл [`frontend/screens/AnalysisScreen.tsx`](file:///D:/Dev/read-analyzer/frontend/screens/AnalysisScreen.tsx#L34-L60) целиком состоит из захардкоженных фейковых данных:
- *«Jana Novotná · T01 · 16.10.2026»*
- *«Presnosť: 94 %»*
- *«Rýchlosť: 82 slov/min»*
Компонент не принимает `props`, не обращается к SQLite и не реагирует на завершение реальной записи.

---

## 4. Git-гигиена
В ветках Сергея в репозиторий неоднократно попадали временные локальные файлы разработчика:
1. `.expo/dev/logs/start.log` — 243 строки локального лога сборщика Metro.
2. `.expo/devices.json` — идентификаторы персонального устройства разработчика.
3. `frontend/android-build.log` — системный лог сборки Gradle.
Все эти пути должны быть занесены в `.gitignore`.

---

## 5. План действий (Action Items)

1. **Исправить аудиозахват в `RecordingSession.kt`:**
   Заменить `AudioRecord.READ_NON_BLOCKING` и `Thread.sleep(10)` на блокирующее чтение `AudioRecord.READ_BLOCKING`.
2. **Перейти на `StyleSheet.create`:**
   Вынести все стили из инлайна в именованные объекты `StyleSheet` для оптимизации рендеринга.
3. **Отрефакторить состояние `RecordScreen.tsx`:**
   Объединить разрозненные флаги в единый стейт-машину на базе `useReducer`:
   ```typescript
   type RecordState = 
     | { status: 'idle'; selectedStudentId: number | null; sampleRate: number }
     | { status: 'recording'; seconds: number }
     | { status: 'finalizing' }
     | { status: 'recorded'; uri: string };
   ```
4. **Оживить экран анализа:**
   Связать `AnalysisScreen.tsx` с реальной базой данных и результатами работы ASR, убрав статические строки-заглушки.
