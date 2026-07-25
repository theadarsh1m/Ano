import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
def import_glb(filepath):
    if os.path.exists(filepath):
        bpy.ops.import_scene.gltf(filepath=filepath)
        return bpy.context.selected_objects[0]
    return None

char_root = import_glb(r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\character.glb")
armature = None
if char_root:
    for child in char_root.children:
        if child.type == 'ARMATURE':
            armature = child
            break

if armature:
    print("--- BONE NAMES ---")
    for b in armature.pose.bones:
        print(b.name)
    print("------------------")

shotgun_root = import_glb(r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\shotgun.glb")
if shotgun_root:
    print("\n--- SHOTGUN HIERARCHY ---")
    def print_tree(obj, level=0):
        print("  " * level + obj.name + f" (hide_render: {obj.hide_render}, scale: {obj.scale}, type: {obj.type})")
        for child in obj.children:
            print_tree(child, level + 1)
    print_tree(shotgun_root)
    print("-------------------------")
