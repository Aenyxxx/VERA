"""POST /match — score stored resume sections against one job (TRD §8). The PDF is never re-sent."""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, model_validator

from app.api.deps import require_internal_key
from app.matchers.algorithm import model_name, run_algorithm
from app.standardizers.resume import standardize_text

router = APIRouter(dependencies=[Depends(require_internal_key)])


class ResumeIn(BaseModel):
    sections: dict[str, str]                       # resume_extraction.sections (split_sections output)


class JobIn(BaseModel):
    skills: str = ""                               # job_vacancy.required_skills, one per line
    experience: str = ""                           # job_vacancy.experience_requirement: title, then duties
    minYears: float = Field(0, ge=0)

    @model_validator(mode="after")
    def has_requirements(self):
        if not (self.skills.strip() or self.experience.strip()):
            raise ValueError("Provide the job's skills and/or experience text.")
        return self


class WeightsIn(BaseModel):
    skills: float = Field(ge=0)                    # first-time: 1, experienced: 0.5 (PRD BR-04)
    experience: float = Field(ge=0)                # first-time: 0, experienced: 0.5

    @model_validator(mode="after")
    def positive_total(self):
        if self.skills + self.experience <= 0:
            raise ValueError("Weights must add up to more than 0.")
        return self


class MatchIn(BaseModel):
    resume: ResumeIn
    job: JobIn
    weights: WeightsIn


@router.post("/match")
async def match(body: MatchIn):
    # EXT-02 on the job text too: the stored resume sections were standardized by /extract.
    job = {
        "skills": standardize_text(body.job.skills),
        "experience": standardize_text(body.job.experience),
        "min_years": body.job.minYears,
        "weights": {"skills": body.weights.skills, "experience": body.weights.experience},
    }
    # SBERT is CPU-heavy, so keep it off the event loop.
    result = await run_in_threadpool(run_algorithm, body.resume.sections, job)

    return {
        "matchScore": result["match_score"],
        "scores": result["scores_100"],
        "yearsWorked": result["experience"]["years"],
        "matchedSkills": result["matched_skills"],
        "missingSkills": result["missing_skills"],
        "skillMatches": result["skill_matches"],
        "experienceMatches": result["experience"]["matches"],
        "warnings": result["warnings"],
        "modelName": model_name(),
    }
