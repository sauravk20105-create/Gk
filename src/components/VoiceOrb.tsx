import React, { useEffect, useRef } from 'react';
import { AssistantState } from '../types/assistant';

interface VoiceOrbProps {
  state: AssistantState;
  inputVolume: number; // 0 to 1
  outputVolume: number; // 0 to 1
  onClick?: () => void;
  isActive: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  inputVolume,
  outputVolume,
  onClick,
  isActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine base radius and energy based on state
      let baseRadius = 80;
      let energy = 0;

      if (!isActive) {
        baseRadius = 60;
        energy = 0.05;
      } else if (state === 'speaking') {
        baseRadius = 88 + outputVolume * 45;
        energy = 0.5 + outputVolume * 1.5;
      } else if (state === 'listening') {
        baseRadius = 75 + inputVolume * 30;
        energy = 0.2 + inputVolume * 0.8;
      } else if (state === 'thinking') {
        baseRadius = 78;
        energy = 0.4;
      } else if (state === 'interrupted') {
        baseRadius = 70;
        energy = 0.1;
      } else {
        baseRadius = 70;
        energy = 0.15;
      }

      // Outer ethereal glow layers
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 2.2
      );

      if (state === 'speaking') {
        // Vibrant hot pink / magenta / electric purple (Mayra's signature sassy aura)
        glowGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
        glowGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
      } else if (state === 'listening') {
        // Deep electric violet & neon cyan
        glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
        glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      } else if (state === 'thinking') {
        // Amber / Violet mystery
        glowGrad.addColorStop(0, 'rgba(236, 72, 153, 0.4)');
        glowGrad.addColorStop(0.6, 'rgba(139, 92, 246, 0.25)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        // Subtle ambient standby
        glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        glowGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Draw secondary vibrating harmonic rings
      const ringCount = state === 'speaking' ? 4 : 2;
      for (let r = 1; r <= ringCount; r++) {
        const ringRadius = baseRadius + r * (15 + (state === 'speaking' ? outputVolume * 25 : 8));
        const alpha = Math.max(0, 0.25 - r * 0.05 + (state === 'speaking' ? outputVolume * 0.2 : 0));
        ctx.strokeStyle =
          state === 'speaking'
            ? `rgba(244, 63, 94, ${alpha})`
            : `rgba(99, 102, 241, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw fluid morphing blob orb
      const points = 36;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        // Harmonic noise offsets
        const offset1 = Math.sin(angle * 4 + time * 3) * 6 * energy;
        const offset2 = Math.cos(angle * 6 - time * 2) * 5 * energy;
        const offset3 = Math.sin(angle * 2 + time * 1.5) * 8 * energy;
        const r = baseRadius + offset1 + offset2 + offset3;

        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Fluid core gradient
      const coreGrad = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );

      if (state === 'speaking') {
        coreGrad.addColorStop(0, '#f43f5e'); // rose-500
        coreGrad.addColorStop(0.35, '#ec4899'); // pink-500
        coreGrad.addColorStop(0.7, '#a855f7'); // purple-500
        coreGrad.addColorStop(1, '#6366f1'); // indigo-500
      } else if (state === 'listening') {
        coreGrad.addColorStop(0, '#6366f1'); // indigo-500
        coreGrad.addColorStop(0.5, '#38bdf8'); // sky-400
        coreGrad.addColorStop(1, '#a855f7'); // purple-500
      } else if (state === 'thinking') {
        coreGrad.addColorStop(0, '#a855f7');
        coreGrad.addColorStop(0.5, '#f43f5e');
        coreGrad.addColorStop(1, '#6366f1');
      } else {
        coreGrad.addColorStop(0, '#475569');
        coreGrad.addColorStop(1, '#334155');
      }

      ctx.fillStyle = coreGrad;
      ctx.shadowColor = state === 'speaking' ? '#f43f5e' : '#6366f1';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner highlight reflection
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        centerX - baseRadius * 0.28,
        centerY - baseRadius * 0.28,
        baseRadius * 0.45,
        baseRadius * 0.25,
        Math.PI / 4,
        0,
        Math.PI * 2
      );
      const highlightGrad = ctx.createLinearGradient(
        centerX - baseRadius * 0.5,
        centerY - baseRadius * 0.5,
        centerX,
        centerY
      );
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlightGrad;
      ctx.fill();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, inputVolume, outputVolume, isActive]);

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer select-none group"
    >
      <canvas
        ref={canvasRef}
        width={380}
        height={380}
        className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] transition-transform duration-300 group-hover:scale-105 active:scale-95"
      />
    </div>
  );
};
