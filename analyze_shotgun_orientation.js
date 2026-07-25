const fs = require('fs');

const glbBuffer = fs.readFileSync('public/chamber-clash/3d/shotgun-clean.glb');

const jsonLength = glbBuffer.readUInt32LE(12);
const jsonChunk = glbBuffer.slice(20, 20 + jsonLength).toString('utf-8');
const gltf = JSON.parse(jsonChunk);

// Buffer chunk is right after JSON chunk
// JSON chunk header is 8 bytes (len, type) at offset 12. So JSON ends at 20 + jsonLength.
// Alignment to 4 bytes:
const binHeaderOffset = 20 + Math.ceil(jsonLength / 4) * 4;
// BIN header is 8 bytes: length (4), type (4) -> type 0x004E4942 (BIN)
const binBuffer = glbBuffer.slice(binHeaderOffset + 8);

// Accessor 0 = POSITION
const acc = gltf.accessors[0];
const bv = gltf.bufferViews[acc.bufferView];

const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
const count = acc.count;
const stride = bv.byteStride || 12; // float32 * 3

const vertices = [];
for (let i = 0; i < count; i++) {
  const off = byteOffset + i * stride;
  const x = binBuffer.readFloatLE(off);
  const y = binBuffer.readFloatLE(off + 4);
  const z = binBuffer.readFloatLE(off + 8);
  vertices.push({ x, y, z });
}

// Compare min X region (-0.58 to -0.4) vs max X region (+0.4 to +0.57)
const minXVerts = vertices.filter(v => v.x < -0.4);
const maxXVerts = vertices.filter(v => v.x > 0.4);

console.log(`Min X Vertices Count (X < -0.4): ${minXVerts.length}`);
console.log(`Max X Vertices Count (X > 0.4): ${maxXVerts.length}`);

// Calculate Y and Z bounding box for Min X vs Max X
function getBounds(verts) {
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of verts) {
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  return { 
    heightY: maxY - minY, 
    widthZ: maxZ - minZ,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

console.log("Min X region bounds:", getBounds(minXVerts));
console.log("Max X region bounds:", getBounds(maxXVerts));
