"""Handwashing gesture class enum and label normalization map.

Defines the stable internal gesture classes from FR-GUIDE-03:
the six WHO/CDC hand-rubbing movements plus IDLE/BACKGROUND and UNKNOWN.
"""

from enum import Enum
from typing import Any


class GestureClass(str, Enum):
    """Stable internal gesture classes for the Bubsy guidance pipeline."""

    PALM_TO_PALM = "PALM_TO_PALM"
    PALM_OVER_DORSUM = "PALM_OVER_DORSUM"
    FINGERS_INTERLACED = "FINGERS_INTERLACED"
    BACKS_OF_FINGERS = "BACKS_OF_FINGERS"
    THUMB_RUBBING = "THUMB_RUBBING"
    FINGERTIPS = "FINGERTIPS"
    IDLE_BACKGROUND = "IDLE_BACKGROUND"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def rubbing_movements(cls) -> list["GestureClass"]:
        """Return the six active hand-rubbing movements defined in FR-GUIDE-03."""
        return [
            cls.PALM_TO_PALM,
            cls.PALM_OVER_DORSUM,
            cls.FINGERS_INTERLACED,
            cls.BACKS_OF_FINGERS,
            cls.THUMB_RUBBING,
            cls.FINGERTIPS,
        ]


# Normalization map supporting common raw model labels, numbers, and aliases
LABEL_NORMALIZATION_MAP: dict[str, GestureClass] = {
    # 1. Palm-to-palm
    "palm_to_palm": GestureClass.PALM_TO_PALM,
    "palm-to-palm": GestureClass.PALM_TO_PALM,
    "palm_palm": GestureClass.PALM_TO_PALM,
    "palms": GestureClass.PALM_TO_PALM,
    "step1": GestureClass.PALM_TO_PALM,
    "step_1": GestureClass.PALM_TO_PALM,
    "0": GestureClass.PALM_TO_PALM,
    # 2. Right palm over left dorsum and vice versa
    "palm_over_dorsum": GestureClass.PALM_OVER_DORSUM,
    "palm-over-dorsum": GestureClass.PALM_OVER_DORSUM,
    "dorsum": GestureClass.PALM_OVER_DORSUM,
    "back_of_hand": GestureClass.PALM_OVER_DORSUM,
    "step2": GestureClass.PALM_OVER_DORSUM,
    "step_2": GestureClass.PALM_OVER_DORSUM,
    "1": GestureClass.PALM_OVER_DORSUM,
    # 3. Palm-to-palm with fingers interlaced
    "fingers_interlaced": GestureClass.FINGERS_INTERLACED,
    "fingers-interlaced": GestureClass.FINGERS_INTERLACED,
    "interlaced": GestureClass.FINGERS_INTERLACED,
    "between_fingers": GestureClass.FINGERS_INTERLACED,
    "step3": GestureClass.FINGERS_INTERLACED,
    "step_3": GestureClass.FINGERS_INTERLACED,
    "2": GestureClass.FINGERS_INTERLACED,
    # 4. Backs of fingers against opposing palms
    "backs_of_fingers": GestureClass.BACKS_OF_FINGERS,
    "backs-of-fingers": GestureClass.BACKS_OF_FINGERS,
    "finger_backs": GestureClass.BACKS_OF_FINGERS,
    "interlocked": GestureClass.BACKS_OF_FINGERS,
    "opposing_palms": GestureClass.BACKS_OF_FINGERS,
    "step4": GestureClass.BACKS_OF_FINGERS,
    "step_4": GestureClass.BACKS_OF_FINGERS,
    "3": GestureClass.BACKS_OF_FINGERS,
    # 5. Rotational rubbing of each thumb
    "thumb_rubbing": GestureClass.THUMB_RUBBING,
    "thumb-rubbing": GestureClass.THUMB_RUBBING,
    "thumbs": GestureClass.THUMB_RUBBING,
    "thumb": GestureClass.THUMB_RUBBING,
    "rotational_thumb": GestureClass.THUMB_RUBBING,
    "step5": GestureClass.THUMB_RUBBING,
    "step_5": GestureClass.THUMB_RUBBING,
    "4": GestureClass.THUMB_RUBBING,
    # 6. Rotational rubbing of fingertips against opposing palms
    "fingertips": GestureClass.FINGERTIPS,
    "rotational_fingertips": GestureClass.FINGERTIPS,
    "finger_tips": GestureClass.FINGERTIPS,
    "nails": GestureClass.FINGERTIPS,
    "step6": GestureClass.FINGERTIPS,
    "step_6": GestureClass.FINGERTIPS,
    "5": GestureClass.FINGERTIPS,
    # Idle / Background
    "idle": GestureClass.IDLE_BACKGROUND,
    "background": GestureClass.IDLE_BACKGROUND,
    "idle_background": GestureClass.IDLE_BACKGROUND,
    "idle/background": GestureClass.IDLE_BACKGROUND,
    "none": GestureClass.IDLE_BACKGROUND,
    "no_action": GestureClass.IDLE_BACKGROUND,
    "6": GestureClass.IDLE_BACKGROUND,
    # Unknown
    "unknown": GestureClass.UNKNOWN,
    "uncertain": GestureClass.UNKNOWN,
    "-1": GestureClass.UNKNOWN,
}


def normalize_gesture_label(raw_label: Any) -> GestureClass:
    """Normalize a raw model output label or class index to a stable GestureClass.

    Falls back safely to GestureClass.UNKNOWN if the label cannot be mapped.
    """
    if raw_label is None:
        return GestureClass.UNKNOWN

    if isinstance(raw_label, GestureClass):
        return raw_label

    cleaned_key = str(raw_label).strip().lower().replace(" ", "_")

    # Direct match in normalization dictionary
    if cleaned_key in LABEL_NORMALIZATION_MAP:
        return LABEL_NORMALIZATION_MAP[cleaned_key]

    # Upper case direct member match (e.g., "PALM_TO_PALM")
    try:
        return GestureClass(str(raw_label).strip().upper())
    except ValueError:
        pass

    return GestureClass.UNKNOWN
