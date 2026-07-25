import bpy
import math
import os
import re

bpy.ops.wm.read_factory_settings(use_empty=True)
project_dir = r"d:\Adarsh learning\My projects\ano"

# 1. CREATE SHOTGUN-CLEAN
bpy.ops.import_scene.gltf(filepath=os.path.join(project_dir, "public", "chamber-clash", "3d", "shotgun.glb"))
mesh = bpy.data.objects.get("Remington870_Material_0")
if mesh:
    # We want a clean shotgun without crazy parent empty scales
    mesh.parent = None
    # Original parent scale was 0.01 * 0.8263 * 100 = 0.8263. 
    # But wait, MaxDim was 0.95. A shotgun is ~1.0m long.
    mesh.scale = (1.0, 1.0, 1.0) 
    mesh.location = (0, 0, 0)
    mesh.rotation_euler = (0, 0, 0)
    
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    out_shotgun = os.path.join(project_dir, "shotgun-clean.glb")
    bpy.ops.export_scene.gltf(filepath=out_shotgun, use_selection=True, export_format='GLB')
    print("Created shotgun-clean.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(filepath):
    if os.path.exists(filepath):
        bpy.ops.import_scene.gltf(filepath=filepath)
        return bpy.context.selected_objects[0]
    return None

# We will just use the existing items-clean.glb
char_root = import_glb(os.path.join(project_dir, "public", "chamber-clash", "3d", "character.glb"))
shotgun_root = import_glb(os.path.join(project_dir, "shotgun-clean.glb"))
items_root = import_glb(os.path.join(project_dir, "items-clean.glb"))

# Clear unwanted actions
for action in bpy.data.actions:
    if action.name != "CC_SeatedIdle" and action.name != "CC_HoldShotgun":
        bpy.data.actions.remove(action)

for mat in bpy.data.materials:
    mat.blend_method = 'HASHED'

# ROOM
bpy.ops.mesh.primitive_cube_add(size=15, location=(0, 2, 5))
room = bpy.context.active_object
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode='OBJECT')
mat_room = bpy.data.materials.new(name="Mat_DarkRoom")
mat_room.use_nodes = True
bsdf_room = mat_room.node_tree.nodes["Principled BSDF"]
bsdf_room.inputs['Base Color'].default_value = (0.02, 0.02, 0.025, 1)
bsdf_room.inputs['Roughness'].default_value = 0.95
room.data.materials.append(mat_room)

# Lamp
bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=0.1, location=(0, 0, 2.5))
lamp = bpy.context.active_object
mat_lamp = bpy.data.materials.new(name="Mat_Lamp")
mat_lamp.use_nodes = True
mat_lamp.node_tree.nodes["Principled BSDF"].inputs['Emission Color'].default_value = (1.0, 0.9, 0.7, 1)
mat_lamp.node_tree.nodes["Principled BSDF"].inputs['Emission Strength'].default_value = 5.0
lamp.data.materials.append(mat_lamp)

# TABLE
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.74))
table = bpy.context.active_object
table.scale = (2.2, 1.6, 0.06) 
bpy.ops.object.transform_apply(scale=True)
mat_table = bpy.data.materials.new(name="Mat_TableWood")
mat_table.use_nodes = True
bsdf_table = mat_table.node_tree.nodes["Principled BSDF"]
bsdf_table.inputs['Base Color'].default_value = (0.05, 0.03, 0.02, 1)
bsdf_table.inputs['Roughness'].default_value = 0.4
table.data.materials.append(mat_table)

# Chair
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.9, 0.2))
chair = bpy.context.active_object
chair.scale = (0.6, 0.6, 0.4)
chair.data.materials.append(mat_table)

# LIGHTING
bpy.ops.object.light_add(type='SPOT', location=(0, 0, 2.4))
spot = bpy.context.active_object
spot.data.energy = 300
spot.data.spot_size = math.radians(70)
spot.data.spot_blend = 0.9
spot.data.color = (1.0, 0.9, 0.75) 

# OPPONENT POSE
def get_armature(root):
    if not root: return None
    for child in root.children:
        if child.type == 'ARMATURE': return child
    return None

if char_root:
    char_root.location = (0, 0.9, 0.0)
    char_root.rotation_euler = (0, 0, math.radians(180))
    armature = get_armature(char_root)
    if armature:
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.pose.select_all(action='SELECT')
        bpy.ops.pose.transforms_clear()
        for b in armature.pose.bones: b.rotation_mode = 'XYZ'
        
        def rot(name, x, y, z):
            for b in armature.pose.bones:
                clean = re.sub(r'_\d+$', '', b.name).replace("mixamorig:", "")
                if clean == name:
                    b.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
                    break
        
        rot("Hips", 0, 0, 0)
        rot("LeftUpLeg", -80, 0, -10)
        rot("RightUpLeg", -80, 0, 10)
        rot("LeftLeg", 90, 0, 0)
        rot("RightLeg", 90, 0, 0)
        rot("Head", -10, 0, 0)
        
        # Right arm looks perfect at (70, 0, -20). 
        # Left arm at (70, 0, 20) is horizontal. 
        # Mixamo left arm: X is down bone. Let's try rotating it forward and slightly in.
        # Let's use (0, -40, -40) or just let it rest.
        # Actually, let's just rotate shoulders down.
        rot("LeftShoulder", 0, 0, -20)
        rot("RightShoulder", 0, 0, 20)
        rot("LeftArm", 0, 0, -30) # Point straight down and slightly inward
        rot("RightArm", 70, 0, -20) 
        rot("LeftForeArm", 0, 0, 60)
        rot("RightForeArm", 0, 0, -80)
        
        # Bake to action
        bpy.ops.object.mode_set(mode='OBJECT')

# FP ARMS (Proxy for now since MCP failed)
def create_fp_arm(side, x_offset):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.25, location=(x_offset, -0.9, 0.9))
    upper = bpy.context.active_object
    upper.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.3, location=(x_offset * 0.8, -0.7, 0.9))
    lower = bpy.context.active_object
    lower.rotation_euler = (math.radians(90), 0, math.radians(-20 if side=='left' else 20))
    bpy.ops.mesh.primitive_cube_add(size=0.08, location=(x_offset * 0.6, -0.5, 0.87))
    hand = bpy.context.active_object
    hand.scale = (1.0, 1.2, 0.4)
    mat = bpy.data.materials.new(name="FPArmMat")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.6, 0.5, 1)
    upper.data.materials.append(mat)
    lower.data.materials.append(mat)
    hand.data.materials.append(mat)

create_fp_arm('left', -0.3)
create_fp_arm('right', 0.3)

# SHOTGUN
shotgun_mesh = bpy.data.objects.get("Remington870_Material_0")
if shotgun_mesh:
    shotgun_mesh.location = (0, -0.05, 0.77)
    shotgun_mesh.rotation_euler = (math.radians(0), math.radians(0), math.radians(-90))
    # It was length ~0.95. Scale to 0.7 so it's a good size on table
    shotgun_mesh.scale = (0.7, 0.7, 0.7)

# ITEMS
opp_items = [
    ("ITEM_BEER", (-0.3, 0.15, 0.77), (math.radians(0), 0, 0)), # Vertical bottle
    ("ITEM_MAGNIFIER", (-0.1, 0.15, 0.77), (0, 0, 0)),
    ("ITEM_EXPIRED_MEDS", (0.1, 0.15, 0.77), (0, 0, math.radians(180))), # Medkit facing opponent
    ("ITEM_BURNER_PHONE", (0.3, 0.15, 0.77), (0, 0, math.radians(180))),
]
local_items = [
    ("ITEM_HANDCUFFS", (-0.3, -0.25, 0.77), (0, 0, 0)),
    ("ITEM_HANDSAW", (-0.1, -0.25, 0.77), (math.radians(90), 0, math.radians(-45))), # Flat on table, diagonal
    ("ITEM_INVERTER", (0.1, -0.25, 0.77), (0, 0, 0)),
    ("ITEM_CIGARETTES", (0.3, -0.25, 0.77), (0, 0, 0)),
]

base_names = [name for name, loc, rot in local_items + opp_items]

for name, loc, rot in local_items + opp_items:
    orig = bpy.data.objects.get(name)
    if orig:
        bpy.ops.object.select_all(action='DESELECT')
        orig.select_set(True)
        for child in orig.children: child.select_set(True)
        bpy.context.view_layer.objects.active = orig
        bpy.ops.object.duplicate()
        new_obj = bpy.context.active_object
        new_obj.location = loc
        new_obj.rotation_euler = rot

for obj in bpy.context.scene.objects:
    if obj.name.startswith("ITEM_") and not obj.name.endswith(".001") and not obj.name.endswith(".002"):
        # Very simple hide logic for the original imported meshes
        if obj.parent and obj.parent.name == "items-clean-all":
            obj.hide_render = True
            obj.hide_viewport = True

# CAMERA
bpy.ops.object.camera_add(location=(0, -1.0, 1.4))
camera = bpy.context.active_object
camera.name = "CAMERA_LOCAL"
camera.rotation_euler = (math.radians(65), 0, 0)
camera.data.lens = 22
bpy.context.scene.camera = camera

out_blend = os.path.join(project_dir, "blender", "chamber-clash", "chamber-clash-vertical-slice.blend")
os.makedirs(os.path.dirname(out_blend), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)

out_png = os.path.join(project_dir, "blender", "chamber-clash", "static_composition.png")
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.filepath = out_png
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.ops.render.render(write_still=True)
print("SUCCESS")
