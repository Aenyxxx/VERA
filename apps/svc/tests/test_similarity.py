"""COS-01 cosine similarity matrix (TC-68) and SBERT paraphrase behaviour (TC-70, real model)."""
import numpy as np
import pytest

from app.matchers.algorithm import cosine_similarity_matrix


def test_identical_orthogonal_and_opposite_vectors():                       # TC-68
    a = np.array([[1.0, 0.0]])
    b = np.array([[1.0, 0.0], [0.0, 1.0], [-1.0, 0.0]])
    assert cosine_similarity_matrix(a, b) == pytest.approx(np.array([[1.0, 0.0, -1.0]]))


def test_length_does_not_change_the_cosine():
    a = np.array([[3.0, 4.0]])
    b = np.array([[0.6, 0.8], [30.0, 40.0]])
    assert cosine_similarity_matrix(a, b) == pytest.approx(np.array([[1.0, 1.0]]))


def test_shape_is_requirements_by_evidence():
    assert cosine_similarity_matrix(np.ones((4, 3)), np.ones((7, 3))).shape == (4, 7)


def test_equals_dot_product_for_unit_vectors():
    rng = np.random.default_rng(0)
    a = rng.normal(size=(3, 8))
    b = rng.normal(size=(5, 8))
    a /= np.linalg.norm(a, axis=1, keepdims=True)
    b /= np.linalg.norm(b, axis=1, keepdims=True)
    assert cosine_similarity_matrix(a, b) == pytest.approx(a @ b.T)


def test_zero_vector_gives_zero_not_division_error():
    assert cosine_similarity_matrix(np.zeros((1, 2)), np.array([[1.0, 0.0]])) == pytest.approx(np.array([[0.0]]))


@pytest.fixture
def real_model(monkeypatch):
    """The cached SBERT model (no download). Skips when it is not available on this machine."""
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    pytest.importorskip("sentence_transformers")
    from app.matchers import algorithm

    try:
        algorithm._get_model()
    except Exception as error:                                                # model not downloaded yet
        pytest.skip(f"SBERT model not available offline: {error}")
    return algorithm


def similarities(algorithm, requirement, evidence):
    return cosine_similarity_matrix(algorithm.embed([requirement]), algorithm.embed(evidence))[0]


def test_paraphrase_scores_clearly_higher_than_unrelated(real_model):      # TC-70
    paraphrase, unrelated = similarities(real_model, "Cash handling", ["Handled cash", "welding"])
    assert paraphrase >= real_model.HIGH                                      # full credit
    assert unrelated <= real_model.LOW                                        # no credit


def test_spelled_out_abbreviation_matches_after_standardization(real_model):  # TC-70, EXT-02
    from app.standardizers.resume import standardize_text

    raw = similarities(real_model, "POS system operation", ["point-of-sale terminal"])[0]
    standardized = similarities(
        real_model, standardize_text("POS system operation"), [standardize_text("point-of-sale terminal")]
    )[0]
    assert raw < real_model.LOW                                               # the model alone misses it (~0.22)
    assert standardized >= real_model.LOW + 0.25                              # 'POS terminal' (~0.65) gets credit
