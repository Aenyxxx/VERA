"""Column-aware text extraction for PDF resumes.

Why: page.get_text() returns text in the order the PDF stores it. Canva / template resumes with a
sidebar store ALL the headings first and the content later, so heading-based sectioning
(split_sections) gets the headings and their content apart. Here the text is read column by column
(each heading followed by its own content). One-column pages are returned exactly as before.
"""
from __future__ import annotations

MIN_GAP = 8.0            # points of empty space needed between two columns
MIN_SIDE_SHARE = 0.20    # each column must hold at least 20% of the text (so right-aligned dates don't count)
WIDE_BLOCK = 0.60        # blocks wider than 60% of the page are full-width (header / footer)
MIN_BLOCKS = 6

Block = tuple  # (x0, y0, x1, y1, text)


def _size(block: Block) -> int:
    return len(block[4].strip())


def find_column_split(blocks: list[Block], page_width: float) -> float | None:
    """x position between two columns, or None if the page is a single column."""
    narrow = [b for b in blocks if _size(b) and (b[2] - b[0]) < WIDE_BLOCK * page_width]
    if len(narrow) < MIN_BLOCKS:
        return None
    total = sum(_size(b) for b in narrow)

    spans = sorted((b[0], b[2]) for b in narrow)            # x-ranges that contain text, merged
    merged = [list(spans[0])]
    for start, end in spans[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    best = None
    for (_, left_end), (right_start, _) in zip(merged, merged[1:]):
        gap = right_start - left_end
        if gap < MIN_GAP:
            continue
        split = (left_end + right_start) / 2
        left = sum(_size(b) for b in narrow if (b[0] + b[2]) / 2 < split)
        if min(left, total - left) / total < MIN_SIDE_SHARE:
            continue
        if best is None or gap > best[0]:
            best = (gap, split)
    return best[1] if best else None


def order_blocks(blocks: list[Block], page_width: float) -> str | None:
    """Text in reading order (column by column), or None if the page is not multi-column."""
    blocks = [b for b in blocks if _size(b)]
    split = find_column_split(blocks, page_width)
    if split is None:
        return None

    full = [b for b in blocks if b[0] < split < b[2]]                     # header / footer across both columns
    rest = [b for b in blocks if b not in full]
    left = [b for b in rest if (b[0] + b[2]) / 2 < split]
    right = [b for b in rest if (b[0] + b[2]) / 2 >= split]

    top, bottom = min(b[1] for b in rest), max(b[3] for b in rest)
    head = [b for b in full if (b[1] + b[3]) / 2 < (top + bottom) / 2]
    tail = [b for b in full if b not in head]

    columns = [sorted(c, key=lambda b: (b[1], b[0])) for c in (left, right) if c]
    columns.sort(key=lambda c: min(b[1] for b in c))                      # the column holding the top-most text first

    ordered = (sorted(head, key=lambda b: (b[1], b[0]))
               + [b for c in columns for b in c]
               + sorted(tail, key=lambda b: (b[1], b[0])))
    return "\n".join(b[4].strip() for b in ordered)


def extract_page_text(page) -> str:
    """Drop-in replacement for page.get_text() with a PyMuPDF page."""
    blocks = [(b[0], b[1], b[2], b[3], b[4]) for b in page.get_text("blocks") if b[6] == 0]
    ordered = order_blocks(blocks, page.rect.width)
    return page.get_text() if ordered is None else ordered
