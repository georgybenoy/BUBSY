"""Gesture model inference benchmark script for Bubsy.

Measures:
- Cold model load time
- Inference latency distribution (Mean, Median, p95, p99, Min, Max)
- Sustained throughput (FPS)
- CPU utilization and RAM memory footprint over a 60-second test window

Privacy constraint:
- Frames are generated synthetically in-memory. Zero images or videos are saved to disk.
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import psutil

# Add backend directory to sys.path so app modules import cleanly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.vision.inference import (
    GestureModel,
    StubGestureModel,
    YoloGestureModel,
)


def run_benchmark(
    model_path: str | None = None,
    duration_seconds: float = 60.0,
    warmup_iterations: int = 15,
    width: int = 640,
    height: int = 480,
) -> dict[str, float | int | str]:
    """Execute a sustained inference benchmark and return performance metrics."""
    process = psutil.Process(os.getpid())
    initial_mem_mb = process.memory_info().rss / (1024 * 1024)

    # 1. Cold Load Measurement
    cold_load_start = time.perf_counter()
    model: GestureModel

    if model_path and Path(model_path).is_file():
        model = YoloGestureModel()
        model.load(model_path)
    else:
        model = StubGestureModel()
        if model_path:
            try:
                model.load(model_path)
            except Exception as exc:  # noqa: BLE001
                print(f"Fallback to default stub due to load error: {exc}")

    cold_load_time_ms = (time.perf_counter() - cold_load_start) * 1000.0

    # 2. Warm-up Iterations
    dummy_frame = np.zeros((height, width, 3), dtype=np.uint8)
    for _ in range(warmup_iterations):
        _ = model.predict(dummy_frame)

    # 3. Sustained Benchmark Loop (duration_seconds)
    latencies: list[float] = []
    cpu_samples: list[float] = []
    ram_samples: list[float] = []

    # Prime CPU measurement
    _ = process.cpu_percent(interval=None)

    bench_start_time = time.perf_counter()
    last_sample_time = bench_start_time

    frame_count = 0
    # Pre-allocate two in-memory frames to alternate patterns without GC noise
    frame_a = np.full((height, width, 3), 128, dtype=np.uint8)
    frame_b = np.full((height, width, 3), 200, dtype=np.uint8)

    while True:
        now = time.perf_counter()
        elapsed = now - bench_start_time
        if elapsed >= duration_seconds:
            break

        current_frame = frame_a if (frame_count % 2 == 0) else frame_b

        # Measure predict latency
        t0 = time.perf_counter()
        _ = model.predict(current_frame)
        latency_ms = (time.perf_counter() - t0) * 1000.0
        latencies.append(latency_ms)
        frame_count += 1

        # Sample resource consumption approximately every 0.5 seconds
        if now - last_sample_time >= 0.5:
            cpu_val = process.cpu_percent(interval=None)
            mem_mb = process.memory_info().rss / (1024 * 1024)
            cpu_samples.append(cpu_val)
            ram_samples.append(mem_mb)
            last_sample_time = now

    actual_duration = time.perf_counter() - bench_start_time
    peak_mem_mb = max(ram_samples) if ram_samples else initial_mem_mb
    mean_cpu = float(np.mean(cpu_samples)) if cpu_samples else 0.0
    peak_cpu = float(np.max(cpu_samples)) if cpu_samples else 0.0

    lat_arr = np.array(latencies)
    mean_lat = float(np.mean(lat_arr))
    p50_lat = float(np.percentile(lat_arr, 50))
    p95_lat = float(np.percentile(lat_arr, 95))
    p99_lat = float(np.percentile(lat_arr, 99))
    min_lat = float(np.min(lat_arr))
    max_lat = float(np.max(lat_arr))
    fps = frame_count / actual_duration

    return {
        "model_version": model.model_version,
        "model_type": type(model).__name__,
        "duration_seconds": actual_duration,
        "total_frames": frame_count,
        "throughput_fps": fps,
        "cold_load_time_ms": cold_load_time_ms,
        "latency_mean_ms": mean_lat,
        "latency_p50_ms": p50_lat,
        "latency_p95_ms": p95_lat,
        "latency_p99_ms": p99_lat,
        "latency_min_ms": min_lat,
        "latency_max_ms": max_lat,
        "cpu_mean_pct": mean_cpu,
        "cpu_peak_pct": peak_cpu,
        "ram_initial_mb": initial_mem_mb,
        "ram_peak_mb": peak_mem_mb,
        "ram_delta_mb": peak_mem_mb - initial_mem_mb,
    }


def print_benchmark_table(metrics: dict[str, Any]) -> None:
    """Print benchmark results in a clean formatted ASCII table."""
    separator = "+" + "-" * 38 + "+" + "-" * 26 + "+"
    print("\n" + separator)
    print(f"| {'BUBSY VISION INFERENCE BENCHMARK':^65} |")
    print(separator)
    print(f"| {'Metric':<36} | {'Value':<24} |")
    print(separator)
    print(
        f"| Model Version                        | {metrics['model_version']!s:<24} |"
    )
    print(f"| Model Engine                         | {metrics['model_type']!s:<24} |")
    print(
        f"| Cold Model Load Time                 | {metrics['cold_load_time_ms']:>18.2f} ms |"
    )
    print(
        f"| Benchmark Duration                   | {metrics['duration_seconds']:>19.2f} s |"
    )
    print(
        f"| Total Processed Frames               | {metrics['total_frames']:>21,d}  |"
    )
    print(
        f"| Average Throughput                   | {metrics['throughput_fps']:>18.1f} fps |"
    )
    print(separator)
    print(
        f"| Inference Latency (Mean)             | {metrics['latency_mean_ms']:>18.2f} ms |"
    )
    print(
        f"| Inference Latency (Median / p50)     | {metrics['latency_p50_ms']:>18.2f} ms |"
    )
    print(
        f"| Inference Latency (95th Percentile)  | {metrics['latency_p95_ms']:>18.2f} ms |"
    )
    print(
        f"| Inference Latency (99th Percentile)  | {metrics['latency_p99_ms']:>18.2f} ms |"
    )
    print(
        f"| Inference Latency (Min / Max)        | {metrics['latency_min_ms']:>7.2f} / {metrics['latency_max_ms']:<8.2f} ms |"
    )
    print(separator)
    print(
        f"| Average Process CPU                  | {metrics['cpu_mean_pct']:>20.1f} % |"
    )
    print(
        f"| Peak Process CPU                     | {metrics['cpu_peak_pct']:>20.1f} % |"
    )
    print(
        f"| Initial Memory RSS                   | {metrics['ram_initial_mb']:>18.1f} MB |"
    )
    print(
        f"| Peak Memory RSS                      | {metrics['ram_peak_mb']:>18.1f} MB |"
    )
    print(
        f"| Memory Delta                         | {metrics['ram_delta_mb']:>18.1f} MB |"
    )
    print(separator)

    # Verification of PRD Target Gate (p95 <= 200 ms)
    p95 = metrics["latency_p95_ms"]
    gate_passed = p95 <= 200.0
    gate_status = "PASSED (< 200 ms)" if gate_passed else "FAILED (> 200 ms)"
    print(f"| PRD Target Gate (p95 <= 200 ms)      | {gate_status:<24} |")
    print(separator + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bubsy Gesture Inference Benchmark")
    parser.add_argument(
        "--model-path",
        type=str,
        default=None,
        help="Path to YOLO weights file (.pt). If omitted or missing, runs stub baseline.",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=60.0,
        help="Benchmark duration in seconds (default: 60.0)",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=15,
        help="Number of warm-up iterations (default: 15)",
    )
    parser.add_argument(
        "--width", type=int, default=640, help="Frame width (default: 640)"
    )
    parser.add_argument(
        "--height", type=int, default=480, help="Frame height (default: 480)"
    )
    args = parser.parse_args()

    print(f"Starting inference benchmark for {args.duration:.1f} seconds...")
    metrics = run_benchmark(
        model_path=args.model_path,
        duration_seconds=args.duration,
        warmup_iterations=args.warmup,
        width=args.width,
        height=args.height,
    )
    print_benchmark_table(metrics)


if __name__ == "__main__":
    main()
