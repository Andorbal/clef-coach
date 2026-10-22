/**
 * Choosing which audio input the app listens to.
 *
 * Browsers open the system's default input unless a page asks for another, and
 * on a Mac that is usually the built-in microphone even with an audio interface
 * (an iRig, a Scarlett…) plugged in. So the player can pick an input, and the
 * choice is remembered on this device.
 *
 * Device ids are opaque and not always stable (Safari hands out new ones when
 * site data is cleared), so a choice keeps the device's name as well and falls
 * back to matching by name.
 *
 * An input fed by a cable can't hear the speakers, so it needs none of the
 * mic's guards against hearing the app's own notes, and it can be played back
 * to the player without feedback. Whether an input is such a "direct" one is
 * the player's call; {@link looksLikeLineInput} only supplies the first guess.
 */

/** An audio input the browser offers. */
export interface AudioInputInfo {
  id: string;
  label: string;
}

/** The input chosen on this device (see DeviceSettings.micDevice). */
export interface InputDevicePref {
  id: string;
  label: string;
  /** Plugged in with a cable (an audio interface), so it can't hear the speakers. Unset: guess from the name. */
  direct?: boolean;
}

/** Chrome's aliases for whichever device is the system default: the app offers its own "system default". */
const ALIAS_IDS = new Set(['default', 'communications']);

/** The inputs worth offering, from `enumerateDevices()` (labels are empty until mic permission is granted). */
export function audioInputs(devices: readonly { kind: string; deviceId: string; label: string }[]): AudioInputInfo[] {
  const out: AudioInputInfo[] = [];
  for (const d of devices) {
    if (d.kind !== 'audioinput' || !d.deviceId || ALIAS_IDS.has(d.deviceId)) continue;
    if (out.some(o => o.id === d.deviceId)) continue;
    out.push({ id: d.deviceId, label: d.label || `Input ${out.length + 1}` });
  }
  return out;
}

/** A device name without Chrome's USB vendor:product suffix, for matching across browsers and sessions. */
function normaliseLabel(label: string): string {
  return label
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

/** Do two names describe the same device? */
export function sameDeviceLabel(a: string, b: string): boolean {
  const na = normaliseLabel(a);
  return na !== '' && na === normaliseLabel(b);
}

/** The available input matching a saved choice (by id, then by name), or null for the system default. */
export function resolveInputDevice(inputs: readonly AudioInputInfo[], pref: InputDevicePref | null | undefined): AudioInputInfo | null {
  if (!pref) return null;
  return inputs.find(d => d.id === pref.id) ?? inputs.find(d => sameDeviceLabel(d.label, pref.label)) ?? null;
}

/** Names that say "microphone" win: IK's iRig Mic is a microphone, the iRig USB is not. */
const MIC_WORDS = /\bmic\b|microphone|headset|airpods|webcam|camera|iphone|continuity/i;
const INTERFACE_WORDS = /irig|audio interface|\binterface\b|line in|\bline\b|instrument|guitar|\bbass\b|scarlett|focusrite|audient|presonus|motu|steinberg|universal audio|apollo|volt\b|behringer|umc\d|zoom|boss|helix|katana|positive grid|spark|guitarlink|jamlink|rocksmith/i;

/** First guess at whether an input is fed by a cable rather than a microphone. */
export function looksLikeLineInput(label: string): boolean {
  if (!label || MIC_WORDS.test(label)) return false;
  return INTERFACE_WORDS.test(label);
}

/** Whether an opened input is direct: the player's say for their chosen device, otherwise a guess from its name. */
export function isDirectInput(opened: AudioInputInfo | null, pref: InputDevicePref | null | undefined): boolean {
  if (!opened) return false;
  if (pref?.direct !== undefined && (opened.id === pref.id || sameDeviceLabel(opened.label, pref.label))) return pref.direct;
  return looksLikeLineInput(opened.label);
}
