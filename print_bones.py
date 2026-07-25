import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

glb_path = r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\character.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

armature = None
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

if armature:
    print("=== BONE LIST ===")
    for bone in armature.data.bones:
        print(bone.name)
    print("=================")
else:
    print("NO ARMATURE FOUND")
