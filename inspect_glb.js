const fs = require('fs');
const buf = fs.readFileSync('public/chamber-clash/3d/items-clean.glb');
console.log(buf.slice(0, 3000).toString('utf-8').replace(/[^a-zA-Z0-9_{}":,\[\]-]/g, ''));
