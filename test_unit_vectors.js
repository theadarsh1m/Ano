const THREE = require('three');

const SHOTGUN_LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);

function computeAimQuat(gunPos, targetPos) {
  const F = new THREE.Vector3().subVectors(targetPos, gunPos).normalize();
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(SHOTGUN_LOCAL_FORWARD, F);
  return { q, F };
}

// Test 1: Opponent Shot
const gunPosOpp = new THREE.Vector3(0, 0.9, -0.05);
const targetPosOpp = new THREE.Vector3(0, 1.2, -0.8);
const { q: qOpp, F: FOpp } = computeAimQuat(gunPosOpp, targetPosOpp);
const actualForwardOpp = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qOpp);

console.log("--- OPPONENT SHOT (setFromUnitVectors) ---");
console.log("Desired Forward:", FOpp);
console.log("Actual Forward :", actualForwardOpp);
console.log("Dot Product (Alignment):", actualForwardOpp.dot(FOpp));

// Test 2: Self Shot
const gunPosSelf = new THREE.Vector3(0, 0.9, 0.15);
const targetPosSelf = new THREE.Vector3(0, 1.1, 0.9);
const { q: qSelf, F: FSelf } = computeAimQuat(gunPosSelf, targetPosSelf);
const actualForwardSelf = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qSelf);

console.log("\n--- SELF SHOT (setFromUnitVectors) ---");
console.log("Desired Forward:", FSelf);
console.log("Actual Forward :", actualForwardSelf);
console.log("Dot Product (Alignment):", actualForwardSelf.dot(FSelf));
