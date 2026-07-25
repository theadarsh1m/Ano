import bpy
import os

project_dir = r"d:\Adarsh learning\My projects\ano"
public_3d = os.path.join(project_dir, "public", "chamber-clash", "3d")

def select_hierarchy(obj):
    obj.select_set(True)
    for child in obj.children:
        select_hierarchy(child)

bpy.ops.object.select_all(action='DESELECT')

# 1. Environment
env_objs = ["Cube", "Cylinder", "Cube.001", "Point", "Spot"]
for n in env_objs:
    if bpy.data.objects.get(n):
        bpy.data.objects[n].select_set(True)

env_path = os.path.join(public_3d, "environment.glb")
bpy.ops.export_scene.gltf(filepath=env_path, use_selection=True, export_format='GLB')

# 2. Character
bpy.ops.object.select_all(action='DESELECT')
char = bpy.data.objects.get("Opponent_Character_Root")
if char: select_hierarchy(char)
char_path = os.path.join(public_3d, "character-upper.glb")
bpy.ops.export_scene.gltf(filepath=char_path, use_selection=True, export_format='GLB', export_apply=True)

# 3. FP Arms
bpy.ops.object.select_all(action='DESELECT')
fp_objs = ["Cylinder.001", "Cylinder.002", "Cube.002", "Cylinder.003", "Cylinder.004", "Cube.003"]
for n in fp_objs:
    if bpy.data.objects.get(n):
        bpy.data.objects[n].select_set(True)

fp_path = os.path.join(public_3d, "fp-arms.glb")
bpy.ops.export_scene.gltf(filepath=fp_path, use_selection=True, export_format='GLB')
