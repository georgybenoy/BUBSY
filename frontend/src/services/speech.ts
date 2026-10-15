/**
 * Speech synthesis helper using the Web Speech API.
 * Feature-detected, fully optional, and offline-safe.
 */

let speechEnabled = false;

export function setSpeechEnabled(enabled: boolean): void {
  speechEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors in non-standard browsers
    }
  }
}

export function isSpeechEnabled(): boolean {
  return speechEnabled;
}

export function speakInstruction(text: string, lang = 'en-US'): void {
  if (!speechEnabled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    // Cancel existing utterance to prevent speech backlog
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly slower, child-friendly speaking rate
    utterance.pitch = 1.1; // Friendly higher pitch
    window.speechSynthesis.speak(utterance);
  } catch {
    // Non-fatal, speech is strictly optional
  }
}
