"use client";

import React, { useRef, useEffect } from "react";

interface Petal {
  x: number;
  y: number;
  r: number; // size/radius
  d: number; // density/weight
  swing: number; // swing phase
  swingSpeed: number;
  fallSpeed: number;
  rotation: number;
  rotationSpeed: number;
}

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  alphaSpeed: number;
  baseAlpha: number;
}

export const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);

    // Handle resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Initialize Sakura Petals
    const maxPetals = 25;
    const petals: Petal[] = [];
    for (let i = 0; i < maxPetals; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 0.8 + 0.2,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.02 + 0.005,
        fallSpeed: Math.random() * 0.8 + 0.5,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 0.5 + 0.2,
      });
    }

    // Initialize Fireflies
    const maxFireflies = 30;
    const fireflies: Firefly[] = [];
    for (let i = 0; i < maxFireflies; i++) {
      const baseAlpha = Math.random() * 0.4 + 0.2;
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 1.5,
        alpha: baseAlpha,
        alphaSpeed: Math.random() * 0.02 + 0.005,
        baseAlpha,
      });
    }

    let gradientPhase = 0;

    // Animation Loop
    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Breathing Neon Background Gradient
      gradientPhase += 0.0015;
      const pulse = Math.sin(gradientPhase) * 10;
      
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8 + pulse
      );
      
      // Cyber Neon Glassmorphic Dark Colors
      grad.addColorStop(0, "#0a0f24");
      grad.addColorStop(0.5, "#070b16");
      grad.addColorStop(1, "#02040a");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle neon ambient spots
      const spotGrad = ctx.createRadialGradient(
        width * 0.2 + Math.cos(gradientPhase * 2) * 50,
        height * 0.3 + Math.sin(gradientPhase * 2) * 50,
        50,
        width * 0.2,
        height * 0.3,
        350
      );
      spotGrad.addColorStop(0, "rgba(106, 166, 255, 0.03)"); // soft primary blue
      spotGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);

      const spotGrad2 = ctx.createRadialGradient(
        width * 0.8 + Math.sin(gradientPhase) * 60,
        height * 0.7 + Math.cos(gradientPhase) * 60,
        30,
        width * 0.8,
        height * 0.7,
        300
      );
      spotGrad2.addColorStop(0, "rgba(255, 93, 168, 0.03)"); // soft accent pink
      spotGrad2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spotGrad2;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Fireflies (reacting to mouse)
      fireflies.forEach((f) => {
        f.x += f.vx;
        f.y += f.vy;

        // Mouse repelling calculation
        const dx = mouseRef.current.x - f.x;
        const dy = mouseRef.current.y - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 180) {
          const force = (180 - dist) / 180;
          // push fireflies away from mouse cursor
          f.x -= (dx / dist) * force * 1.5;
          f.y -= (dy / dist) * force * 1.5;
        }

        // Float bounce boundaries
        if (f.x < 0) f.x = width;
        if (f.x > width) f.x = 0;
        if (f.y < 0) f.y = height;
        if (f.y > height) f.y = 0;

        // Breathe firefly alpha
        f.alpha += f.alphaSpeed;
        if (f.alpha > f.baseAlpha + 0.2 || f.alpha < f.baseAlpha - 0.2) {
          f.alphaSpeed = -f.alphaSpeed;
        }

        // Render glowing gold dot
        ctx.beginPath();
        const fireflyGrad = ctx.createRadialGradient(
          f.x, f.y, 0,
          f.x, f.y, f.size * 3.5
        );
        fireflyGrad.addColorStop(0, `rgba(248, 211, 95, ${Math.max(f.alpha, 0.05)})`);
        fireflyGrad.addColorStop(0.4, `rgba(248, 211, 95, ${Math.max(f.alpha * 0.4, 0.01)})`);
        fireflyGrad.addColorStop(1, "rgba(248, 211, 95, 0)");
        
        ctx.fillStyle = fireflyGrad;
        ctx.arc(f.x, f.y, f.size * 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Draw Sakura Petals
      petals.forEach((p) => {
        p.y += p.fallSpeed;
        p.swing += p.swingSpeed;
        p.x += Math.sin(p.swing) * 0.5 + 0.3; // drift right slightly
        p.rotation += p.rotationSpeed;

        // Reset if fell off bounds
        if (p.y > height || p.x > width || p.x < -20) {
          p.y = -30;
          p.x = Math.random() * width;
          p.swing = Math.random() * Math.PI * 2;
        }

        // Draw individual petal
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        
        // Drawing a Ghibli-esque pink petal curve
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-p.r * 0.6, -p.r * 1.5, 0, -p.r * 2.2);
        ctx.quadraticCurveTo(p.r * 0.6, -p.r * 1.5, 0, 0);
        
        // Petal color (neon pastel pink)
        ctx.fillStyle = "rgba(255, 93, 168, 0.15)";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(255, 93, 168, 0.3)";
        ctx.fill();
        ctx.restore();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-50 pointer-events-none"
    />
  );
};
export default ParticleBackground;
