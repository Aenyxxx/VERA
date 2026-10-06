"""VERA resume service: PDF extraction (POST /extract) and SBERT matching (POST /match). Internal only."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool

from app.api import extract, match


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the SBERT model once at startup so the first match request isn't slow.
    # If it fails (missing model / no internet) the app still starts; it will retry on the first match.
    try:
        from app.matchers.algorithm import _get_model
        await run_in_threadpool(_get_model)
    except Exception as error:
        print(f"Warning: SBERT model was not preloaded ({error}).")
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(extract.router)
app.include_router(match.router)


@app.get("/")
def root():
    return {"message": "VERA Resume Processing Service"}


@app.get("/health")
def health():
    return {"Status": "Healthy"}
