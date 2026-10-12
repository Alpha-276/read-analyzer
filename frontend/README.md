# Frontend Application (Teacher Dashboard)

Клиентское веб-приложение для школьных учителей.
Ответственный: **Сергей Бойко** ([RA-9](https://uvb.atlassian.net/browse/RA-9), [RA-10](https://uvb.atlassian.net/browse/RA-10)).

## Рекомендуемый стек
* **React** + **Vite** + **TypeScript**
* **Tailwind CSS** + **shadcn/ui** или **Lucide Icons**
* **Axios** / **TanStack Query** (для связи с Backend API)
* **Wavesurfer.js** или нативный HTML5 Audio (для аудиоплеера с таймлайном)

## Инициализация проекта (для Сергея)
В этой папке можно развернуть шаблон Vite:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm run dev
```
