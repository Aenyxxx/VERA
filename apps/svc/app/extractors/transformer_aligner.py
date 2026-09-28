"""Map word-level BIO labels onto subword tokens for BERT/RoBERTa."""
from __future__ import annotations

from typing import Any

IGNORE_INDEX = -100


def align_bio_labels(
    words: list[str],
    labels: list[str],
    tokenizer,
    label2id: dict[str, int],
    max_length: int = 512,
) -> dict[str, Any]:
    """
    Tokenize pre-split words and align word-level BIO labels to subword tokens.

    - First subword of a word gets the label ID.
    - Other subwords and special tokens get -100 (ignored in the loss).
    """
    if len(words) != len(labels):
        raise ValueError("The number of words must match the number of BIO labels.")

    encoding = tokenizer(
        words,
        is_split_into_words=True,
        truncation=True,
        max_length=max_length,
    )

    aligned, previous = [], None
    for word_id in encoding.word_ids():
        if word_id is None:
            aligned.append(IGNORE_INDEX)
        elif word_id != previous:
            aligned.append(label2id[labels[word_id]])
        else:
            aligned.append(IGNORE_INDEX)
        previous = word_id

    encoding["labels"] = aligned
    return dict(encoding)