const THREE = require('three');

const SHOTGUN_LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);

function computeShotgunAimQuaternionBasis(gunPos, targetPos) {
  const F = new THREE.Vector3().subVectors(targetPos, gunPos).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  
  if (Math.abs(F.dot(upRef)) > 0.99) {
    upRef.set(0, 0, 1);
  }
  
  const S = new THREE.Vector3().crossVectors(upRef, F).normalize();
  const U = new THREE.Vector3().crossVectors(F, S).normalize();
  
  const mat = new THREE.Matrix4();
  mat.makeBasis(F, U, S);
  
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(mat);
  return { q, F, U, S };
}

// Opponent Shot
const gunPosOpp = new THREE.Vector3(0, 0.95, -0.05);
const targetPosOpp = new THREE.Vector3(0, 1.15, -0.85); // Opponent head
const { q: qOpp, F: FOpp, U: UOpp } = computeShotgunAimQuaternionBasis(gunPosOpp, targetPosOpp);

const actualF_Opp = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qOpp);
const actualUp_Opp = new THREE.Vector3(0, 1, 0).applyQuaternion(qOpp);

console.log("=== OPPONENT SHOT ===");
console.log("Desired Forward F:", FOpp);
console.log("Actual Forward   :", actualF_Opp);
console.log("Alignment (dot)  :", actualF_Opp.dot(FOpp));
console.log("Actual Local Up  :", actualUp_Opp);

// Self Shot
const gunPosSelf = new THREE.Vector3(0, 0.90, 0.15);
const targetPosSelf = new THREE.Vector3(0, 1.15, 0.85); // Camera / local face
const { q: qSelf, F: FSelf, U: USelf } = computeShotgunAimQuaternionBasis(gunPosSelf, targetPosSelf);

const actualF_Self = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qSelf);
const actualUp_Self = new THREE.Vector3(0, 1, 0).applyQuaternion(qSelf);

console.log("\n=== SELF SHOT ===");
console.log("Desired Forward F:", FSelf);
console.log("Actual Forward   :", actualF_Self);
console.log("Alignment (dot)  :", actualF_Self.dot(FSelf));
console.log("Actual Local Up  :", actualUp_Self);
