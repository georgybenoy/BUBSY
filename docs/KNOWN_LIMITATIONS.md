# Bubsy — Known Limitations & Operational Boundaries

**Version:** 1.0  
**Status:** Release Engineering & Pilot Deployment Reference

This document records the technical, physiological, and environmental limitations of the Bubsy handwashing guidance system. All stakeholders, school administrators, and evaluators must take these boundaries into account.

---

## 1. Ethical & Microbiological Disclaimers

### Technique Recognition Does Not Prove Cleanliness
- **Fundamental Invariant:** AI computer vision analyzes geometric hand movements and technique adherence to the WHO 6-step hand rub guidelines.
- **Microbiological Boundary:** Optical gesture recognition **cannot** detect microscopic bacteria, viruses, dirt particles, or chemical residues. Bubsy does **not** certify microbiological cleanliness, sterilization, or germ eradication.
- **Reporting Requirement:** All portal screens, printable badges, and exported CSV reports must carry this explicit disclaimer.

---

## 2. Model Generalization & Anthropometric Discrepancies

### Adult-Trained Models vs. Pediatric Hand Biometrics
- **Hand Proportion Differences:** Models trained predominantly on adult hand datasets may show reduced recall on elementary schoolchildren (ages 5–10). Children exhibit smaller palm surface areas, shorter finger proportions, and different movement dynamics.
- **Sleeve & Clothing Interference:** Loose-fitting uniform sleeves, oversized cuffs, or winter knitwear pulled down over the wrists can partially obscure dorsum and wrist rubbing gestures.
- **Mitigation:** Bubsy incorporates temporal tolerance and flexible duration minimums. Ambiguous frames trigger supportive retry guidance rather than failing the child.

---

## 3. Optical & Environmental Sensitivities

### Lighting Dependence
- **Ambient Light Variation:** Gesture detection accuracy decreases in dimly lit restrooms ($< 150\text{ lux}$) or restrooms with flickering fluorescent ballasts.
- **Direct Sunlight & Basin Glare:** Direct afternoon sun reflecting off stainless-steel basins can saturate the camera sensor, washing out edge definition between fingers.

### Water Droplets, Foam & Occlusion
- **Soap Foam Alteration:** Thick soap lather temporarily changes the optical contour and texture of interlocked fingers, occasionally causing brief drops in classification confidence.
- **Single-Lens Occlusion:** When rubbing the backs of fingers or rotational thumb movements, one hand naturally occludes the other relative to a single fixed camera viewpoint. The temporal sliding window mitigates this by requiring agreement over a multi-frame window rather than instantaneous perfection.

---

## 4. Hardware & Infrastructure Boundaries

### Single-Kiosk Architecture
- **Local Deployment:** The initial release target is a self-contained local kiosk PC (Windows 11) with an attached webcam and local SQLite database in WAL mode.
- **Multi-Sink Synchronization:** Cross-kiosk synchronization across multiple sinks within a large school facility requires network export/import routines. Kiosks operate offline by default to guarantee privacy and uninterrupted availability.

### Hardware Performance
- **CPU Inference Bottlenecks:** Real-time deep learning inference ($> 15\text{ FPS}$) requires sufficient multi-core CPU performance or integrated NPU/GPU acceleration. On low-powered single-board computers, inference latency may exceed the target $200\text{ ms}$ threshold if hardware acceleration is not configured.
