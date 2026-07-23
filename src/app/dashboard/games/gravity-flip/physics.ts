import { Player, Platform, GameConfig, GravityDirection } from "./types";

interface PhysicsEvents {
  onLanding: (player: Player) => void;
  onPlayerCollision: (p1: Player, p2: Player) => void;
  onDeath: (player: Player) => void;
}

export function updatePhysics(
  players: Player[],
  platform: Platform,
  config: GameConfig,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  events: PhysicsEvents
) {
  // Cap dt to prevent massive steps when tab is inactive
  const maxDt = 0.03; 
  const currentDt = Math.min(dt, maxDt);

  // 1. Update positions & velocities
  for (const p of players) {
    if (!p.isAlive) continue;

    // Apply gravity
    p.vy += p.gravityDir * config.gravityStrength * currentDt;

    // Cap vertical velocity (terminal velocity)
    const maxVy = 1500;
    if (Math.abs(p.vy) > maxVy) {
      p.vy = Math.sign(p.vy) * maxVy;
    }

    // Update positions
    p.x += p.vx * currentDt;
    p.y += p.vy * currentDt;

    // Apply rotation for players in the air
    if (!p.isGrounded) {
      p.rotation += p.angularVelocity * currentDt;
      // Natural air drag on rotation
      p.angularVelocity *= (1 - 0.8 * currentDt);
    } else {
      // Return player to upright position when grounded
      p.rotation *= (1 - 15 * currentDt);
      if (Math.abs(p.rotation) < 0.01) p.rotation = 0;
    }

    // Update squash and stretch spring dynamics
    const k = 180; // spring stiffness
    const c = 10;  // damping
    const sxDiff = p.squashX - 1.0;
    const syDiff = p.squashY - 1.0;
    
    p.squashVx += (-k * sxDiff - c * p.squashVx) * currentDt;
    p.squashVy += (-k * syDiff - c * p.squashVy) * currentDt;
    
    p.squashX += p.squashVx * currentDt;
    p.squashY += p.squashVy * currentDt;

    // Boundary check for grounding reset
    p.isGrounded = false;
  }

  // 2. Resolve Platform Collisions
  for (const p of players) {
    if (!p.isAlive) continue;

    // Find closest point on platform AABB to circle center
    const closestX = Math.max(platform.x, Math.min(p.x, platform.x + platform.width));
    const closestY = Math.max(platform.y, Math.min(p.y, platform.y + platform.height));

    const dx = p.x - closestX;
    const dy = p.y - closestY;
    const distSquared = dx * dx + dy * dy;

    if (distSquared < p.radius * p.radius) {
      const dist = Math.sqrt(distSquared);
      
      // Calculate collision normal
      let nx = dist > 0 ? dx / dist : 0;
      let ny = dist > 0 ? dy / dist : 1;

      // If circle center is inside platform, choose the shallowest penetration axis
      if (dist === 0) {
        const distL = p.x - platform.x;
        const distR = (platform.x + platform.width) - p.x;
        const distT = p.y - platform.y;
        const distB = (platform.y + platform.height) - p.y;
        const minDist = Math.min(distL, distR, distT, distB);
        if (minDist === distL) { nx = -1; ny = 0; }
        else if (minDist === distR) { nx = 1; ny = 0; }
        else if (minDist === distT) { nx = 0; ny = -1; }
        else { nx = 0; ny = 1; }
      }

      const overlap = p.radius - dist;

      // Push out of platform
      p.x += nx * overlap;
      p.y += ny * overlap;

      // Identify landing vs bouncing
      const isTopLanding = ny < -0.7 && p.gravityDir === 1;
      const isBottomLanding = ny > 0.7 && p.gravityDir === -1;

      if (isTopLanding || isBottomLanding) {
        if (Math.abs(p.vy) > 100) {
          events.onLanding(p);
          // High speed landing squash
          const force = Math.min(0.5, Math.abs(p.vy) / 1200);
          p.squashX = 1 + force * 0.8;
          p.squashY = 1 - force * 0.5;
          p.squashVx = 0;
          p.squashVy = 0;
        }
        p.isGrounded = true;
        p.vy = 0;
        
        // Apply landing friction
        p.vx *= (1 - config.friction * currentDt * 5);
        if (Math.abs(p.vx) < 5) p.vx = 0;
      } else {
        // Lateral/opposite bounce reflection
        const dot = p.vx * nx + p.vy * ny;
        if (dot < 0) {
          p.vx -= (1 + config.bounceAmount) * dot * nx;
          p.vy -= (1 + config.bounceAmount) * dot * ny;
          // Apply a bit of spin on wall bounces
          p.angularVelocity = -ny * p.vx * 0.1;
        }
      }
    }
  }

  // 3. Resolve Player-to-Player Collisions (Elastic Circle Collisions)
  for (let i = 0; i < players.length; i++) {
    const p1 = players[i];
    if (!p1.isAlive) continue;

    for (let j = i + 1; j < players.length; j++) {
      const p2 = players[j];
      if (!p2.isAlive) continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = p1.radius + p2.radius;

      if (distance < minDistance) {
        const overlap = minDistance - distance;
        
        // Collision normal
        const nx = distance > 0 ? dx / distance : 1;
        const ny = distance > 0 ? dy / distance : 0;

        // Separate players to prevent sticking
        p1.x -= nx * overlap * 0.5;
        p1.y -= ny * overlap * 0.5;
        p2.x += nx * overlap * 0.5;
        p2.y += ny * overlap * 0.5;

        // Relative velocity
        const rvx = p2.vx - p1.vx;
        const rvy = p2.vy - p1.vy;

        // Velocity along collision normal
        const velAlongNormal = rvx * nx + rvy * ny;

        // Do not resolve if velocities are separating
        if (velAlongNormal < 0) {
          // RESTITUTION (use slightly higher bounciness for player bumps to keep it fun!)
          const restitution = Math.max(config.bounceAmount * 1.3, 0.5);
          
          // Impulse scalar
          const jImpulse = -(1 + restitution) * velAlongNormal / (1 / p1.mass + 1 / p2.mass);

          // Apply impulse to each player
          p1.vx -= (jImpulse * nx) / p1.mass;
          p1.vy -= (jImpulse * ny) / p1.mass;
          p2.vx += (jImpulse * nx) / p2.mass;
          p2.vy += (jImpulse * ny) / p2.mass;

          // Push them out of grounding state to cause sliding
          p1.isGrounded = false;
          p2.isGrounded = false;

          // Apply torque spin to both
          const spinMagnitude = 12;
          p1.angularVelocity = (Math.random() - 0.5) * spinMagnitude;
          p2.angularVelocity = (Math.random() - 0.5) * spinMagnitude;

          // Visual squash for both players
          p1.squashX = 1.25; p1.squashY = 0.75;
          p2.squashX = 1.25; p2.squashY = 0.75;

          // Trigger collision sound/callback
          events.onPlayerCollision(p1, p2);
        }
      }
    }
  }

  // 4. Death Boundaries Check
  for (const p of players) {
    if (!p.isAlive) continue;

    // Check if player exited screen borders
    const isOutLeft = p.x + p.radius < 0;
    const isOutRight = p.x - p.radius > canvasWidth;
    const isOutTop = p.y + p.radius < 0;
    const isOutBottom = p.y - p.radius > canvasHeight;

    if (isOutLeft || isOutRight || isOutTop || isOutBottom) {
      p.isAlive = false;
      events.onDeath(p);
    }
  }
}
