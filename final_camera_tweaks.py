import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
project_dir = r"d:\Adarsh learning\My projects\ano"

blend_path = os.path.join(project_dir, "blender", "chamber-clash", "chamber-clash-vertical-slice.blend")
bpy.ops.wm.open_mainfile(filepath=blend_path)

# Find camera
camera = bpy.context.scene.camera
if camera:
    # Tilt the camera up slightly to see the opponent's face
    # It was 65 degrees (pointing down). Let's change to 75 degrees
    camera.rotation_euler = (math.radians(78), 0, 0)
    # Move camera slightly up and back to see more
    camera.location = (0, -1.2, 1.3)
    
# Find character root
char_root = None
for obj in bpy.data.objects:
    if obj.name == "character":
        char_root = obj
        break
    if "Armature" in obj.name or "mixamorig" in obj.name:
        if obj.parent:
            char_root = obj.parent
if not char_root:
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            char_root = obj.parent
            
if char_root:
    # Character root was at -0.6. Let's put it at -0.3 so the table naturally occludes just below the chest.
    char_root.location.z = -0.35

# Fix lighting so the face is lit!
# The spotlight was at (0, 0, 2.4).
# We can add a point light near the opponent's face to ensure it's visible.
bpy.ops.object.light_add(type='POINT', location=(0, 0.5, 1.5))
face_light = bpy.context.active_object
face_light.data.energy = 50
face_light.data.color = (1.0, 0.9, 0.8)

# RENDER NEW IMAGE
out_png = os.path.join(project_dir, "blender", "chamber-clash", "static_composition_v4.png")
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.filepath = out_png
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.ops.render.render(write_still=True)
print("SUCCESS")

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
