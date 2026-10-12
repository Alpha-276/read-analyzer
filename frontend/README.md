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
