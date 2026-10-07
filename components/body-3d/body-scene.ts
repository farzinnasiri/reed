import * as THREE from 'three';
import { reedBodyMetrics as metrics } from '@/design/system';
import { clampMorph, manifest, regionById, regionForTriangle, resolveMuscles, type BodyAppearance, type BodyHighlights, type BodyPalette, type BodyPick, type BodyVariant } from './contract';

/** Owns one decoded body. Never merges/reorders its geometry: picking uses exported triangles. */
export class BodyScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10);
  readonly body: THREE.Mesh;
  readonly meshes: THREE.Mesh[] = [];
  readonly patches = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();
  readonly raycaster = new THREE.Raycaster();
  yaw: number = metrics.introYaw;
  width = 1;
  height = 1;

  constructor(readonly model: THREE.Group, readonly variant: BodyVariant) {
    const contract = manifest.variants[variant];
    const body = model.getObjectByName(contract.bodyNode);
    if (!(body instanceof THREE.Mesh) || !body.geometry.index) throw new Error('Missing continuous indexed body');
    this.body = body;
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      if (!node.morphTargetInfluences || node.morphTargetInfluences.length !== 3 ||
        node.morphTargetDictionary?.adiposity !== 0 || node.morphTargetDictionary?.muscularity !== 1 || node.morphTargetDictionary?.fullness_corrective !== 2) {
        throw new Error('Body morph contract mismatch');
      }
      node.castShadow = false;
      node.receiveShadow = false;
      this.meshes.push(node);
    });
    if (this.meshes.length !== contract.meshCount || body.geometry.index.count / 3 !== contract.visibleTriangles) throw new Error('Body topology mismatch');
    for (const patch of contract.highlightNodes) {
      const node = model.getObjectByName(patch.node);
      if (!(node instanceof THREE.Mesh) || Array.isArray(node.material) || !(node.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing body highlight');
      node.material = node.material.clone();
      Object.assign(node.material, { transparent: true, alphaTest: 0, depthTest: true, depthWrite: false, side: THREE.FrontSide, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      node.renderOrder = patch.kind === 'pain' ? 2 : 1;
      node.visible = false;
      this.patches.set(patch.node, node as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>);
    }
    this.scene.add(model, new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.2);
    fill.position.set(2, 1, -3);
    this.scene.add(fill);
    // A conservative envelope avoids base-shape raycast bounds rejecting morphed geometry.
    const bounds = contract.morphEnvelopeBounds;
    body.geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
    body.geometry.boundingSphere = body.geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    this.frame(1, 1);
  }

  applyAppearance(appearance: BodyAppearance) {
    const a = clampMorph(appearance.adiposity);
    const m = clampMorph(appearance.muscularity);
    for (const mesh of this.meshes) {
      const weights = mesh.morphTargetInfluences!;
      weights[0] = a;
      weights[1] = m;
      weights[2] = a * m; // Includes every hidden patch, so later activation stays on the skin.
    }
  }

  applyHighlights(highlights: BodyHighlights, selected: string | null, palette: BodyPalette) {
    for (const mesh of this.patches.values()) mesh.visible = false;
    const primary = resolveMuscles(highlights.primary);
    const secondary = resolveMuscles(highlights.secondary);
    const show = (name: string, color: string, opacity: number) => {
      const mesh = this.patches.get(name);
      if (!mesh) return;
      mesh.material.color.set(color);
      mesh.material.opacity = opacity;
      mesh.visible = true;
    };
    for (const id of secondary) if (!primary.has(id)) show(`muscle_${id}`, palette.secondary, metrics.secondaryStrength);
    for (const id of primary) show(`muscle_${id}`, palette.primary, metrics.primaryStrength);
    for (const [id, intensity] of Object.entries(highlights.pain)) {
      if (Number.isInteger(intensity) && intensity > 0 && intensity < palette.pain.length) show(`pain_${id}`, palette.pain[intensity], metrics.painStrength);
    }
    if (selected && !highlights.pain[selected]) show(`pain_${selected}`, palette.pending, metrics.pendingStrength);
  }

  frame(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const bounds = manifest.variants[this.variant].morphEnvelopeBounds;
    const horizontal = Math.max(Math.abs(bounds.min[0]), bounds.max[0], Math.abs(bounds.min[2]), bounds.max[2]) * 2;
    const vertical = bounds.max[1] - bounds.min[1];
    const halfHeight = Math.max(vertical, horizontal / (this.width / this.height)) * metrics.framePadding / 2;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.right = halfHeight * this.width / this.height;
    this.camera.left = -this.camera.right;
    this.camera.updateProjectionMatrix();
    this.rotate(this.yaw);
  }

  rotate(yaw: number) {
    this.yaw = yaw;
    const bounds = manifest.variants[this.variant].morphEnvelopeBounds;
    const center = (bounds.max[1] + bounds.min[1]) / 2;
    this.camera.position.set(Math.sin(yaw) * metrics.cameraDistance, center + metrics.cameraElevation, Math.cos(yaw) * metrics.cameraDistance);
    this.camera.lookAt(0, center, 0);
    this.camera.updateMatrixWorld();
    this.model.updateMatrixWorld(true);
  }

  anchor(id: string): THREE.Vector3 | null {
    const anchor = Object.entries(manifest.variants[this.variant].selectionAnchors).find(([key]) => key === id)?.[1];
    const index = this.body.geometry.index;
    if (!anchor || !index) return null;
    const point = new THREE.Vector3();
    for (let corner = 0; corner < 3; corner++) {
      point.addScaledVector(this.body.getVertexPosition(index.getX(anchor.triangle * 3 + corner), new THREE.Vector3()), anchor.barycentric[corner]);
    }
    return this.body.localToWorld(point);
  }

  project(point: THREE.Vector3) {
    const projected = point.clone().project(this.camera);
    return { x: (projected.x + 1) * this.width / 2, y: (1 - projected.y) * this.height / 2 };
  }

  private hit(x: number, y: number) {
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    return this.raycaster.intersectObject(this.body, false)[0];
  }

  private answer(id: string, x: number, y: number): BodyPick | null {
    const region = regionById.get(id);
    return region ? { regionId: id, area: region.storedAreaLabel, view: Math.cos(this.yaw) >= 0 ? 'front' : 'back', x: x / this.width, y: y / this.height } : null;
  }

  pick(x: number, y: number): BodyPick | null {
    const direct = this.hit(x, y);
    const id = direct?.faceIndex != null ? regionForTriangle(this.variant, direct.faceIndex) : null;
    if (direct && !id) return null; // A face/head hit must not snap to the neck.
    if (id) return this.answer(id, x, y); // Surface hits must never be stolen by adjacent anchors.
    const candidates = Object.keys(manifest.variants[this.variant].selectionAnchors).flatMap(key => {
      const world = this.anchor(key)!;
      const pixel = this.project(world);
      const distance = Math.hypot(pixel.x - x, pixel.y - y);
      return distance <= metrics.jointRadius ? [{ key, world, pixel, distance }] : [];
    }).sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      const surface = this.hit(candidate.pixel.x, candidate.pixel.y);
      if (surface && surface.point.distanceTo(candidate.world) <= metrics.occlusionTolerance) return this.answer(candidate.key, x, y);
    }
    // Small fingers targets at the outline, never a nearest-region fallback across blank space.
    for (const radius of [metrics.jointRadius / 2, metrics.jointRadius]) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const nearby = this.hit(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        const region = nearby?.faceIndex != null ? regionForTriangle(this.variant, nearby.faceIndex) : null;
        if (region) return this.answer(region, x, y);
      }
    }
    return null;
  }

  dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of textures) {
      texture.dispose();
      const image = texture.source.data;
      if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
    }
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.scene.clear();
  }
}
