import bpy
import math
import os
import re

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(filepath):
    if os.path.exists(filepath):
        bpy.ops.import_scene.gltf(filepath=filepath)
        return bpy.context.selected_objects[0]
    return None

char_root = import_glb(r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\character.glb")
shotgun_root = import_glb(r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\shotgun.glb")
items_root = import_glb(r"d:\Adarsh learning\My projects\ano\items-clean.glb")

# Clear unwanted actions
for action in bpy.data.actions:
    if action.name != "CC_SeatedIdle" and action.name != "CC_HoldShotgun":
        bpy.data.actions.remove(action)

for mat in bpy.data.materials:
    mat.blend_method = 'HASHED'

# 2. ROOM & ENVIRONMENT DEPTH
bpy.ops.mesh.primitive_cube_add(size=15, location=(0, 2, 5))
room = bpy.context.active_object
room.name = "Environment_Room"
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

# Lamp fixture
bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=0.1, location=(0, 0, 2.5))
lamp = bpy.context.active_object
lamp.name = "Environment_Lamp"
mat_lamp = bpy.data.materials.new(name="Mat_Lamp")
mat_lamp.use_nodes = True
mat_lamp.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1)
lamp.data.materials.append(mat_lamp)

# 3. TABLE
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.74))
table = bpy.context.active_object
table.name = "Environment_Table"
table.scale = (2.2, 1.6, 0.06) 
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.modifier_add(type='BEVEL')
table.modifiers["Bevel"].width = 0.02
table.modifiers["Bevel"].segments = 3

mat_table = bpy.data.materials.new(name="Mat_TableWood")
mat_table.use_nodes = True
bsdf_table = mat_table.node_tree.nodes["Principled BSDF"]
bsdf_table.inputs['Base Color'].default_value = (0.05, 0.03, 0.02, 1)
bsdf_table.inputs['Roughness'].default_value = 0.4
bsdf_table.inputs['Specular IOR Level'].default_value = 0.3
table.data.materials.append(mat_table)

# Chair for Opponent
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.9, 0.2))
chair = bpy.context.active_object
chair.scale = (0.6, 0.6, 0.4)
chair.data.materials.append(mat_table)

# 4. LIGHTING
bpy.ops.object.light_add(type='SPOT', location=(0, 0, 2.4))
spot = bpy.context.active_object
spot.name = "Light_Overhead"
spot.data.energy = 250
spot.data.spot_size = math.radians(65)
spot.data.spot_blend = 0.9
spot.data.shadow_soft_size = 0.5
spot.data.color = (1.0, 0.9, 0.75) 

bpy.ops.object.light_add(type='POINT', location=(0, 0.6, 1.2))
fill = bpy.context.active_object
fill.name = "Light_Fill"
fill.data.energy = 8
fill.data.color = (0.6, 0.7, 1.0) 

def get_armature(root):
    if not root: return None
    for child in root.children:
        if child.type == 'ARMATURE':
            return child
    return None

# 6. POSITION OPPONENT
if char_root:
    char_root.location = (0, 0.9, 0.0)
    char_root.rotation_euler = (0, 0, math.radians(180))
    armature = get_armature(char_root)
    
    if armature:
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode='POSE')
        
        bpy.ops.pose.select_all(action='SELECT')
        bpy.ops.pose.transforms_clear()
        
        bones = armature.pose.bones
        for b in bones:
            b.rotation_mode = 'XYZ'
            
        def rot(name, x, y, z):
            found = None
            for b in bones:
                clean = re.sub(r'_\d+$', '', b.name).replace("mixamorig:", "")
                if clean == name:
                    found = b
                    break
            if found:
                found.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))

        rot("Hips", 0, 0, 0)
        rot("LeftUpLeg", -80, 0, -10)
        rot("RightUpLeg", -80, 0, 10)
        rot("LeftLeg", 90, 0, 0)
        rot("RightLeg", 90, 0, 0)
        rot("Head", -10, 0, 0)
        
        # Perfect FK for resting arms
        rot("LeftArm", 70, 0, 20)
        rot("RightArm", 70, 0, -20)
        rot("LeftForeArm", 0, 0, 80)
        rot("RightForeArm", 0, 0, -80)
        rot("LeftHand", 0, -30, 0)
        rot("RightHand", 0, 30, 0)
        
        bpy.ops.object.mode_set(mode='OBJECT')

# 7. POSITION FP ARMS
def create_fp_arm(side, x_offset):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.25, location=(x_offset, -0.9, 0.9))
    upper = bpy.context.active_object
    upper.name = f"DEBUG_FP_ARM_GUIDE_UPPER_{side.upper()}"
    upper.rotation_euler = (math.radians(90), 0, 0)
    
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.3, location=(x_offset * 0.8, -0.7, 0.9))
    lower = bpy.context.active_object
    lower.name = f"DEBUG_FP_ARM_GUIDE_LOWER_{side.upper()}"
    lower.rotation_euler = (math.radians(90), 0, math.radians(-20 if side=='left' else 20))
    
    bpy.ops.mesh.primitive_cube_add(size=0.08, location=(x_offset * 0.6, -0.5, 0.87))
    hand = bpy.context.active_object
    hand.name = f"DEBUG_FP_ARM_GUIDE_HAND_{side.upper()}"
    hand.scale = (1.0, 1.2, 0.4)
    
    mat = bpy.data.materials.new(name="FPArmMat")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.6, 0.5, 1)
    upper.data.materials.append(mat)
    lower.data.materials.append(mat)
    hand.data.materials.append(mat)

create_fp_arm('left', -0.3)
create_fp_arm('right', 0.3)

# 8. SHOTGUN
shotgun_obj = bpy.data.objects.get("Shotgun_Model")
if shotgun_obj:
    shotgun_obj.location = (0, 0, 0.77)
    shotgun_obj.rotation_euler = (math.radians(0), math.radians(0), math.radians(-90))
    shotgun_obj.scale = (0.6, 0.6, 0.6)

# 9. ITEMS
local_items = [
    ("ITEM_HANDCUFFS", (-0.3, -0.2, 0.78), (0,0,0)),
    ("ITEM_BEER", (-0.1, -0.25, 0.78), (0,0,0)),
    ("ITEM_HANDSAW", (0.1, -0.25, 0.78), (0,0,0)),
    ("ITEM_BURNER_PHONE", (0.3, -0.2, 0.78), (0,0,0)),
]
opp_items = [
    ("ITEM_HANDCUFFS", (-0.3, 0.1, 0.78), (0,0,0)),
    ("ITEM_BEER", (-0.1, 0.15, 0.78), (0,0,0)),
    ("ITEM_MAGNIFIER", (0.1, 0.15, 0.78), (0,0,0)),
    ("ITEM_ADRENALINE", (0.3, 0.1, 0.78), (0,0,0)),
]

base_names = [name for name, loc, rot in local_items + opp_items]

for name, loc, rot in local_items + opp_items:
    orig = bpy.data.objects.get(name)
    if orig:
        bpy.ops.object.select_all(action='DESELECT')
        orig.select_set(True)
        for child in orig.children:
            child.select_set(True)
            
        bpy.context.view_layer.objects.active = orig
        bpy.ops.object.duplicate()
        new_obj = bpy.context.active_object
        
        new_obj.location = loc
        new_obj.rotation_euler = rot
    else:
        print(f"Warning: {name} not found")

# Hide the original items that were imported so they don't sit at origin
for name in set(base_names):
    orig = bpy.data.objects.get(name)
    if orig:
        orig.hide_render = True
        orig.hide_viewport = True
        for child in orig.children:
            child.hide_render = True
            child.hide_viewport = True

# 10. CAMERA
bpy.ops.object.camera_add(location=(0, -1.0, 1.4))
camera = bpy.context.active_object
camera.name = "CAMERA_LOCAL"
camera.rotation_euler = (math.radians(65), 0, 0)
camera.data.lens = 22
bpy.context.scene.camera = camera

# UPDATE SCENE GRAPH
bpy.context.view_layer.update()

project_dir = r"d:\Adarsh learning\My projects\ano"
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
