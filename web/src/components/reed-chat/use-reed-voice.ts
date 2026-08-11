'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceState } from './reed-chat-types';

const MIN_RECORDING_MS = 350;
const RETRY_DELAYS_MS = [700, 1600];

export function useReedVoice(onText: (text: string) => void) {
  const { getToken } = useAuth();
  const [state, setState] = useState<VoiceState>({ error: null, level: 0, status: 'idle' });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cachedRecordingRef = useRef<Blob | null>(null);
  const discardOnStopRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    stopMeter();
  }, [stopMeter]);

  const transcribe = useCallback(async (recording: Blob) => {
    setState({ error: null, level: 0, status: 'transcribing' });
    try {
      const transcript = await transcribeRecording(recording, getToken);
      cachedRecordingRef.current = null;
      onText(transcript);
      setState({ error: null, level: 0, status: 'idle' });
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : 'Could not transcribe audio.',
        level: 0,
        status: 'failed',
      });
    }
  }, [getToken, onText]);

  const startMeter = useCallback((stream: MediaStream) => {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    analyserRef.current = analyser;
    audioContextRef.current = context;
    const values = new Uint8Array(analyser.fftSize);

    const tick = () => {
      const activeAnalyser = analyserRef.current;
      if (!activeAnalyser) return;
      activeAnalyser.getByteTimeDomainData(values);
      let sum = 0;
      for (const value of values) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      const level = Math.min(1, Math.sqrt(sum / values.length) * 4.5);
      setState(current => current.status === 'listening' ? { ...current, level } : current);
      meterFrameRef.current = requestAnimationFrame(tick);
    };
    meterFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (state.status === 'listening' || state.status === 'transcribing') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState({ error: 'Voice input is not supported by this browser.', level: 0, status: 'failed' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardOnStopRef.current = false;
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = Date.now() - startedAtRef.current;
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        recorderRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = 0;
        stopStream();
        if (discardOnStopRef.current) {
          discardOnStopRef.current = false;
          return;
        }
        if (duration < MIN_RECORDING_MS || recording.size === 0) {
          setState({ error: 'Recording is too short.', level: 0, status: 'failed' });
          return;
        }
        cachedRecordingRef.current = recording;
        void transcribe(recording);
      };
      recorder.onerror = () => {
        stopStream();
        setState({ error: 'Could not record audio.', level: 0, status: 'failed' });
      };

      recorder.start(200);
      startMeter(stream);
      setState({ error: null, level: 0, status: 'listening' });
    } catch (error) {
      stopStream();
      setState({
        error: error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone permission is required.'
          : 'Could not start voice input.',
        level: 0,
        status: 'failed',
      });
    }
  }, [startMeter, state.status, stopStream, transcribe]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const retry = useCallback(() => {
    if (cachedRecordingRef.current && state.status !== 'transcribing') void transcribe(cachedRecordingRef.current);
  }, [state.status, transcribe]);

  const reset = useCallback(() => {
    cachedRecordingRef.current = null;
    if (recorderRef.current?.state === 'recording') {
      discardOnStopRef.current = true;
      recorderRef.current.stop();
    } else {
      stopStream();
    }
    setState({ error: null, level: 0, status: 'idle' });
  }, [stopStream]);

  useEffect(() => () => {
    discardOnStopRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopStream();
  }, [stopStream]);

  return { reset, retry, start, state, stop };
}

async function transcribeRecording(
  recording: Blob,
  getToken: (options?: { template?: string }) => Promise<string | null>,
) {
  const siteUrl = convexSiteUrl();
  if (!siteUrl) throw new Error('Voice transcription is not configured for this build.');
  const token = await getToken({ template: 'convex' });
  if (!token) throw new Error('You need to be signed in to transcribe audio.');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append('actor', 'chat');
      formData.append('audio', recording, recordingName(recording.type));
      const response = await fetch(`${siteUrl}/speech/transcribe`, {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: 'POST',
      });
      const result = await response.json().catch(() => ({})) as { error?: string; text?: string };
      if (!response.ok) {
        const error = new Error(result.error || 'Could not transcribe audio.');
        if (response.status !== 408 && response.status !== 429 && response.status < 500) throw error;
        lastError = error;
      } else if (result.text?.trim()) {
        return result.text.trim();
      } else {
        throw new Error('No speech was detected.');
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not transcribe audio.');
      if (attempt === 2) break;
    }

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt] ?? 1600));
  }
  throw lastError ?? new Error('Could not transcribe audio.');
}

function preferredMimeType() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
}

function recordingName(mimeType: string) {
  if (mimeType.includes('mp4')) return `speech-${Date.now()}.m4a`;
  return `speech-${Date.now()}.webm`;
}

function convexSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  return process.env.NEXT_PUBLIC_CONVEX_URL?.replace(/\.convex\.cloud\/?$/, '.convex.site') ?? '';
}
