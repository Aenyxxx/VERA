from app.extractors.labels import LABEL2ID
from app.extractors.transformer_aligner import align_bio_labels


class FakeEncoding(dict):
    def word_ids(self):
        # [start], "Mega", "world" (same word), "Inc", [end]
        return [None, 0, 0, 1, None]


class FakeTokenizer:
    def __call__(self, words, **kwargs):
        return FakeEncoding(input_ids=[1, 2, 3, 4, 5])


def test_first_subword_gets_label_others_ignored():
    result = align_bio_labels(
        ["Megaworld", "Inc"], ["B-COMPANY", "I-COMPANY"], FakeTokenizer(), LABEL2ID
    )
    assert result["labels"] == [
        -100, LABEL2ID["B-COMPANY"], -100, LABEL2ID["I-COMPANY"], -100
    ]