import React from 'react';
import { AssistantState } from '../types/assistant';

interface LiveAudioWaveProps {
  state: AssistantState;
  inputVolume: number;
  outputVolume: number;
}

export const LiveAudioWave: React.FC<LiveAudioWaveProps> = ({
  state,
  inputVolume,
  outputVolume,
}) => {
  const bars = 28;

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 h-14 px-4 py-2">
      {Array.from({ length: bars }).map((_, index) => {
        // Curve factor: highest in middle, lower on sides
        const distFromCenter = Math.abs(index - bars / 2) / (bars / 2);
        const curve = 1 - distFromCenter * 0.6;

        let height = 4; // base height in px
        let barColor = 'bg-slate-700/60';

        if (state === 'speaking') {
          // Mayra speaking: vibrant pink/magenta
          const wave = Math.sin(index * 0.45 + Date.now() * 0.008) * 0.5 + 0.5;
          const dynamicMultiplier = (outputVolume * 0.75 + wave * 0.25) * curve;
          height = Math.max(4, Math.min(48, 4 + dynamicMultiplier * 44));
          barColor =
            index % 3 === 0
              ? 'bg-gradient-to-t from-pink-500 to-rose-400'
              : index % 3 === 1
              ? 'bg-gradient-to-t from-purple-500 to-pink-400'
              : 'bg-gradient-to-t from-indigo-500 to-violet-400';
        } else if (state === 'listening' && inputVolume > 0.02) {
          // User speaking: cyan/indigo
          const wave = Math.sin(index * 0.6 + Date.now() * 0.01) * 0.4 + 0.6;
          const dynamicMultiplier = inputVolume * wave * curve;
          height = Math.max(4, Math.min(46, 4 + dynamicMultiplier * 42));
          barColor =
            index % 2 === 0
              ? 'bg-gradient-to-t from-sky-500 to-cyan-300'
              : 'bg-gradient-to-t from-indigo-500 to-sky-400';
        } else if (state === 'listening') {
          // Subtle breathing wave
          const wave = Math.sin(index * 0.3 + Date.now() * 0.003) * 0.5 + 0.5;
          height = 4 + wave * 6 * curve;
          barColor = 'bg-sky-500/40';
        } else if (state === 'thinking') {
          // Traveling ripple
          const wave = Math.sin((index - (Date.now() * 0.015) % bars) * 0.8);
          height = 4 + Math.max(0, wave) * 16;
          barColor = 'bg-purple-500/60';
        }

        return (
          <div
            key={index}
            className={`w-1 sm:w-1.5 rounded-full transition-all duration-75 ${barColor}`}
            style={{
              height: `${height}px`,
            }}
          />
        );
      })}
    </div>
  );
};
