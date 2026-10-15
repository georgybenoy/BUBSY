# Bubsy AI Models

This directory holds the approved model weights for gesture recognition in Bubsy.

## Policy: No Model Weights Committed

Per `AGENTS.md` and repository policy, binary model weight files (such as `*.pt`, `*.onnx`, `*.engine`) must **never** be committed to version control. The `.gitignore` configuration explicitly ignores `models/*.pt`.

## Handwashing Gesture Recognition Model

Bubsy utilizes an Ultralytics YOLO model trained to classify the 6 WHO-recommended handwashing rubbing motions:
1. `palm_to_palm`: Palm-to-palm rubbing.
2. `palm_over_dorsum`: Palm over opposite dorsum and vice versa.
3. `palm_fingers_interlaced`: Palm-to-palm rubbing with interlaced fingers.
4. `backs_of_fingers`: Backs of fingers against opposing palms.
5. `rotational_rubbing_thumbs`: Rotational rubbing of each thumb.
6. `rotational_rubbing_fingertips`: Rotational rubbing of fingertips against opposing palms.

## How to Obtain and Install Approved Model Weights

1. **Approved Weights Distribution:**
   Obtain the validated model weights file (e.g. `bubsy_yolo_v1.pt`) from the authorized project artifact store or supervisor-approved distribution channel.

2. **Placement:**
   Copy the weight file into this directory:
   ```
   models/bubsy_yolo_v1.pt
   ```

3. **Configuration:**
   Update your `.env` file in the root / backend directory:
   ```env
   BUBSY_MODEL_PATH=models/bubsy_yolo_v1.pt
   BUBSY_MODEL_VERSION=1.0.0
   ```

4. **Checksum & Verification:**
   Before deployment, verify the SHA-256 checksum against the release manifest provided in your deployment documentation:
   ```powershell
   Get-FileHash models\bubsy_yolo_v1.pt -Algorithm SHA256
   ```

5. **Local Inference Testing:**
   Validate that the model loads and executes on your target device within latency constraints (< 200 ms p95 processing latency per analyzed frame) using the test suite:
   ```powershell
   pytest backend/tests/test_vision.py
   ```
