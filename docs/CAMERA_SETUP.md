# Bubsy — Camera Installation & Physical Sink Setup Guide

**Scope:** Hardware positioning, optical framing, splash protection, and privacy verification for school sinks.

---

## 1. Optimal Positioning at the Sink

### Mounting Distance & Height
- **Distance:** Position the camera lens **35 cm to 50 cm** from the center of the sink water stream.
- **Height:** Mount the camera **20 cm to 30 cm** above the top rim of the sink basin.
- **Angle:** Tilt the camera downward at an angle of approximately **$30^\circ$ to $45^\circ$**, focused directly on the area where children naturally rub their hands under or adjacent to the tap.

```
       [Webcam / Lens]
             \  30°-45° downward tilt
              \
               \  35 - 50 cm distance
                v
         +--------------+
         |  Hand Rubbing|
   ~~~~~~|  Zone in Sink|~~~~~~
   ======+==============+======  (Sink Rim)
```

---

## 2. Lighting & Environmental Guidelines

### Recommended Illumination
- **Ambient Light:** Ensure even, diffuse lighting of at least **300 to 500 lux** across the sink area.
- **Avoid Direct Backlight:** Do not position the camera facing directly toward an unshaded window or bright exterior door, as silhouettes degrade gesture segmentation.
- **Basin Reflections:** If using a reflective stainless-steel sink basin, avoid pointing an overhead spotlight directly into the center of the basin to prevent lens flare.

### Water & Splash Protection
- **Enclosure:** Use an acrylic or silicone splash-resistant hood around the webcam body.
- **Maintenance:** Clean the camera lens cover daily using a microfiber cloth and standard alcohol-free optical cleaner.
- **Cables:** Secure all USB cables with waterproof conduit or cable raceways away from water taps and children's reach.

---

## 3. Optical Framing & Field of View

When positioned correctly, the live camera feed should capture:
1. The child's hands and forearms from mid-wrist to fingertips.
2. The central rubbing area above the drain.
3. Adequate margin to prevent hands from moving out of frame during active rubbing.

> [!NOTE]
> The child's face should **not** be framed in the primary wash detection zone. The camera angle should be tilted downward to focus solely on hand movements.

---

## 4. Privacy & Zero-Persistence Architecture

Bubsy strictly implements privacy-by-design at the camera driver layer:

1. **Volatile Memory Only:** Frames captured by OpenCV exist solely as transient NumPy arrays in volatile RAM for inference.
2. **Zero Disk Storage:** No frames, photos, thumbnails, or video clips are ever written to the hard drive, cloud storage, or log files.
3. **No Facial Recognition:** The vision pipeline contains zero face-detection, face-mesh, or biometric identity algorithms.
4. **Visual Indicator:** The kiosk interface clearly displays a bright visual indicator (`Camera Sensor Active`) whenever the video stream is active in memory.
5. **Mode Isolation:** The camera switches cleanly between `IDENTIFY` mode (QR barcode scanning) and `WASH` mode (gesture recognition), releasing the capture stream cleanly when the kiosk returns to the Home screen.
