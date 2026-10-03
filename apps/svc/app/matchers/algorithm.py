"""
SBERT scoring for resume <-> job matching.

Input is what the extractors give: the resume's sections (the dict from split_sections) and a job dict:

    job = {
        "skills":        "Cash handling\\nPOS system operation",       # text or list, one skill per line/comma
        "experience":    "Cashier\\nProcess cash and cashless payments",  # text or list (title + duties)
        "min_years":     1,                                           # optional
        "weights":       {"skills": 0.5, "experience": 0.5},          # optional
    }

    final = w_skills * skills + w_experience * experience          (Weighted Sum Model, each part 0..1)

Education is not part of matching: the applicant states it and HR filters on it BEFORE matching.
"""
from __future__ import annotations

import datetime as dt
import os
import re

import numpy as np

from app.matchers.rules import DATE_RANGE_RE, find_date_ranges, total_years

# Name of the pretrained SBERT model (auto-downloaded if no local copy is found, see MODEL_LOCAL_PATH).
MODEL_NAME = "all-MiniLM-L6-v2"

# If you've pre-downloaded the model (via download_model.py), it is loaded from here instead.
MODEL_LOCAL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")

# SBERT similarity -> credit: <= LOW gives 0, >= HIGH gives 1, linear in between.
# Starting guesses: print real similarities (print_report in matching.py) and tune these two numbers.
LOW, HIGH = 0.35, 0.65

BULLET_DISCOUNT = 0.90                                        # skill found only in an experience duty line
EXTRA_SKILL_SECTIONS: dict[str, float] = {}   # strictly skills + experience. To also read other sections: {"certifications": 1.0}
EXP_YEARS_SHARE = 0.40       # with 0 years, experience is capped at 60% of its relevance (only if min_years set)
DEFAULT_WEIGHTS = {"skills": 0.50, "experience": 0.50}

# Loaded once per process and reused (avoids reloading the model on every call)
_model = None
_cache: dict[str, np.ndarray] = {}


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer   # imported here so importing this file is cheap
        if os.path.isdir(MODEL_LOCAL_PATH) and os.listdir(MODEL_LOCAL_PATH):
            _model = SentenceTransformer(MODEL_LOCAL_PATH)      # fully offline
        else:
            _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed(texts) -> np.ndarray:
    """Normalised SBERT vectors, one row per text. Each distinct text is encoded only once."""
    texts = list(texts)
    if not texts:
        return np.zeros((0, 1))
    new = [t for t in dict.fromkeys(texts) if t not in _cache]
    if new:
        if len(_cache) > 50_000:
            _cache.clear()
        vecs = _get_model().encode(new, normalize_embeddings=True, show_progress_bar=False)
        _cache.update(zip(new, vecs))
    return np.stack([_cache[t] for t in texts])


def ramp(x):
    return np.clip((np.asarray(x, dtype=float) - LOW) / (HIGH - LOW), 0.0, 1.0)


# ------------------------------------------------------------------ section text -> short lines
def _text(x) -> str:
    return "\n".join(map(str, x)) if isinstance(x, (list, tuple)) else (x or "")


def _dedupe(items):
    seen, out = set(), []
    for x in items:
        k = x.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(x.strip())
    return out


def _lines(text, split_commas=False, split_sentences=False) -> list[str]:
    """One short phrase per item (SBERT works best on short chunks, not a whole section)."""
    raw = text if isinstance(text, (list, tuple)) else _text(text).split("\n")
    out = []
    for line in raw:
        line = re.sub(r"^\s*[-•*]\s*", "", str(line)).strip()
        if not line or DATE_RANGE_RE.fullmatch(line):          # skip blanks and bare date lines
            continue
        if split_commas:
            parts = re.split(r"[,;]", line)
        elif split_sentences:
            parts = re.split(r"(?<=[.!?])\s+", line)
        else:
            parts = re.split(r"\s+—\s+", line)                  # 'Title — Company'
        parts = [p.strip(" .") for p in parts]
        out += [p for p in parts if len(p) >= 3]
    return _dedupe(out)


def _bullets(text) -> list[str]:
    return _dedupe([re.sub(r"^\s*[-•*]\s*", "", l).strip() for l in _text(text).split("\n")
                    if l.strip().startswith(("-", "•", "*"))])


def prepare_resume(sections: dict, today: dt.date | None = None) -> dict:
    """sections (from split_sections) -> everything the scoring needs."""
    skills_txt = _text(sections.get("skills"))
    exp_txt = _text(sections.get("experience"))

    evidence: dict[str, float] = {}                      # skill text -> weight (the best weight wins)
    def add(lines, weight):
        for l in lines:
            evidence[l] = max(evidence.get(l, 0.0), weight)
    add(_lines(skills_txt, split_commas=True), 1.0)
    for key, weight in EXTRA_SKILL_SECTIONS.items():
        add(_lines(_text(sections.get(key)), split_commas=True), weight)
    add(_bullets(exp_txt), BULLET_DISCOUNT)

    ranges = find_date_ranges(exp_txt)
    warnings = []
    if not skills_txt:
        warnings.append("no skills section found")
    if not exp_txt:
        warnings.append("no experience section found")
    elif not ranges:
        warnings.append("no dates found in experience (years counted as 0)")

    return {"skill_evidence": list(evidence.items()), "exp_lines": _lines(exp_txt),
            "years": total_years(ranges, today), "warnings": warnings}


# ------------------------------------------------------------------ scores
def _coverage(jd_lines, evidence, weights=None):
    """For each job line: its best-matching resume line. -> (mean credit, details)."""
    if not jd_lines:
        return 1.0, []
    if not evidence:
        return 0.0, [{"required": j, "found": "", "similarity": 0.0, "credit": 0.0} for j in jd_lines]
    sims = embed(jd_lines) @ embed(evidence).T
    if weights is not None:
        sims = sims * np.asarray(weights)
    idx, best = sims.argmax(axis=1), sims.max(axis=1)
    credit = ramp(best)
    return float(credit.mean()), [{"required": jd_lines[i], "found": evidence[idx[i]],
                                   "similarity": round(float(best[i]), 3), "credit": round(float(credit[i]), 3)}
                                  for i in range(len(jd_lines))]


def skills_score(prep: dict, job: dict):
    jd = _lines(job.get("skills", []), split_commas=True)
    texts = [t for t, _ in prep["skill_evidence"]]
    weights = [w for _, w in prep["skill_evidence"]]
    return _coverage(jd, texts, weights)


def experience_score(prep: dict, job: dict):
    jd = _lines(job.get("experience", []), split_sentences=True)
    relevance, details = _coverage(jd, prep["exp_lines"])
    need = job.get("min_years", 0) or 0
    if need <= 0:
        return relevance, {"years": prep["years"], "years_needed": 0, "years_score": None,
                           "relevance": relevance, "matches": details}
    years_score = min(prep["years"] / need, 1.0)
    score = relevance * ((1 - EXP_YEARS_SHARE) + EXP_YEARS_SHARE * years_score)   # years help only if relevant
    return score, {"years": prep["years"], "years_needed": need, "years_score": years_score,
                   "relevance": relevance, "matches": details}


# ------------------------------------------------------------------ Weighted Sum Model
def run_algorithm(sections: dict, job: dict, today: dt.date | None = None) -> dict:
    """Score one resume (its sections) against one job. Returns the final score (0..1) and the breakdown."""
    prep = prepare_resume(sections, today)
    skills, skill_matches = skills_score(prep, job)
    experience, exp_info = experience_score(prep, job)

    scores = {"skills": skills, "experience": experience}
    w = job.get("weights") or DEFAULT_WEIGHTS
    total_w = sum(w.get(k, 0) for k in scores) or 1.0
    final = sum(w.get(k, 0) * scores[k] for k in scores) / total_w

    return {
        "final": max(0.0, min(1.0, float(final))),
        "scores": scores,
        "weights": {k: w.get(k, 0) / total_w for k in scores},
        "skill_matches": skill_matches,
        "experience": exp_info,
        "warnings": prep["warnings"],
    }