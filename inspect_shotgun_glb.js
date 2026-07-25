const fs = require('fs');
const path = require('path');

// Read GLB file
const glbBuffer = fs.readFileSync('public/chamber-clash/3d/shotgun-clean.glb');

// GLB header is 12 bytes: magic (4), version (4), length (4)
// Chunk 0 header is 8 bytes: length (4), type (4) -> type 0x4E4F534A is JSON
const jsonLength = glbBuffer.readUInt32LE(12);
const jsonChunk = glbBuffer.slice(20, 20 + jsonLength).toString('utf-8');
const gltf = JSON.parse(jsonChunk);

console.log("GLTF Nodes:", JSON.stringify(gltf.nodes, null, 2));
console.log("GLTF Meshes:", JSON.stringify(gltf.meshes, null, 2));
if (gltf.scenes) console.log("GLTF Scenes:", JSON.stringify(gltf.scenes, null, 2));
