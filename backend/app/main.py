from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Read Analyzer API",
    description="API для анализа голосовых сообщений школьников и детекции дефектов речи",
    version="0.1.0",
)

# Разрешаем запросы с любого источника для удобства локальной разработки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
async def root():
  return {
      "project": "Read Analyzer",
      "version": "0.1.0",
      "status": "online",
      "docs": "/docs",
  }


@app.get("/health", tags=["Health"])
async def health_check():
  return {"status": "healthy"}
