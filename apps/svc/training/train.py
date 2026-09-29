# pyright: reportMissingImports=false
"""Fine-tune a token-classification model on the BIO splits.

Run on Colab/Kaggle (not inside the service), from the svc/ folder:
    python -m training.train
    python -m training.train --model bert-base-cased --epochs 20
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    DataCollatorForTokenClassification,
    Trainer,
    TrainingArguments,
    set_seed,
)

from app.extractors.labels import ID2LABEL, LABEL2ID, LABELS
from app.extractors.ner_data import load_split
from app.extractors.transformer_aligner import IGNORE_INDEX, align_bio_labels
from training.scoring import classification_report, overall_scores

SEED = 42


def build_dataset(name: str, tokenizer, max_length: int) -> Dataset:
    """Load one split and align its word-level labels to subword tokens."""
    examples = load_split(name)
    raw = Dataset.from_list(examples)

    # Truncation silently drops the end of a section (and its labels), so count it.
    too_long = sum(
        len(tokenizer(ex["tokens"], is_split_into_words=True)["input_ids"]) > max_length
        for ex in examples
    )
    print(f"{name}: {len(examples)} examples, {too_long} longer than {max_length} tokens")

    return raw.map(
        lambda ex: align_bio_labels(ex["tokens"], ex["ner_tags"], tokenizer, LABEL2ID, max_length),
        remove_columns=raw.column_names,
    )


def decode(predictions, label_ids):
    """Turn model output into label-name sequences, skipping ignored positions."""
    pred_ids = np.argmax(predictions, axis=-1)
    y_true, y_pred = [], []
    for pred_row, label_row in zip(pred_ids, label_ids):
        true_seq, pred_seq = [], []
        for p, l in zip(pred_row, label_row):
            if l == IGNORE_INDEX:
                continue
            true_seq.append(ID2LABEL[int(l)])
            pred_seq.append(ID2LABEL[int(p)])
        y_true.append(true_seq)
        y_pred.append(pred_seq)
    return y_true, y_pred


def compute_metrics(eval_pred) -> dict[str, float]:
    y_true, y_pred = decode(eval_pred.predictions, eval_pred.label_ids)
    precision, recall, f1 = overall_scores(y_true, y_pred)
    return {"precision": precision, "recall": recall, "f1": f1}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="roberta-base")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=5e-5)
    parser.add_argument("--max-length", type=int, default=512)
    parser.add_argument("--output", type=Path, default=Path("models/resume-ner"))
    args = parser.parse_args()

    set_seed(SEED)

    # Plain RoBERTa needs add_prefix_space=True for pre-split words.
    name = args.model.lower()
    tokenizer_kwargs = {"add_prefix_space": True} if "roberta" in name and "xlm" not in name else {}
    tokenizer = AutoTokenizer.from_pretrained(args.model, **tokenizer_kwargs)

    train_ds = build_dataset("train", tokenizer, args.max_length)
    val_ds = build_dataset("validation", tokenizer, args.max_length)
    test_ds = build_dataset("test", tokenizer, args.max_length)

    model = AutoModelForTokenClassification.from_pretrained(
        args.model, num_labels=len(LABELS), id2label=ID2LABEL, label2id=LABEL2ID
    )

    training_args = TrainingArguments(
        steps_per_epoch = -(-len(train_ds) // args.batch_size),
        warmup_steps = int(0.1 * steps_per_epoch * args.epochs),
        output_dir=str(args.output.parent / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_steps=warmup_steps,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        fp16=torch.cuda.is_available(),
        seed=SEED,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tokenizer,
        data_collator=DataCollatorForTokenClassification(tokenizer),
        compute_metrics=compute_metrics,
    )
    trainer.train()

    args.output.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.output))
    tokenizer.save_pretrained(str(args.output))

    summary = {}
    for split_name, ds in (("validation", val_ds), ("test", test_ds)):
        output = trainer.predict(ds)
        y_true, y_pred = decode(output.predictions, output.label_ids)
        print(f"\n===== {split_name} (per-label entity F1) =====")
        print(classification_report(y_true, y_pred))
        summary[split_name] = {"f1": overall_scores(y_true, y_pred)[2]}

    (args.output / "metrics.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nModel saved to {args.output}")


if __name__ == "__main__":
    main()