# RA-7 — dátová vrstva pre triedy a žiakov

Určené pre RA-23 (Manažment triedy), RA-10 (Nahrávanie) a rozšírenie v RA-14.
Implementácia: `frontend/services/`. Platforma: React Native + Expo, Android.

## Zapojenie do RA-9

V dodanom archíve zatiaľ chýba Expo aplikácia aj `package.json`. Služby sú
pripravené na vloženie do aplikácie z RA-9. Ak aplikácia používa `src/`, možno
celý priečinok `services/` presunúť do `src/services/`; vnútorné importy zostanú
funkčné. Služby nepatria do priečinka Expo Router `app/` s obrazovkami.

V priečinku Expo aplikácie spustite:

```bash
npx expo install expo-sqlite
```

Zmenu `package.json` a existujúceho lockfile treba zahrnúť do PR. Verziu Expo
určuje RA-9; tento modul používa async API `expo-sqlite` (`openDatabaseAsync`,
`runAsync`, `getFirstAsync`, `getAllAsync`, `withTransactionAsync`).

## Rozhranie pre Sergeja

Všetky funkcie a typy sa exportujú zo `services/index.ts`.

```ts
interface SchoolClass {
  id: number;
  name: string;
}

interface Student {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
}

interface AddStudentInput {
  classId: number;
  firstName: string;
  lastName: string;
}

interface UpdateStudentInput {
  firstName: string;
  lastName: string;
}

declare function createClass(name: string): Promise<SchoolClass>;
declare function listClasses(): Promise<SchoolClass[]>;
declare function addStudent(input: AddStudentInput): Promise<Student>;
declare function updateStudent(id: number, input: UpdateStudentInput): Promise<Student>;
declare function listStudents(classId: number): Promise<Student[]>;
declare function initializeDatabase(): Promise<void>;
```

- `createClass` vytvorí triedu a vráti jej skutočné ID z databázy.
- `listClasses` načíta triedy aj po reštarte; ID netreba nastavovať napevno.
- `addStudent` uloží žiaka do existujúcej triedy.
- `updateStudent` nahradí meno aj priezvisko. Obe polia sú povinné; ID žiaka
  a priradenie k triede zostávajú zachované.
- `listStudents` vráti iba žiakov zadanej triedy. Pre prázdnu alebo neexistujúcu
  triedu s platným kladným ID vráti `[]`. Poradie je podľa SQL stĺpcov
  `last_name`, `first_name`, `id` (nie jazykové slovenské triedenie).
- `initializeDatabase` je voliteľné predbežné otvorenie databázy pri štarte.
  Každá služba sama počká na inicializáciu, takže samostatné volanie nie je nutné.

Vstupné texty sa orežú cez `trim()`. Prázdny názov/meno/priezvisko, neplatné ID,
neexistujúca trieda pri pridaní alebo neexistujúci žiak pri úprave vyvolajú
`Error`. Chyby SQLite sa tiež prenášajú volajúcemu; obrazovka použije `try/catch`.
Menovci sú povolení: žiaka identifikuje `id`, nie kombinácia mena a priezviska.
Názvy tried tiež nemajú obmedzenie jedinečnosti.

## Príklad pre Manažment triedy (RA-23)

Príklad predpokladá súbor obrazovky v `frontend/screens/`.

```ts
import { createClass, addStudent, updateStudent, listStudents } from '../services';

// V obsluhe uloženia formulára, nie pri každom vykreslení obrazovky:
const schoolClass = await createClass('2.B');
const student = await addStudent({
  classId: schoolClass.id,
  firstName: 'Lucia',
  lastName: 'Malá',
});

await updateStudent(student.id, {
  firstName: 'Lucia',
  lastName: 'Malinová',
});

const students = await listStudents(schoolClass.id);
```

## Príklad pre výber žiaka (RA-10)

```ts
import { listClasses, listStudents } from '../services';

const classes = await listClasses();
// V UI sa použije zvolená trieda; prvá trieda je iba príklad.
const selectedClass = classes[0];
const students = selectedClass ? await listStudents(selectedClass.id) : [];

const options = students.map((student) => ({
  label: `${student.firstName} ${student.lastName}`,
  value: student.id,
}));
```

Po návrate z RA-23 treba zoznam znova načítať (napr. pri získaní fokusu
obrazovky). Služby vracajú aktuálne údaje z databázy, nie reaktívny stav UI.

## Databáza a seed

Súbor `read-analyzer.db` sa otvára v predvolenom perzistentnom priečinku
`expo-sqlite` na zariadení. Dáta zostanú po zatvorení a opätovnom spustení
aplikácie. Odinštalovanie alebo vymazanie údajov aplikácie odstráni aj databázu.

| Tabuľka | Stĺpce |
| --- | --- |
| `classes` | `id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` TEXT NOT NULL |
| `students` | `id` INTEGER PRIMARY KEY AUTOINCREMENT, `class_id` INTEGER NOT NULL REFERENCES classes(id), `first_name` TEXT NOT NULL, `last_name` TEXT NOT NULL |

Zapnuté sú cudzie kľúče a WAL. Index `idx_students_class_id` podporuje výber
žiakov podľa triedy. ID sa pri úprave mena nemení a automaticky sa nerecykluje.

Prvá migrácia v jednej transakcii vytvorí tabuľky, triedu **1.A (demo)** a troch
fiktívnych žiakov: **Ján Novák, Ema Kováčová, Adam Horváth**. Nakoniec nastaví
`PRAGMA user_version = 1`. Seed je zatiaľ aktívny pre každú novú databázu
v rámci Sprintu 1, aj v release zostavení. Pri ďalšom spustení sa neopakuje
a neobnovuje pôvodné hodnoty upravených žiakov. Nie je to samostatný reset dát.

RA-14 má doplniť ďalšiu migráciu v `services/database.ts` a zvýšiť `user_version`
po jej úspešnom dokončení. Zachovajte existujúce tabuľky, údaje a ID; záznamy
nahrávok bude možné priradiť cez `students.id`.

## Vykonané overenie

Prešla prísna kontrola TypeScriptu s deklaráciami `expo-sqlite` 58.0.13.
Služby boli overené nad súborovou SQLite cez dočasný adaptér namiesto natívneho
Expo modulu: vytvorenie, úprava, filtrovanie podľa triedy a nové spustenie procesu
zachovali dáta bez opakovania seedu. Adaptér ani testovacie závislosti nie sú
súčasťou odovzdaných súborov. Natívny beh Expo/Android zostáva overiť po zapojení
do RA-9; v dodanom archíve aplikácia chýba.

## Krátke overenie v Android aplikácii

1. Zavolať `listClasses()` a `listStudents(id)` — na novej inštalácii je dostupná
   demo trieda s tromi žiakmi.
2. Vytvoriť druhú triedu, pridať žiaka, upraviť jeho meno/priezvisko a načítať
   oba zoznamy — žiak patrí iba do vybranej triedy.
3. Aplikáciu úplne zavrieť a znova otvoriť — vytvorená trieda, žiak aj úprava
   zostali uložené; počet demo žiakov sa nezvýšil.

Oficiálne API a inštalácia: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/).
`UPDATE ... RETURNING` vracia upravený záznam jedným SQL príkazom:
[SQLite RETURNING](https://www.sqlite.org/lang_returning.html).
