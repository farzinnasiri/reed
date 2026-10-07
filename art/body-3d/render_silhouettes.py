"""Orthographic inspection of the authored meshes; never modifies the source file."""
import argparse
import pathlib
import sys

import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--appearance', choices=['base', 'onboarding'], default='base')
    parser.add_argument('--pain', help='One authored pain region to inspect against the body silhouette')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 420
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.studiolight_rotate_z = 0
    scene.display.shading.color_type = 'OBJECT' if args.pain else 'SINGLE'
    scene.display.shading.single_color = (.55, .55, .55)
    scene.display.shading.show_shadows = False
    scene.display.shading.show_cavity = False
    scene.display.shading.show_specular_highlight = False
    scene.display.shading.background_type = 'WORLD'
    scene.world.color = (.055, .055, .055)
    scene.view_settings.view_transform = 'Standard'
    camera = scene.camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.88
    for variant in ('male', 'female'):
        body = bpy.data.objects[variant + '_body']
        active = bpy.data.objects.get(variant + '_pain_' + args.pain) if args.pain else None
        if args.pain:
            assert active is not None, args.pain
        for ob in scene.objects:
            if ob.type == 'MESH':
                ob.hide_render = ob not in (body, active)
                ob.color = (.55, .55, .55, 1) if ob == body else (.8, .04, .04, 1)
                if ob == active:
                    ob.hide_set(False)
        for key in body.data.shape_keys.key_blocks:
            key.value = 0
        if args.appearance == 'onboarding':
            body.data.shape_keys.key_blocks['adiposity'].value = .4
            body.data.shape_keys.key_blocks['muscularity'].value = 1
            body.data.shape_keys.key_blocks['fullness_corrective'].value = .4
        if active:
            for key in active.data.shape_keys.key_blocks:
                key.value = body.data.shape_keys.key_blocks[key.name].value
        for view, direction in [('front', (0, -4, 0)), ('side', (4, 0, 0)), ('back', (0, 4, 0))]:
            target = Vector((0, 0, .86))
            camera.location = target + Vector(direction)
            camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(args.output / f'{variant}-{view}.png')
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
