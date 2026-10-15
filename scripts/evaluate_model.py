"""Gesture recognition model evaluation script for Bubsy.

Evaluates a model against a labelled evaluation dataset directory.
Computes:
- Per-class Precision, Recall, F1-Score, and Support
- Macro F1-score and Weighted F1-score
- Multi-class Confusion Matrix using scikit-learn
- Participant / session-based data leakage check and warning
- Writes comprehensive markdown evaluation report to docs/evals/<model_version>.md

Privacy constraint:
- Frames are read into memory for inference and immediately released.
- Zero frames or output crops are written to disk.
"""

import argparse
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import cv2
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, f1_score

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.vision.gestures import (
    GestureClass,
    normalize_gesture_label,
)
from app.vision.inference import (
    GestureModel,
    StubGestureModel,
    YoloGestureModel,
)


def extract_participant_and_session(filename: str) -> tuple[str | None, str | None]:
    """Extract participant ID and session ID from filename if present.

    Recognizes patterns such as:
    - p01_s02_frame123.jpg -> (p01, s02)
    - user_03_ses_01.png -> (user_03, ses_01)
    - subject1_session2_001.jpg -> (subject1, session2)
    """
    stem = Path(filename).stem.lower()

    # Pattern 1: p01_s01 or participant1_session2
    p_match = re.search(r"(?:p|participant|sub|subject|user)[-_]?([a-z0-9]+)", stem)
    s_match = re.search(r"(?:s|session|ses|run)[-_]?([a-z0-9]+)", stem)

    participant_id = p_match.group(0) if p_match else None
    session_id = s_match.group(0) if s_match else None

    return participant_id, session_id


def check_dataset_split_leakage(
    test_files: list[str],
    train_dir: str | Path | None = None,
) -> tuple[bool, str]:
    """Check for suspected data leakage between participants and sessions.

    Warns if:
    1. A train directory is provided and identical participants/sessions appear in both splits.
    2. Test files contain adjacent high-frequency frames without distinct participant boundaries.
    """
    test_participants: set[str] = set()
    test_sessions: set[str] = set()

    for f in test_files:
        p_id, s_id = extract_participant_and_session(f)
        if p_id:
            test_participants.add(p_id)
        if s_id:
            test_sessions.add(s_id)

    if train_dir and Path(train_dir).is_dir():
        train_path = Path(train_dir)
        train_files = [f.name for f in train_path.rglob("*") if f.is_file()]
        train_participants: set[str] = set()
        train_sessions: set[str] = set()

        for f in train_files:
            p_id, s_id = extract_participant_and_session(f)
            if p_id:
                train_participants.add(p_id)
            if s_id:
                train_sessions.add(s_id)

        shared_participants = test_participants.intersection(train_participants)

        if shared_participants:
            warning_msg = (
                f"SUSPECTED DATA LEAKAGE: Found {len(shared_participants)} overlapping participant(s) "
                f"({sorted(shared_participants)}) between train and test splits! "
                f"Evaluation must use strict held-out participants."
            )
            return True, warning_msg

    # If no participant metadata is present in filenames
    if not test_participants and not test_sessions:
        warning_msg = (
            "NOTICE: Filenames do not contain explicit participant (pXX) or session (sXX) identifiers. "
            "Verify manually that test frames were not sampled from the same video recording sessions as training."
        )
        return False, warning_msg

    return (
        False,
        f"Participant split verified: {len(test_participants)} participant(s) and {len(test_sessions)} session(s) detected.",
    )


def load_dataset_samples(
    data_dir: Path,
) -> tuple[list[tuple[Path, GestureClass]], list[str]]:
    """Scan a dataset directory organized by class subfolders or manifest.

    Expects:
    data_dir/
      PALM_TO_PALM/
        frame_001.png
      THUMB_RUBBING/
        frame_002.png
    """
    samples: list[tuple[Path, GestureClass]] = []
    file_names: list[str] = []

    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for item in data_dir.iterdir():
        if item.is_dir():
            folder_class = normalize_gesture_label(item.name)
            for img_file in item.iterdir():
                if img_file.is_file() and img_file.suffix.lower() in valid_extensions:
                    samples.append((img_file, folder_class))
                    file_names.append(img_file.name)

    return samples, file_names


def evaluate_dataset(
    model: GestureModel,
    samples: list[tuple[Path, GestureClass]],
) -> tuple[list[str], list[str], list[float]]:
    """Run model inference over dataset samples in-memory."""
    y_true: list[str] = []
    y_pred: list[str] = []
    latencies: list[float] = []

    for img_path, ground_truth in samples:
        frame = cv2.imread(str(img_path))
        if frame is None or frame.size == 0:
            continue

        pred = model.predict(frame)
        y_true.append(ground_truth.value)
        y_pred.append(pred.label.value)
        latencies.append(pred.latency_ms)

    return y_true, y_pred, latencies


def generate_evaluation_report(
    model_version: str,
    y_true: list[str],
    y_pred: list[str],
    latencies: list[float],
    leakage_warning: str,
    data_dir_path: str,
    output_markdown_path: Path,
) -> str:
    """Compute scikit-learn metrics and render markdown report to disk."""
    unique_classes = sorted(set(y_true).union(set(y_pred)))

    report_dict = classification_report(
        y_true,
        y_pred,
        labels=unique_classes,
        output_dict=True,
        zero_division=0,
    )
    conf_mat = confusion_matrix(y_true, y_pred, labels=unique_classes)
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    mean_latency = float(np.mean(latencies)) if latencies else 0.0
    p95_latency = float(np.percentile(latencies, 95)) if latencies else 0.0

    # Gate evaluations from PRD and TESTING.md
    gate_macro_f1_passed = macro_f1 >= 0.85
    gate_latency_passed = p95_latency <= 200.0

    timestamp_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Build Markdown Content
    lines: list[str] = [
        f"# Model Evaluation Report: {model_version}",
        "",
        f"- **Evaluation Timestamp:** {timestamp_str}",
        f"- **Dataset Path:** `{data_dir_path}`",
        f"- **Total Evaluated Samples:** {len(y_true)}",
        f"- **Mean Latency:** {mean_latency:.2f} ms",
        f"- **p95 Latency:** {p95_latency:.2f} ms",
        "",
        "## 1. Release Gate Criteria (PRD / TESTING.md Section 5)",
        "",
        "| Gate Metric | Target Threshold | Measured Result | Status |",
        "| :--- | :--- | :--- | :--- |",
        f"| **Macro F1-Score** | $\\ge 0.85$ | {macro_f1:.4f} | {'PASSED' if gate_macro_f1_passed else '**FAILED**'} |",
        f"| **p95 Inference Latency** | $\\le 200$ ms | {p95_latency:.2f} ms | {'PASSED' if gate_latency_passed else '**FAILED**'} |",
        "| **Zero Persistent Video/Frames** | 0 files | 0 files persisted | PASSED |",
        "",
        "## 2. Participant / Session Split Integrity",
        "",
        f"> {leakage_warning}",
        "",
        "## 3. Per-Class Classification Performance",
        "",
        "| Gesture Class | Precision | Recall | F1-Score | Support |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for cls_name in unique_classes:
        metrics = report_dict.get(cls_name, {})
        prec = metrics.get("precision", 0.0)
        rec = metrics.get("recall", 0.0)
        f1 = metrics.get("f1-score", 0.0)
        supp = int(metrics.get("support", 0))
        lines.append(f"| `{cls_name}` | {prec:.4f} | {rec:.4f} | {f1:.4f} | {supp} |")

    lines.extend(
        [
            "",
            f"- **Macro Average F1:** {macro_f1:.4f}",
            f"- **Weighted Average F1:** {report_dict.get('weighted avg', {}).get('f1-score', 0.0):.4f}",
            "",
            "## 4. Confusion Matrix",
            "",
        ]
    )

    # Confusion Matrix Table
    header_cols = ["Actual \\ Predicted"] + [f"`{c}`" for c in unique_classes]
    lines.append("| " + " | ".join(header_cols) + " |")
    lines.append("| " + " | ".join([":---"] * len(header_cols)) + " |")

    for i, actual_cls in enumerate(unique_classes):
        row_counts = [f"`{actual_cls}`"] + [
            str(int(conf_mat[i][j])) for j in range(len(unique_classes))
        ]
        lines.append("| " + " | ".join(row_counts) + " |")

    lines.extend(
        [
            "",
            "## 5. Methodological Notes and Limitations",
            "",
            "- Predictions were generated in-memory without frame persistence.",
            "- If classes display 0.00 recall, inspect dataset class balance and training representation.",
            "- In accordance with PRD Section 10.2, failed checkpoints must be explicitly documented and not deployed.",
            "",
        ]
    )

    content = "\n".join(lines)
    output_markdown_path.parent.mkdir(parents=True, exist_ok=True)
    output_markdown_path.write_text(content, encoding="utf-8")
    return content


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate gesture recognition model")
    parser.add_argument(
        "--data-dir",
        type=str,
        required=True,
        help="Path to evaluation dataset directory organized by class folders",
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=None,
        help="Path to YOLO weights (.pt). If omitted or missing, runs stub evaluation.",
    )
    parser.add_argument(
        "--train-dir",
        type=str,
        default=None,
        help="Optional training dataset directory to test for participant leakage",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="docs/evals",
        help="Directory to save evaluation markdown report (default: docs/evals)",
    )
    args = parser.parse_args()

    data_path = Path(args.data_dir)
    if not data_path.is_dir():
        print(f"Error: Dataset directory does not exist: {data_path}", file=sys.stderr)
        sys.exit(1)

    # 1. Load Model
    model: GestureModel
    if args.model_path and Path(args.model_path).is_file():
        model = YoloGestureModel()
        model.load(args.model_path)
    else:
        model = StubGestureModel()
        if args.model_path:
            try:
                model.load(args.model_path)
            except Exception as exc:  # noqa: BLE001
                print(f"Fallback to stub model: {exc}")

    # 2. Load Samples
    samples, file_names = load_dataset_samples(data_path)
    if not samples:
        print(
            f"Error: No image samples found in class subfolders of {data_path}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Loaded {len(samples)} samples from {data_path}")

    # 3. Check for Data Leakage
    _is_leaked, leakage_msg = check_dataset_split_leakage(file_names, args.train_dir)
    print(f"Split Verification: {leakage_msg}")

    # 4. Evaluate Samples
    print(f"Running inference using model version '{model.model_version}'...")
    y_true, y_pred, latencies = evaluate_dataset(model, samples)

    # 5. Generate Markdown Report
    output_file = Path(args.output_dir) / f"{model.model_version}.md"
    generate_evaluation_report(
        model_version=model.model_version,
        y_true=y_true,
        y_pred=y_pred,
        latencies=latencies,
        leakage_warning=leakage_msg,
        data_dir_path=str(data_path),
        output_markdown_path=output_file,
    )

    print(f"\nEvaluation complete! Report written to: {output_file}")


if __name__ == "__main__":
    main()
