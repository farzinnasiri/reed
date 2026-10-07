"""Compare saved v3.2 and v3.3 authoring meshes without changing either file."""
import argparse
import hashlib
import json
import pathlib
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def read_scene(path):
    bpy.ops.wm.open_mainfile(filepath=str(path.resolve()))
    bodies = {}
    for variant in ('male', 'female'):
        body = bpy.data.objects[variant + '_body']
        mesh = body.data
        bodies[variant] = {
            'faces': np.array([p.vertices[:] for p in mesh.polygons]),
            'uv': np.array([v.uv[:] for v in mesh.uv_layers[0].data]),
            'attributes': {name: np.array([d.value for d in mesh.attributes[name].data]) for name in ('reed_source_vertex', 'reed_pain_id', 'reed_muscle_id')},
            'keys': {k.name: np.array([v.co[:] for v in k.data]) for k in mesh.shape_keys.key_blocks},
            'patches': {ob.name: np.array([p.vertices[:] for p in ob.data.polygons]) for ob in bpy.data.collections[variant].all_objects if ob != body},
        }
    return bodies


def symmetry(points, faces):
    tree = BVHTree.FromPolygons(points.tolist(), faces.tolist(), all_triangles=True)
    # Compare reflected points with the surface, not the nearest vertex. Mobile
    # decimation is not a mirrored vertex grid and must not be mistaken for a
    # visibly asymmetric surface. The untouched facial identity is excluded.
    samples = points[(points[:, 2] > .18) & (points[:, 2] < 1.47)].copy()
    samples[:, 0] *= -1
    distances = np.array([tree.find_nearest(Vector(p))[3] for p in samples])
    return {'meanM': float(distances.mean()), 'p95M': float(np.quantile(distances, .95)), 'maximumM': float(distances.max())}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=pathlib.Path, required=True)
    parser.add_argument('--revised', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    original_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
    before = read_scene(args.source)
    after = read_scene(args.revised)
    report = {'sourceSha256': original_hash, 'revisedSha256': hashlib.sha256(args.revised.read_bytes()).hexdigest(), 'variants': {}}
    for variant in ('male', 'female'):
        a, b = before[variant], after[variant]
        for field in ('faces', 'uv'):
            assert np.array_equal(a[field], b[field]), (variant, field)
        for name in a['attributes']:
            assert np.array_equal(a['attributes'][name], b['attributes'][name]), (variant, name)
        assert a['keys'].keys() == b['keys'].keys()
        assert a['patches'].keys() == b['patches'].keys()
        for name in a['patches']:
            assert np.array_equal(a['patches'][name], b['patches'][name]), name
        p, q = a['keys']['Basis'], b['keys']['Basis']
        assert abs(np.ptp(p[:, 2]) - np.ptp(q[:, 2])) < 1e-6
        # No displacement of the face/head or ground-contact vertices.
        fixed = (p[:, 2] > 1.48) | (p[:, 2] < .06)
        assert np.max(np.linalg.norm(p[fixed] - q[fixed], axis=1)) < 1e-6
        old_sym, new_sym = symmetry(p, a['faces']), symmetry(q, b['faces'])
        assert new_sym['p95M'] < max(.0015, old_sym['p95M'] * 1.15), (variant, new_sym)
        report['variants'][variant] = {
            'topologyUVsRegionMembershipPatchTopology': 'unchanged',
            'headAndGroundContactMaximumDisplacementM': float(np.max(np.linalg.norm(p[fixed] - q[fixed], axis=1))),
            'heightM': float(np.ptp(q[:, 2])),
            'symmetryBefore': old_sym, 'symmetryAfter': new_sym,
        }
    assert hashlib.sha256(args.source.read_bytes()).hexdigest() == original_hash
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print('REFINEMENT_VALIDATION_OK', json.dumps(report))


if __name__ == '__main__':
    main()
