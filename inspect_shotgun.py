import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

glb_path = r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\shotgun.glb"
if not os.path.exists(glb_path):
    print("shotgun.glb NOT FOUND")
    exit(1)
    
bpy.ops.import_scene.gltf(filepath=glb_path)

print("\n--- SHOTGUN.GLB DIAGNOSTICS ---")
giant_objects = []

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        dims = obj.dimensions
        max_dim = max(dims.x, dims.y, dims.z)
        print(f"Mesh: {obj.name} | Dims: ({dims.x:.2f}, {dims.y:.2f}, {dims.z:.2f}) | MaxDim: {max_dim:.2f} | Parent: {obj.parent.name if obj.parent else 'None'}")
        
        if max_dim > 5.0:
            print(f"  -> WARNING: Enormous object detected! {obj.name}")
            giant_objects.append(obj)

print("--- END DIAGNOSTICS ---\n")

if giant_objects:
    for obj in giant_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    out_path = r"d:\Adarsh learning\My projects\ano\shotgun-clean.glb"
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=False)
    print(f"Exported shotgun-clean.glb to {out_path}")
else:
    print("shotgun.glb is clean.")
