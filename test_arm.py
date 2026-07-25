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

# 4. LIGHTING
bpy.ops.object.light_add(type='SPOT', location=(0, 0, 2.4))
spot = bpy.context.active_object
spot.data.energy = 250
spot.data.spot_size = math.radians(65)

def get_armature(root):
    if not root: return None
    for child in root.children:
        if child.type == 'ARMATURE':
            return child
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
        
        # We need LeftArm to match RightArm's visual appearance.
        # RightArm (70, 0, -20) points down nicely.
        # Let's try different LeftArm values:
        rot("LeftArm", -70, 0, 20)  # Try negative X?
        rot("RightArm", 70, 0, -20)
        rot("LeftForeArm", 0, 0, 80)
        rot("RightForeArm", 0, 0, -80)
        rot("LeftHand", 0, -30, 0)
        rot("RightHand", 0, 30, 0)
        
        bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.camera_add(location=(0, -1.0, 1.4))
camera = bpy.context.active_object
camera.rotation_euler = (math.radians(65), 0, 0)
camera.data.lens = 22
bpy.context.scene.camera = camera

out_png = r"d:\Adarsh learning\My projects\ano\arm_test.png"
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.filepath = out_png
bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 600
bpy.ops.render.render(write_still=True)
print("SUCCESS")
