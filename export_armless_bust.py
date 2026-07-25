import bpy
import bmesh
import os

project_dir = r"d:\Adarsh learning\My projects\ano"
public_3d = os.path.join(project_dir, "public", "chamber-clash", "3d")

char_root = bpy.data.objects.get("Opponent_Character_Root")
if char_root:
    # 1. Duplicate the character root and its children
    bpy.ops.object.select_all(action='DESELECT')
    def get_all_children(obj):
        res = [obj]
        for c in obj.children: res.extend(get_all_children(c))
        return res
        
    orig_objs = get_all_children(char_root)
    for o in orig_objs: o.select_set(True)
    
    bpy.ops.object.duplicate(linked=False)
    dup_objs = bpy.context.selected_objects
    dup_root = [o for o in dup_objs if o.parent not in dup_objs][0]
    
    # 2. Convert all meshes in the duplicate to static meshes (apply modifiers)
    meshes = [obj for obj in dup_objs if obj.type == 'MESH']
    
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        # Apply shape keys if any so we can apply modifiers
        if obj.data.shape_keys:
            bpy.ops.object.shape_key_clear()
            
        # Apply armature modifier
        for mod in obj.modifiers:
            if mod.type == 'ARMATURE':
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except Exception as e:
                    pass
                    
        # Use bmesh to delete arm vertices
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        # The mesh is parented to an Empty with scale 0.00947.
        # But wait, we want to delete arms in WORLD space, or we can just apply the parent transform to the vertices first!
        obj.matrix_world = obj.matrix_world # forces update
        bm.transform(obj.matrix_world)
        
        to_delete = []
        for v in bm.verts:
            # Now vertices are in world space! (e.g. Z is up, scale is 1.0 = 1 meter)
            if abs(v.co.x) > 0.25 and v.co.z < 1.4:
                to_delete.append(v)
                
        bmesh.ops.delete(bm, geom=to_delete, context='VERTS')
        
        # Transform back to local space!
        bm.transform(obj.matrix_world.inverted())
        bm.to_mesh(obj.data)
        bm.free()
        
    names_to_keep = [o.name for o in dup_objs]
    if dup_root.name not in names_to_keep:
        names_to_keep.append(dup_root.name)
        
    # DO NOT delete or reparent the armature, keep hierarchy exactly identical to the working version
            
    # Export the duplicated, trimmed meshes
    bpy.ops.object.select_all(action='DESELECT')
    for name in names_to_keep:
        if name in bpy.data.objects:
            bpy.data.objects[name].select_set(True)
    
    char_path = os.path.join(public_3d, "character-upper.glb")
    bpy.ops.export_scene.gltf(filepath=char_path, use_selection=True, export_format='GLB', export_apply=True)
    print("Exported armless bust character!")
