import bpy
import sys
import time
import sys

# Ensure addon path is in sys.path
addon_dir = r"C:\Users\adars\AppData\Roaming\Blender Foundation\Blender\5.2\scripts\addons"
if addon_dir not in sys.path:
    sys.path.append(addon_dir)

import addon

print("Enabling Blender MCP Addon...")
bpy.ops.preferences.addon_enable(module="addon")

# Call the register function to ensure it starts
try:
    addon.register()
except Exception as e:
    print("Already registered or error:", e)

# There's likely an operator to start the server.
# Let's check if there's a bpy.ops.mcp.start_server
try:
    bpy.ops.mcp.start_server()
    print("Started MCP Server via operator")
except AttributeError:
    print("No mcp.start_server operator found, it might start automatically")

print("Blender MCP should be running on port 9876 now.")

# Keep the background process alive
try:
    while True:
        # We need to process events if it's using timers
        bpy.ops.wm.redraw_timer(type='DRAW_WIN_SWAP', iterations=1)
        time.sleep(0.1)
except KeyboardInterrupt:
    print("Shutting down")
