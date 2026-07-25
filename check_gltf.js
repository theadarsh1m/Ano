const fs = require('fs');
const buf = fs.readFileSync('public/chamber-clash/3d/items-clean.glb');

// Find JSON chunk
const jsonChunkLength = buf.readUInt32LE(12);
const jsonChunkType = buf.readUInt32LE(16);
if (jsonChunkType !== 0x4E4F534A) {
  console.log("No JSON chunk found!");
  process.exit(1);
}

const jsonBuf = buf.slice(20, 20 + jsonChunkLength);
const jsonStr = jsonBuf.toString('utf-8');
const gltf = JSON.parse(jsonStr);

console.log("Nodes:");
gltf.nodes.forEach(n => console.log(n.name));
