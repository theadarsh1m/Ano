import bpy
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

# Import items.glb
glb_path = r"d:\Adarsh learning\My projects\ano\public\chamber-clash\3d\items.glb"
if not os.path.exists(glb_path):
    glb_path = r"d:\Adarsh learning\My projects\ano\items.glb"

if not os.path.exists(glb_path):
    print("items.glb NOT FOUND")
    exit(1)
    
bpy.ops.import_scene.gltf(filepath=glb_path)

print("\n--- ITEMS.GLB DIAGNOSTICS ---")
objects_to_keep = []
giant_objects = []

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        dims = obj.dimensions
        max_dim = max(dims.x, dims.y, dims.z)
        print(f"Mesh: {obj.name} | Dims: ({dims.x:.2f}, {dims.y:.2f}, {dims.z:.2f}) | MaxDim: {max_dim:.2f} | Parent: {obj.parent.name if obj.parent else 'None'}")
        
        if max_dim > 2.0:
            print(f"  -> WARNING: Enormous object detected! {obj.name}")
            giant_objects.append(obj)
        else:
            objects_to_keep.append(obj)
            
print("--- END DIAGNOSTICS ---\n")

for obj in giant_objects:
    bpy.data.objects.remove(obj, do_unlink=True)

# Remove empties that aren't parents of kept items
for obj in list(bpy.data.objects):
    if obj.type == 'EMPTY' and len(obj.children) == 0:
        bpy.data.objects.remove(obj, do_unlink=True)
        
for obj in bpy.data.objects:
    obj.select_set(True)

out_path = r"d:\Adarsh learning\My projects\ano\items-clean.glb"
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
print(f"Exported items-clean.glb with {len(bpy.data.objects)} items to {out_path}")
