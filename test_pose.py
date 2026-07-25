import bpy
import math

bpy.ops.wm.open_mainfile(filepath=r"d:\Adarsh learning\My projects\ano\blender\chamber-clash\chamber-clash-vertical-slice.blend")

armature = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='POSE')

b = armature.pose.bones["mixamorig:RightArm_033"]
print("BEFORE:", b.rotation_quaternion)
b.rotation_mode = 'XYZ'
b.rotation_euler = (math.radians(0), math.radians(0), math.radians(-80))
b.keyframe_insert(data_path="rotation_euler", frame=1)
print("AFTER EULER:", b.rotation_euler)

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=r"d:\Adarsh learning\My projects\ano\blender\chamber-clash\test.blend")
bpy.ops.render.render(write_still=True)
