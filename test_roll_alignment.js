const THREE = require('three');

const SHOTGUN_LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);

function computeShotgunAimQuaternion(gunPosition, targetPosition, rollDegrees = -90) {
  const F = new THREE.Vector3().subVectors(targetPosition, gunPosition).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  
  if (Math.abs(F.dot(upRef)) > 0.99) {
    upRef.set(0, 0, 1);
  }
  
  const S = new THREE.Vector3().crossVectors(F, upRef).normalize();
  const U = new THREE.Vector3().crossVectors(S, F).normalize();
  
  const mat = new THREE.Matrix4();
  mat.makeBasis(F, U, S);
  
  const baseAimQ = new THREE.Quaternion();
  baseAimQ.setFromRotationMatrix(mat);

  const rollRad = THREE.MathUtils.degToRad(rollDegrees);
  const rollQ = new THREE.Quaternion().setFromAxisAngle(SHOTGUN_LOCAL_FORWARD, rollRad);

  return baseAimQ.multiply(rollQ);
}

// Test Opponent Shot with -90° roll and +90° roll
const gunPosOpp = new THREE.Vector3(0, 0.95, -0.05);
const targetPosOpp = new THREE.Vector3(0, 1.15, -0.85);

const qOppNeg = computeShotgunAimQuaternion(gunPosOpp, targetPosOpp, -90);
const qOppPos = computeShotgunAimQuaternion(gunPosOpp, targetPosOpp, +90);

const fOppNeg = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qOppNeg);
const fOppPos = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qOppPos);

const desiredOpp = targetPosOpp.clone().sub(gunPosOpp).normalize();

console.log("=== OPPONENT SHOT ALIGNMENT WITH ROLL ===");
console.log("-90° Roll Alignment Dot:", fOppNeg.dot(desiredOpp));
console.log("+90° Roll Alignment Dot:", fOppPos.dot(desiredOpp));

// Test Self Shot with -90° roll and +90° roll
const gunPosSelf = new THREE.Vector3(0, 0.90, 0.15);
const targetPosSelf = new THREE.Vector3(0, 1.15, 0.85);

const qSelfNeg = computeShotgunAimQuaternion(gunPosSelf, targetPosSelf, -90);
const qSelfPos = computeShotgunAimQuaternion(gunPosSelf, targetPosSelf, +90);

const fSelfNeg = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qSelfNeg);
const fSelfPos = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(qSelfPos);

const desiredSelf = targetPosSelf.clone().sub(gunPosSelf).normalize();

console.log("\n=== SELF SHOT ALIGNMENT WITH ROLL ===");
console.log("-90° Roll Alignment Dot:", fSelfNeg.dot(desiredSelf));
console.log("+90° Roll Alignment Dot:", fSelfPos.dot(desiredSelf));
