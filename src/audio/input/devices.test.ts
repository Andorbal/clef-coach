import { describe, expect, it } from 'vitest';
import { audioInputs, isDirectInput, looksLikeLineInput, resolveInputDevice, sameDeviceLabel } from './devices';

const IRIG = { id: 'a1', label: 'iRig USB' };
const MAC_MIC = { id: 'b2', label: 'MacBook Pro Microphone' };

describe('audioInputs', () => {
  it('keeps real inputs once each, without Chrome’s default aliases or outputs', () => {
    const list = audioInputs([
      { kind: 'audioinput', deviceId: 'default', label: 'Default - MacBook Pro Microphone' },
      { kind: 'audioinput', deviceId: 'communications', label: 'Communications - MacBook Pro Microphone' },
      { kind: 'audioinput', deviceId: 'b2', label: 'MacBook Pro Microphone' },
      { kind: 'audioinput', deviceId: 'a1', label: 'iRig USB (1963:00f1)' },
      { kind: 'audioinput', deviceId: 'a1', label: 'iRig USB (1963:00f1)' },
      { kind: 'audiooutput', deviceId: 'c3', label: 'iRig USB' },
      { kind: 'videoinput', deviceId: 'd4', label: 'FaceTime HD Camera' },
    ]);
    expect(list).toEqual([MAC_MIC, { id: 'a1', label: 'iRig USB (1963:00f1)' }]);
  });

  it('names inputs before permission, when the browser hides their labels', () => {
    expect(audioInputs([{ kind: 'audioinput', deviceId: 'x', label: '' }])).toEqual([{ id: 'x', label: 'Input 1' }]);
  });
});

describe('resolveInputDevice', () => {
  it('is the system default without a choice', () => {
    expect(resolveInputDevice([IRIG, MAC_MIC], undefined)).toBeNull();
  });

  it('finds the choice by id, then by name when the id has changed', () => {
    expect(resolveInputDevice([MAC_MIC, IRIG], { id: 'a1', label: 'whatever' })).toBe(IRIG);
    expect(resolveInputDevice([MAC_MIC, IRIG], { id: 'stale', label: 'iRig USB (1963:00f1)' })).toBe(IRIG);
  });

  it('is null when the chosen device is unplugged', () => {
    expect(resolveInputDevice([MAC_MIC], { id: 'a1', label: 'iRig USB' })).toBeNull();
  });
});

describe('sameDeviceLabel', () => {
  it('ignores Chrome’s USB ids and case, but not an empty name', () => {
    expect(sameDeviceLabel('iRig USB (1963:00f1)', 'irig usb')).toBe(true);
    expect(sameDeviceLabel('iRig USB', 'iRig HD X')).toBe(false);
    expect(sameDeviceLabel('', '')).toBe(false);
  });
});

describe('looksLikeLineInput', () => {
  it('guesses audio interfaces are plugged in with a cable', () => {
    for (const l of ['iRig USB', 'iRig HD X', 'Scarlett 2i2 USB', 'Focusrite USB Audio', 'Line In', 'BOSS KATANA', 'Volt 1', 'UMC204HD 192k']) expect(looksLikeLineInput(l)).toBe(true);
  });

  it('guesses microphones, headsets and phones are not', () => {
    for (const l of ['MacBook Pro Microphone', 'iRig Mic HD 2', 'Headset Microphone', 'AirPods Pro', 'Andrew’s iPhone 7 Microphone', 'iPad Microphone', 'Yeti Stereo Microphone', 'USB Audio Device', '']) {
      expect(looksLikeLineInput(l)).toBe(false);
    }
  });
});

describe('isDirectInput', () => {
  it('follows the player’s say for their chosen device', () => {
    expect(isDirectInput(MAC_MIC, { ...MAC_MIC, direct: true })).toBe(true);
    expect(isDirectInput(IRIG, { ...IRIG, direct: false })).toBe(false);
  });

  it('guesses from the name otherwise', () => {
    expect(isDirectInput(IRIG, undefined)).toBe(true);
    expect(isDirectInput(IRIG, { ...IRIG })).toBe(true);
    expect(isDirectInput(MAC_MIC, null)).toBe(false);
  });

  it('never trusts a choice for a different device: a fallback to the built-in mic stays a mic', () => {
    expect(isDirectInput(MAC_MIC, { ...IRIG, direct: true })).toBe(false);
    expect(isDirectInput(null, { ...IRIG, direct: true })).toBe(false);
  });
});
