from app.matchers.algorithm  import run_algorithm


def matching(resume: str, job_description: str) -> float:
    """
    Compute a normalized match score between a resume and a job description.

    Args:
        resume (str): Raw resume text.
        job_description (str): Raw job description text.

    Returns:
        float: Normalized score between 0.0 and 1.0.
    """
    score = run_algorithm(resume, job_description)

    # Safety net: keep output normalized no matter what algorithm.py does
    return max(0.0, min(1.0, float(score)))


if __name__ == "__main__":
    # Quick manual test when running this file directly
    sample_resume = """
    Experienced Python developer with 5 years building REST APIs using
    Flask and Django. Strong background in machine learning, NLP, and
    deploying models with Docker and AWS.
    """

    sample_job_description = """
    Looking for a Backend Engineer skilled in Python, Flask or Django,
    with experience in NLP or machine learning, and familiarity with
    cloud deployment (AWS) and containerization (Docker).
    """

    result = matching(sample_resume, sample_job_description)
    print(f"Match score: {result:.4f}  ({result * 100:.2f}%)")
