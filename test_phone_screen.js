const THREE = require('three');

// Screen normal vector when unrotated is +Z = (0, 0, 1)
const screenNormalLocal = new THREE.Vector3(0, 0, 1);

// Test Local Actor setup (rotation.y = Math.PI, hinge rotation.x = -2.5)
const qGroupLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
const qHingeLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(-2.5, 0, 0));
const qCombinedLocal = qGroupLocal.clone().multiply(qHingeLocal);

const screenNormalWorldLocal = screenNormalLocal.clone().applyQuaternion(qCombinedLocal);

console.log("=== LOCAL ACTOR SCREEN NORMAL ===");
console.log("Local Actor Screen Normal Z:", screenNormalWorldLocal.z); // Positive Z means facing local camera!

// Test Opponent Actor setup (rotation.y = 0, hinge rotation.x = -2.5)
const qGroupOpp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
const qHingeOpp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-2.5, 0, 0));
const qCombinedOpp = qGroupOpp.clone().multiply(qHingeOpp);

const screenNormalWorldOpp = screenNormalLocal.clone().applyQuaternion(qCombinedOpp);

console.log("\n=== OPPONENT ACTOR SCREEN NORMAL ===");
console.log("Opponent Actor Screen Normal Z:", screenNormalWorldOpp.z); // Negative Z means facing opponent!
