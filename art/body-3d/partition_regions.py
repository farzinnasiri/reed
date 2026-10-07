"""Author v3.4 discomfort regions on the saved v3.3 bodies, without sculpting.

Pain locations describe surface areas, not a diagnosis of the muscle beneath.
Front/back thigh and shin/calf are independent from exercise muscle highlights.
Shared, fixed triangle membership survives every appearance morph.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import sys

import bpy
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from export_assets import synchronize_patches


def patch(body, collection, kind, name, chosen, arrays, material):
    used = np.unique(chosen)
    lookup = np.full(len(arrays['Basis']), -1, dtype=int)
    lookup[used] = np.arange(len(used))
    mesh = bpy.data.meshes.new(body.name.removesuffix('_body') + '_' + kind + '_' + name)
    mesh.from_pydata(arrays['Basis'][used].tolist(), [], lookup[chosen].tolist())
    mesh.update()
    ob = bpy.data.objects.new(mesh.name, mesh)
    collection.objects.link(ob)
    mesh.materials.append(material)
    mesh.attributes.new('reed_source_vertex', 'INT', 'POINT').data.foreach_set('value', used)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    for key, points in arrays.items():
        ob.shape_key_add(name=key).data.foreach_set('co', points[used].ravel())
    edges = collections.Counter(tuple(sorted((i, j))) for t in chosen for i, j in zip(t, np.roll(t, -1)))
    boundary = {i for edge, count in edges.items() if count == 1 for i in edge}
    colors = mesh.color_attributes.new(name='edge_fade', type='FLOAT_COLOR', domain='POINT')
    colors.data.foreach_set('color', np.array([(1, 1, 1, 0 if i in boundary else 1) for i in used]).ravel())
    ob['reed_role'] = kind
    ob['reed_id'] = name
    ob['reed_default_visible'] = False
    ob.hide_set(True)
    ob.hide_render = True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--report', type=pathlib.Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    scene = bpy.context.scene
    assert scene['reed_asset_version'] == '3.3.0'
    source = pathlib.Path(bpy.data.filepath)
    bodies = [bpy.data.objects[variant + '_body'] for variant in ('male', 'female')]
    faces = np.array([p.vertices[:] for p in bodies[0].data.polygons])
    assert np.array_equal(faces, [p.vertices[:] for p in bodies[1].data.polygons])
    shapes = [{k.name: np.array([v.co[:] for v in k.data]) for k in body.data.shape_keys.key_blocks} for body in bodies]
    reference = (shapes[0]['Basis'] + shapes[1]['Basis']) * .5
    centers = reference[faces].mean(axis=1)
    cross = np.cross(reference[faces[:, 1]] - reference[faces[:, 0]], reference[faces[:, 2]] - reference[faces[:, 0]])
    normals = cross / np.maximum(np.linalg.norm(cross, axis=1, keepdims=True), 1e-12)
    old_labels = json.loads(bodies[0]['reed_pain_labels'])
    pain = [old_labels[d.value - 1] if d.value else None for d in bodies[0].data.attributes['reed_pain_id'].data]
    old_muscles = json.loads(bodies[0]['reed_muscle_labels'])
    muscle = [old_muscles[d.value - 1] if d.value else None for d in bodies[0].data.attributes['reed_muscle_id'].data]
    # The normal on the side silhouette can point slightly forward/back due to
    # local relief. Split limbs around their cross-section centerline instead.
    heights = np.arange(.12, 1.001, .02)
    mid_y = []
    for height in heights:
        section = reference[(np.abs(reference[:, 2] - height) < .025) & (np.abs(reference[:, 0]) < .215)]
        mid_y.append((np.quantile(section[:, 1], .05) + np.quantile(section[:, 1], .95)) * .5)
    centerline = np.interp(centers[:, 2], heights, mid_y)
    heel_start = float(np.interp(.14, heights, mid_y)) + .015
    for i, (c, n, old) in enumerate(zip(centers, normals, pain)):
        if not old or not old.startswith(('left_', 'right_')):
            continue
        side, part = old.split('_', 1)
        prefix = side + '_'
        front = c[1] <= centerline[i]
        outward = n[0] * (1 if c[0] > 0 else -1)
        if part in ('wrist', 'elbow'):
            if c[2] < .900:
                pain[i] = prefix + 'hand'
                muscle[i] = None
            elif c[2] < .935:
                pain[i] = prefix + 'wrist'
                muscle[i] = None
            elif c[2] < 1.095:
                pain[i] = prefix + 'forearm'
                muscle[i] = prefix + 'forearms'
            else:
                pain[i] = prefix + 'elbow'
                muscle[i] = None
        elif part == 'thigh':
            inner = outward < -.58 and c[2] > .63
            pain[i] = prefix + ('inner_thigh' if inner else 'front_thigh' if front else 'back_thigh')
            muscle[i] = prefix + ('adductors' if inner else 'quadriceps' if front else 'hamstrings')
        elif part == 'calf':
            pain[i] = prefix + ('shin' if front else 'calf')
            muscle[i] = prefix + ('tibialis_anterior' if front else 'calves')
        elif part == 'knee':
            pain[i] = prefix + ('knee' if front else 'back_knee')
        elif part == 'foot':
            pain[i] = prefix + ('heel' if c[1] > heel_start else 'foot')
        elif part == 'hip':
            lateral = outward > .62 and abs(c[0]) > .125
            if lateral:
                pain[i] = prefix + 'hip'
                muscle[i] = prefix + 'glutes' if not front else None
            elif not front:
                pain[i] = prefix + 'glute'
                muscle[i] = prefix + 'glutes'
            elif c[2] > .905:
                pain[i] = 'abdomen'
                muscle[i] = prefix + ('obliques' if abs(c[0]) > .085 else 'abdominals')
            elif abs(c[0]) < .105:
                pain[i] = prefix + 'groin'
                muscle[i] = None
            else:
                pain[i] = prefix + 'front_thigh'
                muscle[i] = prefix + 'quadriceps'
    # Existing dorsal patches exclude silhouette triangles that can become
    # forward-facing on an appearance endpoint. Retain that authoring restraint.
    back_safe = np.ones(len(faces), dtype=bool)
    for arrays in shapes:
        base = arrays['Basis']
        both = arrays['adiposity'] + arrays['muscularity'] + arrays['fullness_corrective'] - 2 * base
        for points in (base, arrays['adiposity'], arrays['muscularity'], both):
            f = points[faces]
            cross = np.cross(f[:, 1] - f[:, 0], f[:, 2] - f[:, 0])
            back_safe &= cross[:, 1] / np.maximum(np.linalg.norm(cross, axis=1), 1e-12) > .25
    report = {'assetVersion': '3.4.0', 'source': str(source.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'bodyGeometryMorphsUVsUnchanged': True, 'painTriangles': dict(collections.Counter(p for p in pain if p)), 'muscleTriangles': dict(collections.Counter(m for m in muscle if m)), 'legCenterline': {'heights': heights.tolist(), 'y': [float(y) for y in mid_y], 'heelStartY': heel_start}}
    for body, arrays in zip(bodies, shapes):
        variant = body['reed_variant']
        collection = bpy.data.collections[variant]
        material = next(ob.data.materials[0] for ob in collection.all_objects if ob != body)
        for ob in list(collection.all_objects):
            if ob == body:
                continue
            mesh = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        for kind, membership in [('pain', pain), ('muscle', muscle)]:
            labels = sorted({label for label in membership if label})
            attr = body.data.attributes['reed_' + kind + '_id']
            attr.data.foreach_set('value', [labels.index(label) + 1 if label else 0 for label in membership])
            body['reed_' + kind + '_labels'] = json.dumps(labels)
            for label in labels:
                mask = np.array([p == label for p in membership])
                if kind == 'pain':
                    if label.endswith('shoulder'):
                        mask &= centers[:, 2] > 1.275
                    elif label in ('upper_back', 'lower_back'):
                        mask &= back_safe
                assert np.any(mask), label
                patch(body, collection, kind, label, faces[mask], arrays, material)
        synchronize_patches(body, collection)
        assert all(np.array_equal(arrays[k.name], np.array([v.co[:] for v in k.data])) for k in body.data.shape_keys.key_blocks)
    scene['reed_asset_version'] = '3.4.0'
    scene['reed_region_source'] = report['source']
    scene['reed_region_partition'] = 'Independent anterior/posterior limb and pelvis discomfort; see partition_regions.py.'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print('REGIONS_PARTITIONED', json.dumps({'painRegions': len(report['painTriangles']), 'muscles': len(report['muscleTriangles']), 'geometryUnchanged': True}))


if __name__ == '__main__':
    main()
