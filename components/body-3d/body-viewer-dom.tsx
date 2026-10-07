'use dom';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { reedBodyMetrics as metrics } from '@/design/system';
import { reedEasing, reedMotion } from '@/design/motion';
import { bodyAssets } from './body-assets';
import { BodyScene } from './body-scene';
import type { BodyAppearance, BodyHighlights, BodyPalette, BodyPick, BodyStatus, BodyVariant } from './contract';
import { decodeBodyAsset } from './decode';

type Props = {
  variant: BodyVariant;
  appearance: BodyAppearance;
  highlights: BodyHighlights;
  selected: string | null;
  palette: BodyPalette;
  view: { angle: 'front' | 'back'; request: number };
  height: number;
  active: boolean;
  reduced: boolean;
  onPick: (pick: BodyPick) => Promise<void>;
  onStatus: (status: BodyStatus) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

// XHR supports the bundled file:// assets in Android's offline Expo DOM component.
function readAsset(source: string | { uri: string }, signal: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', typeof source === 'string' ? source : source.uri);
    request.responseType = 'arraybuffer';
    request.timeout = metrics.loadTimeoutMs;
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    request.onloadend = () => signal.removeEventListener('abort', abort);
    request.onload = () => {
      if ((request.status === 0 || request.status >= 200 && request.status < 300) && request.response instanceof ArrayBuffer) resolve(new Uint8Array(request.response));
      else reject(new Error('Body asset could not be read'));
    };
    request.onerror = request.ontimeout = () => reject(new Error('Body asset load failed'));
    request.onabort = () => reject(new Error('Body asset load cancelled'));
    if (signal.aborted) reject(new Error('Body asset load cancelled'));
    else request.send();
  });
}

type Runtime = { body: BodyScene; renderer: THREE.WebGLRenderer; invalidate: () => void; turn: (yaw: number, reduced: boolean) => void };

export default function BodyViewerDOM(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);

  useEffect(() => {
    const element = host.current!;
    const controller = new AbortController();
    let disposed = false;
    let frame = 0;
    let turnFrame = 0;
    let scene: BodyScene | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let firstFrame = false;
    const started = performance.now();
    const timings: BodyStatus = { state: 'ready' };
    const report = (status: BodyStatus) => { void latest.current.onStatus(status).catch(() => {}); };
    report({ state: 'loading' });
    const invalidate = () => {
      if (disposed || frame || !scene || !renderer || !latest.current.active || document.visibilityState === 'hidden') return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (disposed || !scene || !renderer || !latest.current.active) return;
        renderer.render(scene.scene, scene.camera);
        if (!firstFrame) {
          firstFrame = true;
          report({ ...timings, firstFrameMs: performance.now() - started, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
        }
      });
    };
    const resize = () => {
      if (!scene || !renderer) return;
      const bounds = element.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, metrics.pixelRatioCap));
      renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false);
      scene.frame(bounds.width, bounds.height);
      invalidate();
    };
    const turn = (yaw: number, reduced: boolean) => {
      cancelAnimationFrame(turnFrame);
      if (!scene) return;
      const from = scene.yaw;
      const target = yaw + Math.round((from - yaw) / (Math.PI * 2)) * Math.PI * 2;
      if (reduced) { scene.rotate(target); invalidate(); return; }
      const started = performance.now();
      const tick = (now: number) => {
        if (disposed || !scene) return;
        const progress = Math.min(1, (now - started) / reedMotion.body.turnMs);
        scene.rotate(from + (target - from) * reedEasing.easeInOut(progress));
        invalidate();
        if (progress < 1) turnFrame = requestAnimationFrame(tick);
      };
      turnFrame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    document.addEventListener('visibilitychange', invalidate);
    const lost = (event: Event) => { event.preventDefault(); report({ state: 'error' }); };
    let pointer: { id: number; x: number; y: number; yaw: number; dragging: boolean } | null = null;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) { pointer = null; return; }
      cancelAnimationFrame(turnFrame);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: scene?.yaw ?? 0, dragging: false };
    };
    const move = (event: PointerEvent) => {
      if (!scene || !pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragging && Math.abs(dy) > metrics.dragThreshold && Math.abs(dy) > Math.abs(dx)) { pointer = null; return; }
      if (Math.abs(dx) > metrics.dragThreshold) {
        pointer.dragging = true;
        element.setPointerCapture(event.pointerId);
      }
      if (pointer.dragging) {
        scene.rotate(pointer.yaw - dx * metrics.radiansPerPixel);
        invalidate();
      }
    };
    const up = (event: PointerEvent) => {
      const prior = pointer;
      pointer = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (!scene || !prior || prior.id !== event.pointerId || prior.dragging) return;
      const rect = element.getBoundingClientRect();
      const pick = scene.pick(event.clientX - rect.left, event.clientY - rect.top);
      if (pick) void latest.current.onPick(pick).catch(() => {});
    };
    const cancel = () => { pointer = null; };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    void (async () => {
      try {
        const payload = await readAsset(bodyAssets[props.variant], controller.signal);
        if (disposed) return;
        timings.loadMs = performance.now() - started;
        const decodeStarted = performance.now();
        const bytes = decodeBodyAsset(payload, props.variant);
        timings.decodeMs = performance.now() - decodeStarted;
        const parseStarted = performance.now();
        const gltf = await new GLTFLoader().parseAsync(bytes, '');
        if (disposed) { new BodyScene(gltf.scene, props.variant).dispose(); return; }
        timings.parseMs = performance.now() - parseStarted;
        scene = new BodyScene(gltf.scene, props.variant);
        scene.applyAppearance(latest.current.appearance);
        scene.applyHighlights(latest.current.highlights, latest.current.selected, latest.current.palette);
        scene.rotate(metrics.introYaw + (latest.current.view.angle === 'back' ? Math.PI : 0));
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(latest.current.palette.canvas, 0);
        renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.addEventListener('webglcontextlost', lost);
        element.appendChild(renderer.domElement);
        runtime.current = { body: scene, renderer, invalidate, turn };
        resize();
      } catch {
        if (!disposed) report({ state: 'error' });
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(turnFrame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', invalidate);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      runtime.current = null;
      scene?.dispose();
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', lost);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };
  }, [props.variant]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.body.applyAppearance(props.appearance);
    current.body.applyHighlights(props.highlights, props.selected, props.palette);
    current.renderer.setClearColor(props.palette.canvas, 0);
    current.invalidate();
  }, [props.appearance, props.highlights, props.selected, props.palette, props.active]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    current.turn(metrics.introYaw + (props.view.angle === 'back' ? Math.PI : 0), props.reduced);
  }, [props.view.angle, props.view.request, props.reduced]);

  return <div ref={host} role="img" aria-label="Body figure. Drag horizontally to rotate. Use the area list to select by name." style={{ height: props.height, width: '100%', background: 'transparent', overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none' }} />;
}
