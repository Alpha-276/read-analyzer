# Frontend Application (Teacher Dashboard)

Client-side web application for school teachers.
Owner: **Sergei Boiko** ([RA-9](https://uvb.atlassian.net/browse/RA-9), [RA-10](https://uvb.atlassian.net/browse/RA-10)).

## Recommended Tech Stack
* **React** + **Vite** + **TypeScript**
* **Tailwind CSS** + **shadcn/ui** or **Lucide Icons**
* **Axios** / **TanStack Query** (Backend API communication)
* **Wavesurfer.js** or native HTML5 Audio (Interactive audio player with synced timeline)

## Project Initialization
Initialize the Vite template inside this folder:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run dev
```

## RA-7: classes and students

RA-7 adds the local data layer in `services/`

After integrating these files into the Expo app, run this in the directory that
contains the app's `package.json`:

```bash
npx expo install expo-sqlite
```

Commit the resulting dependency change and the app's existing package-manager
lockfile. The install command selects a version compatible with the app's Expo
SDK; no SDK version is assumed by this source-only snapshot.

Import from `services/index.ts` using the relative path from your screen.
The first service call opens the persistent local database, creates schema
version 1 and inserts the demo class with three students. Later calls reuse it.
There is no server dependency for RA-7.

See [RA-7 interface and integration](../docs/RA-7-data-layer.md) for the exact
types, usage examples, seed behavior and the migration point for RA-14.
