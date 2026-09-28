from training.make_task import build_tasks

SAMPLE = (
    "JUAN DELA CRUZ\n"
    "WORK EXPERIENCE\n"
    "Web Developer — Acme Corp\n"
    "Pasig City | 2020 – Present\n"
    "EDUCATION\n"
    "BS in Computer Science\n"
    "University of the Philippines, Diliman\n"
    "CHARACTER REFERENCES\n"
    "Maria Santos\n"
    "HR Director, Megaworld\n"
)


def test_only_experience_and_education_become_tasks():
    tasks = build_tasks("juan_01", SAMPLE)
    assert [t["data"]["section"] for t in tasks] == ["experience", "education"]


def test_references_never_appear_in_tasks():
    tasks = build_tasks("juan_01", SAMPLE)
    assert all("HR Director" not in t["data"]["text"] for t in tasks)


def test_task_carries_resume_id():
    tasks = build_tasks("juan_01", SAMPLE)
    assert all(t["data"]["resume_id"] == "juan_01" for t in tasks)