import os
from sentence_transformers import SentenceTransformer, util

# Name of the pretrained SBERT model to use (used to auto-download if no
# local copy is found — see MODEL_LOCAL_PATH below).
MODEL_NAME = "all-MiniLM-L6-v2"

# If you've pre-downloaded the model (via download_model.py), it will be
# stored here and loaded from disk instead of hitting the internet.
MODEL_LOCAL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")

# Loaded once per process and reused (avoids reloading the model on every call)
_model = None


def _get_model():
    global _model
    if _model is None:
        if os.path.isdir(MODEL_LOCAL_PATH) and os.listdir(MODEL_LOCAL_PATH):
            # Fully offline: load the model bundled with the project
            _model = SentenceTransformer(MODEL_LOCAL_PATH)
        else:
            # Falls back to downloading from Hugging Face Hub (needs internet
            # the first time; cached afterwards in ~/.cache)
            _model = SentenceTransformer(MODEL_NAME)
    return _model


def _normalize(raw_score: float, min_val: float = -1.0, max_val: float = 1.0) -> float:
    """Scales a raw score (e.g. cosine similarity -1..1) into 0.0 - 1.0."""
    if max_val == min_val:
        return 0.0
    normalized = (raw_score - min_val) / (max_val - min_val)
    return max(0.0, min(1.0, normalized))


def run_algorithm(resume: str, job_description: str) -> float:
    """
    Compares a resume to a job description and returns a normalized
    similarity score.

    Args:
        resume (str): Raw resume text.
        job_description (str): Raw job description text.

    Returns:
        float: Score between 0.0 (no match) and 1.0 (perfect match).
    """
    resume = (resume or "").strip()
    job_description = (job_description or "").strip()

    if not resume or not job_description:
        return 0.0

    model = _get_model()

    embeddings = model.encode(
        [resume, job_description],
        convert_to_tensor=True,
        show_progress_bar=False,
    )

    # Cosine similarity ranges from -1 (opposite) to 1 (identical)
    raw_score = util.cos_sim(embeddings[0], embeddings[1]).item()

    return _normalize(raw_score, min_val=-1.0, max_val=1.0)
