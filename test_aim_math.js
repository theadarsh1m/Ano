const THREE = require('three');

const SHOTGUN_LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);

function computeShotgunAimQuaternion(gunPos, targetPos) {
  const F = new THREE.Vector3().subVectors(targetPos, gunPos).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  
  if (Math.abs(F.dot(upRef)) > 0.99) {
    upRef.set(0, 0, 1);
  }
  
  const S = new THREE.Vector3().crossVectors(upRef, F).normalize();
  const U = new THREE.Vector3().crossVectors(F, S).normalize();
  
  const mat = new THREE.Matrix4();
  // makeBasis(xAxis, yAxis, zAxis) -> sets column 0 = F, column 1 = U, column 2 = S
  mat.makeBasis(F, U, S);
  
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(mat);
  return q;
}

// Test 1: Opponent Shot
const gunPosOpp = new THREE.Vector3(0, 0.9, -0.05);
const targetPosOpp = new THREE.Vector3(0, 1.2, -0.8);
const qOpp = computeShotgunAimQuaternion(gunPosOpp, targetPosOpp);
const actualForwardOpp = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qOpp);
const desiredForwardOpp = targetPosOpp.clone().sub(gunPosOpp).normalize();

console.log("--- OPPONENT SHOT ---");
console.log("Desired Forward:", desiredForwardOpp);
console.log("Actual Forward :", actualForwardOpp);
console.log("Dot Product (Alignment):", actualForwardOpp.dot(desiredForwardOpp));

// Test 2: Self Shot
const gunPosSelf = new THREE.Vector3(0, 0.9, 0.15);
const targetPosSelf = new THREE.Vector3(0, 1.1, 0.9);
const qSelf = computeShotgunAimQuaternion(gunPosSelf, targetPosSelf);
const actualForwardSelf = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qSelf);
const desiredForwardSelf = targetPosSelf.clone().sub(gunPosSelf).normalize();

console.log("\n--- SELF SHOT ---");
console.log("Desired Forward:", desiredForwardSelf);
console.log("Actual Forward :", actualForwardSelf);
console.log("Dot Product (Alignment):", actualForwardSelf.dot(desiredForwardSelf));
