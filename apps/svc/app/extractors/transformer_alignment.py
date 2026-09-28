from typing import List, Dict, Any


IGNORE_INDEX = -100


def align_bio_labels(
    words: List[str],
    labels: List[str],
    tokenizer,
) -> Dict[str, Any]:
    """
    Tokenize pre-tokenized words and align word-level BIO labels
    with Transformer subword tokens.

    Rules:
    - First subword of a word receives the original BIO label.
    - Additional subwords receive IGNORE_INDEX (-100).
    - Special tokens receive IGNORE_INDEX (-100).

    Parameters
    ----------
    words:
        Original word-level tokens.

    labels:
        BIO label corresponding to each word.

    tokenizer:
        Hugging Face fast tokenizer.

    Returns
    -------
    Dict[str, Any]
        Tokenizer output plus aligned labels.
    """

    if len(words) != len(labels):
        raise ValueError(
            "The number of words must match the number of BIO labels."
        )

    encoding = tokenizer(
        words,
        is_split_into_words=True,
        truncation=True,
        return_offsets_mapping=True,
    )

    word_ids = encoding.word_ids()

    aligned_labels = []
    previous_word_id = None

    for word_id in word_ids:

        # Special tokens such as [CLS] and [SEP]
        if word_id is None:
            aligned_labels.append(IGNORE_INDEX)
            previous_word_id = None
            continue

        # First subword of a word
        if word_id != previous_word_id:
            aligned_labels.append(labels[word_id])

        # Additional subword of the same word
        else:
            aligned_labels.append(IGNORE_INDEX)

        previous_word_id = word_id

    encoding["labels"] = aligned_labels

    return encoding