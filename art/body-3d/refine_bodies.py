"""Refine the existing v3.2 meshes without remeshing or rebuilding the bodies.

Edits use continuous, bilateral fields in the current 1.72 m reference pose.
Fairing follows existing surface adjacency, so fingers, axillae and inner thighs
cannot be joined by a spatial smoothing radius. Refine actual appearance
endpoints, then reconstruct the combined corrective. Export-derived patches
are refitted by source vertex ID, including their hidden shape keys.
"""
import argparse
import hashlib
import json
import pathlib
import sys

import bpy
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from export_assets import synchronize_patches


def smoothstep(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def normals(points, faces):
    triangles = points[faces]
    face = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    result = np.zeros_like(points)
    for corner in range(3):
        np.add.at(result, faces[:, corner], face)
    return result / np.maximum(np.linalg.norm(result, axis=1, keepdims=True), 1e-12)


def adjacency(faces, count):
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    edges = np.unique(np.concatenate([edges, edges[:, ::-1]]), axis=0)
    a, b = edges.T
    degree = np.maximum(np.bincount(a, minlength=count), 1)
    return a, b, degree


def fair(points, weight, edges, iterations=12):
    points = points.copy()
    a, b, degree = edges
    for _ in range(iterations):
        mean = np.stack([np.bincount(a, weights=points[b, c], minlength=len(points)) / degree for c in range(3)], axis=1)
        points += (mean - points) * (.36 * weight[:, None])
    return points


def refine(points, reference, faces, edges, variant):
    # Reference masks stay identical across appearance endpoints. Normal-driven
    # displacement is recalculated on each endpoint; a filled-out body retains
    # its volume while its anatomical transitions receive the same refinement.
    x, y, z = np.abs(reference[:, 0]), reference[:, 1], reference[:, 2]
    n = normals(points, faces)
    arm_cutoff = .175 + np.clip(1.25 - z, 0, .55) * .17
    torso = 1 - smoothstep(arm_cutoff - .025, arm_cutoff + .012, x)
    front = smoothstep(-.12, .45, -n[:, 1])
    back = smoothstep(-.12, .45, n[:, 1])
    female = variant == 'female'

    def oval(cx, cz, rx, rz):
        return np.exp(-((x - cx) / rx) ** 2 - ((z - cz) / rz) ** 2)

    edited = points.copy()
    # Flatten exaggerated scapular relief into the thoracic envelope rather
    # than straightening the whole spine or moving the neck/head.
    thoracic = oval(.065, 1.336, .135, .092) * torso
    edited[:, 1] -= back * thoracic * (.013 if female else .031)
    edited[:, 1] -= back * oval(.110, 1.205, .085, .095) * torso * (.003 if female else .009)
    # A gentle lumbar bridge softens the sudden concave-to-convex glute step.
    edited[:, 1] += back * oval(.060, 1.045, .120, .094) * torso * (.012 if female else .005)
    edited[:, 1] -= back * oval(.100, .874, .125, .082) * torso * (.019 if female else .015)

    # Keep the female breast form; soften the male pectoral ledge and bring the
    # protruding upper abdomen back into a continuous ribcage/waist rhythm.
    edited[:, 1] += front * torso * (
        (.002 if female else .003) * oval(.083, 1.245, .108, .061)
        + (.006 if female else .014) * oval(.047, 1.145, .133, .090)
        + .004 * oval(.050, .986, .118, .058))
    side = np.abs(n[:, 0])
    edited[:, 0] -= np.sign(reference[:, 0]) * side * torso * .003 * oval(.165, .846, .065, .090)
    # Avoid a sharply peaked calf and separate-looking quadriceps bellies.
    leg = 1 - smoothstep(.215, .245, x)
    edited[:, 1] -= back * leg * (.004 if female else .008) * oval(.140, .318, .066, .092)
    edited[:, 1] += front * leg * (.003 if female else .008) * oval(.130, .682, .075, .117)

    # Broad, gently bounded fairing removes ridges at the chest, shoulder and
    # pelvis. Preserve facial identity, digit separation and joint landmarks.
    weight = torso * (
        .70 * oval(.068, 1.334, .135, .110)
        + (.28 if female else .40) * oval(.084, 1.211, .150, .126)
        + .42 * oval(.080, .950, .160, .158))
    weight += .70 * oval(.205, 1.315, .075, .106)
    weight += leg * (.28 * oval(.137, .663, .086, .148) + .36 * oval(.143, .317, .070, .110))
    weight *= smoothstep(.14, .20, z) * (1 - smoothstep(1.425, 1.465, z))
    edited = fair(edited, np.clip(weight, 0, .9), edges)

    # Drop the shoulder cap very slightly; blend into the upper arm rather
    # than rotating the entire skeleton or altering the wrist alignment.
    edited[:, 2] -= .0025 * oval(.205, 1.355, .080, .085)
    # Distal fingers curl only a few millimetres toward the palm. The wrist and
    # metacarpals stay fixed, with all existing spaces and thumb shape retained.
    digits = smoothstep(.37, .405, x) * (1 - smoothstep(.845, .885, z))
    edited[:, 1] -= .003 * digits
    # Gaussian fields have long tails. Bound the complete edit explicitly so
    # facial identity and the original feet/ground contact stay exactly fixed.
    editable = smoothstep(.06, .16, z) * (1 - smoothstep(1.43, 1.48, z))
    return points + (edited - points) * editable[:, None]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--report', type=pathlib.Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    assert bpy.context.scene.get('reed_asset_version') == '3.2.0', 'Refinement starts from the saved v3.2 source.'
    source = pathlib.Path(bpy.data.filepath)
    report = {'source': str(source.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'assetVersion': '3.3.0', 'variants': {}}
    for variant in ('male', 'female'):
        body = bpy.data.objects[variant + '_body']
        keys = body.data.shape_keys.key_blocks
        original = {k.name: np.array([v.co[:] for v in k.data]) for k in keys}
        faces = np.array([list(p.vertices) for p in body.data.polygons])
        assert faces.shape == (28000, 3)
        edges = adjacency(faces, len(original['Basis']))
        base = original['Basis']
        combined = original['adiposity'] + original['muscularity'] + original['fullness_corrective'] - 2 * base
        revised = {name: refine(original[name], base, faces, edges, variant) for name in ('Basis', 'adiposity', 'muscularity')}
        both = refine(combined, base, faces, edges, variant)
        revised['fullness_corrective'] = both - revised['adiposity'] - revised['muscularity'] + 2 * revised['Basis']
        for key in keys:
            key.data.foreach_set('co', revised[key.name].ravel())
            key.value = 0
        body.data.vertices.foreach_set('co', revised['Basis'].ravel())
        body.data.update()
        synchronize_patches(body, bpy.data.collections[variant])
        # Keep the viewport inspection uncluttered. Runtime also hides patches.
        for ob in bpy.data.collections[variant].all_objects:
            ob.hide_render = ob != body
            ob.hide_set(ob != body or variant == 'female')
            if ob.data.shape_keys:
                for key in ob.data.shape_keys.key_blocks:
                    key.value = 0
        delta = revised['Basis'] - base
        report['variants'][variant] = {
            'vertices': len(base), 'triangles': len(faces),
            'topologyAndMembershipUnchanged': True,
            'maximumBasisDisplacementM': float(np.linalg.norm(delta, axis=1).max()),
            'meanBasisDisplacementM': float(np.linalg.norm(delta, axis=1).mean()),
            'heightBeforeM': float(np.ptp(base[:, 2])),
            'heightAfterM': float(np.ptp(revised['Basis'][:, 2])),
        }
    scene = bpy.context.scene
    scene['reed_asset_version'] = '3.3.0'
    scene['reed_refinement_source'] = report['source']
    scene['reed_refinement'] = 'Topology-preserving silhouette refinement; see art/body-3d/refine_bodies.py.'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print('REFINED', json.dumps(report))


if __name__ == '__main__':
    main()
