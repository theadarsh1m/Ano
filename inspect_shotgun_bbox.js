const fs = require('fs');

const glbBuffer = fs.readFileSync('public/chamber-clash/3d/shotgun-clean.glb');

const jsonLength = glbBuffer.readUInt32LE(12);
const jsonChunk = glbBuffer.slice(20, 20 + jsonLength).toString('utf-8');
const gltf = JSON.parse(jsonChunk);

const posAccessor = gltf.accessors[0];
console.log("Position Accessor Min:", posAccessor.min);
console.log("Position Accessor Max:", posAccessor.max);

const sizeX = posAccessor.max[0] - posAccessor.min[0];
const sizeY = posAccessor.max[1] - posAccessor.min[1];
const sizeZ = posAccessor.max[2] - posAccessor.min[2];

console.log(`Dimensions (X, Y, Z): sizeX=${sizeX.toFixed(4)}, sizeY=${sizeY.toFixed(4)}, sizeZ=${sizeZ.toFixed(4)}`);

// Also check the rest of accessors or bufferViews to find where the barrel tip is located along the longest dimension
