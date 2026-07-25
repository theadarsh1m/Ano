import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
project_dir = r"d:\Adarsh learning\My projects\ano"

# LOAD THE PREVIOUS BLEND FILE
blend_path = os.path.join(project_dir, "blender", "chamber-clash", "chamber-clash-vertical-slice.blend")
if os.path.exists(blend_path):
    bpy.ops.wm.open_mainfile(filepath=blend_path)
else:
    print("Blend file not found!")
    exit(1)

# 1. LOWER THE OPPONENT TO LOOK SEATED
char_root = None
for obj in bpy.data.objects:
    if obj.name == "character":
        char_root = obj
        break
    # In case the import named it differently
    if "Armature" in obj.name or "mixamorig" in obj.name:
        if obj.parent:
            char_root = obj.parent

# If we couldn't find the root, let's just find the Armature directly
armature = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

if armature and armature.parent:
    char_root = armature.parent

if char_root:
    # Lower the character so the table occludes the lower torso.
    # The table top is Z = 0.77.
    # Currently char_root is at Z = 0.0.
    # Let's drop it down so the hips are below the table.
    # Wait, the character root was at Z = 0.0?
    char_root.location.z = -0.6
    
    # Alternatively, just move the whole object down
    print(f"Lowered character root to {char_root.location.z}")
    
# 2. HIDE THE ARMS
if armature:
    # We can hide the arm meshes? No, the mesh is one solid body (Body_Bodymat_0, Tops_Topmat_0, etc).
    # We can't easily hide just the arms if they are part of a single mesh.
    # But we can scale the arm bones to 0!
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    
    for b in armature.pose.bones:
        if "Arm" in b.name or "Hand" in b.name or "Shoulder" in b.name:
            # Scale bones to 0 to hide them
            b.scale = (0.001, 0.001, 0.001)
            
    bpy.ops.object.mode_set(mode='OBJECT')
    print("Hid opponent arms by scaling bones to zero.")

# 3. VERIFY SHOTGUN
shotgun_mesh = bpy.data.objects.get("Remington870_Material_0")
if shotgun_mesh:
    # Ensure it's perfectly on the table and visible
    shotgun_mesh.location = (0, -0.05, 0.77)
    shotgun_mesh.rotation_euler = (0, 0, math.radians(-90))
    shotgun_mesh.scale = (0.7, 0.7, 0.7)
    shotgun_mesh.hide_render = False
    shotgun_mesh.hide_viewport = False
    print("Verified shotgun is visible and positioned.")

# RENDER NEW IMAGE
out_png = os.path.join(project_dir, "blender", "chamber-clash", "static_composition_v3.png")
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.filepath = out_png
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.ops.render.render(write_still=True)
print("SUCCESS")

# SAVE BLEND
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
