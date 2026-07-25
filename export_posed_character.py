import bpy
import os

project_dir = r"d:\Adarsh learning\My projects\ano"
public_3d = os.path.join(project_dir, "public", "chamber-clash", "3d")

char_root = bpy.data.objects.get("Opponent_Character_Root")
if char_root:
    armature = None
    for child in char_root.children:
        if child.type == 'ARMATURE':
            armature = child
            break
            
    if armature:
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.mode_set(mode='POSE')
        
        # Scale arm bones to 0 to hide them!
        hide_bones = ["LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand"]
        for bone in armature.pose.bones:
            for hb in hide_bones:
                if hb in bone.name:
                    bone.scale = (0.001, 0.001, 0.001)
                    
        bpy.ops.object.mode_set(mode='OBJECT')
        
        bpy.context.view_layer.update() # CRITICAL: Update depsgraph before applying modifiers!
        
        # Apply armature modifiers to all meshes to freeze the collapsed arms
        for obj in armature.children:
            if obj.type == 'MESH':
                bpy.context.view_layer.objects.active = obj
                for mod in obj.modifiers:
                    if mod.type == 'ARMATURE':
                        bpy.ops.object.modifier_apply(modifier=mod.name)
        
        # Delete armature
        bpy.ops.object.select_all(action='DESELECT')
        armature.select_set(True)
        bpy.ops.object.delete()
            
    # Export character
    bpy.ops.object.select_all(action='DESELECT')
    def select_hierarchy(obj):
        obj.select_set(True)
        for child in obj.children: select_hierarchy(child)
    select_hierarchy(char_root)
    
    char_path = os.path.join(public_3d, "character-upper.glb")
    bpy.ops.export_scene.gltf(filepath=char_path, use_selection=True, export_format='GLB', export_apply=True)
    print("Exported armless static character!")
