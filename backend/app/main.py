from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, templates, documents, chat, diadoc, sync_1c, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Pulkovo AI Platform",
    description="Платформа генерации документов с ИИ для аэропорта Пулково",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(diadoc.router)
app.include_router(sync_1c.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Pulkovo AI Platform"}
