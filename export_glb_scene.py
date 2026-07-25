import bpy
import os
import json
import math
from mathutils import Matrix, Vector

project_dir = r"d:\Adarsh learning\My projects\ano"
public_3d = os.path.join(project_dir, "public", "chamber-clash", "3d")
blend_path = os.path.join(project_dir, "blender", "chamber-clash", "chamber-clash-vertical-slice.blend")

bpy.ops.wm.open_mainfile(filepath=blend_path)

# Ensure public dir exists
os.makedirs(public_3d, exist_ok=True)

def select_hierarchy(obj):
    obj.select_set(True)
    for child in obj.children:
        select_hierarchy(child)

def export_glb(objects, filepath):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        select_hierarchy(obj)
    bpy.ops.export_scene.gltf(filepath=filepath, use_selection=True, export_format='GLB')

print("--- EXPORTING GLBS ---")

# 1. ENVIRONMENT
env_objects = []
for obj in bpy.data.objects:
    if obj.name in ["Environment_Room", "Environment_Table", "Environment_Lamp"] or obj.name.startswith("Cube.0"):
        # The chair is a Cube primitive
        # Actually let's just grab by name, we didn't name the chair specifically.
        # It's at (0, 0.9, 0.2)
        if obj.type == 'MESH':
            env_objects.append(obj)

# Wait, items and character are also meshes! We need to be specific.
env_objs_clean = []
for obj in bpy.context.scene.objects:
    if obj.name in ["Environment_Room", "Environment_Table", "Environment_Lamp"]:
        env_objs_clean.append(obj)
    elif obj.type == 'MESH' and obj.location.y == 0.9 and obj.location.z == 0.2:
        # This is the chair
        obj.name = "Environment_Chair"
        env_objs_clean.append(obj)

export_glb(env_objs_clean, os.path.join(public_3d, "environment.glb"))
print("Exported environment.glb")

# 2. CHARACTER UPPER
char_objects = []
armature = None
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

if armature:
    char_root = armature.parent if armature.parent else armature
    # Apply armature modifier to all meshes
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='OBJECT')
    
    meshes_to_keep = []
    for child in armature.children:
        if child.type == 'MESH':
            meshes_to_keep.append(child)
            
    # Apply modifiers
    for mesh in meshes_to_keep:
        bpy.context.view_layer.objects.active = mesh
        for mod in mesh.modifiers:
            if mod.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=mod.name)
                
    # Now we can unparent the meshes and delete the armature!
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes_to_keep:
        mesh.select_set(True)
        # Apply world transform before unparenting
        matrix_world = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world = matrix_world
        char_objects.append(mesh)
        
    bpy.data.objects.remove(armature, do_unlink=True)
    if char_root and char_root.type == 'EMPTY':
        bpy.data.objects.remove(char_root, do_unlink=True)
        
    export_glb(char_objects, os.path.join(public_3d, "character-upper.glb"))
    print("Exported character-upper.glb (STATIC MESH)")

# 3. FP ARMS
fp_arms = []
for obj in bpy.context.scene.objects:
    if obj.name.startswith("DEBUG_FP_ARM"):
        fp_arms.append(obj)
if fp_arms:
    export_glb(fp_arms, os.path.join(public_3d, "fp-arms.glb"))
    print("Exported fp-arms.glb")

print("--- EXTRACTING TRANSFORMS ---")

# Let's reopen the file to get pure original transforms (since we deleted the armature)
bpy.ops.wm.open_mainfile(filepath=blend_path)

transforms = {}

def get_transform(obj):
    loc = obj.matrix_world.translation
    rot = obj.matrix_world.to_quaternion()
    scale = obj.matrix_world.to_scale()
    return {
        "position": [loc.x, loc.y, loc.z],
        "quaternion": [rot.x, rot.y, rot.z, rot.w],
        "scale": [scale.x, scale.y, scale.z]
    }

# Camera
cam = bpy.context.scene.camera
if cam:
    transforms["camera"] = get_transform(cam)
    transforms["camera"]["fov"] = math.degrees(cam.data.angle)
    transforms["camera"]["lens"] = cam.data.lens

# Lighting
for obj in bpy.context.scene.objects:
    if obj.type == 'LIGHT':
        t = get_transform(obj)
        t["type"] = obj.data.type
        t["energy"] = obj.data.energy
        t["color"] = list(obj.data.color)
        if obj.data.type == 'SPOT':
            t["spot_size"] = math.degrees(obj.data.spot_size)
            t["spot_blend"] = obj.data.spot_blend
        transforms[obj.name] = t

# Shotgun
shotgun = bpy.data.objects.get("Remington870_Material_0")
if shotgun:
    transforms["shotgun"] = get_transform(shotgun)

# Character Root
char_root = None
for obj in bpy.context.scene.objects:
    if obj.name == "character":
        char_root = obj
        break
    if "Armature" in obj.name or "mixamorig" in obj.name:
        if obj.parent:
            char_root = obj.parent
            break
if not char_root:
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            char_root = obj.parent
            break
            
if char_root:
    transforms["character_root"] = get_transform(char_root)

# Items
items = {}
for obj in bpy.context.scene.objects:
    # Only grab the duplicate clones that are actually on the table, not the hidden originals!
    if obj.name.startswith("ITEM_") and not obj.hide_render and not obj.parent:
        items[obj.name] = get_transform(obj)
transforms["items"] = items

# Save transforms
with open(os.path.join(project_dir, "scene_transforms.json"), "w") as f:
    json.dump(transforms, f, indent=2)

print("Saved scene_transforms.json")
print("SUCCESS")
