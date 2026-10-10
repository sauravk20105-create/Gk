import React from 'react';
import { PersonaConfig } from '../types/assistant';
import { Sliders, Sparkles, Volume2, Mic, Flame, Shield, Heart } from 'lucide-react';

interface VoiceSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  config: PersonaConfig;
  onChange: (newConfig: PersonaConfig) => void;
}

export const VoiceSettingsSheet: React.FC<VoiceSettingsSheetProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Mayra Persona & Audio Config</h3>
              <p className="text-xs text-slate-400">Tune voice attitude & streaming parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Sass Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Sass & Wit Level
            </span>
            <span className="font-mono text-pink-400 font-semibold">
              {config.sassLevel === 5
                ? 'Maximum Sassy'
                : config.sassLevel === 4
                ? 'Bold & Teasing'
                : config.sassLevel === 3
                ? 'Casual Banter'
                : 'Subtle Wit'}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={config.sassLevel}
            onChange={(e) => onChange({ ...config, sassLevel: Number(e.target.value) })}
            className="w-full accent-pink-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Playful</span>
            <span>Charming</span>
            <span>Spicy</span>
          </div>
        </div>

        {/* Gemini Live Voice Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            Gemini Live Voice Profile
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Aoede', label: 'Aoede (Default)', desc: 'Warm, confident & charismatic' },
              { id: 'Kore', label: 'Kore', desc: 'Crisp, sassy & energetic' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => onChange({ ...config, voiceName: v.id as any })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  config.voiceName === v.id
                    ? 'border-pink-500 bg-pink-500/10 text-white'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium">{v.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Interruption Sensitivity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              Interruption Sensitivity (Instant Cutoff)
            </span>
            <span className="font-mono text-sky-400 font-semibold">
              {config.micSensitivity > 0.05 ? 'High (Cuts off immediately)' : 'Balanced'}
            </span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.08}
            step={0.01}
            value={config.micSensitivity}
            onChange={(e) => onChange({ ...config, micSensitivity: Number(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <p className="text-[10px] text-slate-500">
            When you speak while Mayra is talking, audio immediately flushes in &lt;15ms.
          </p>
        </div>

        {/* Background Service Mode */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div>
            <div className="text-xs font-medium text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Android Background Service Keep-Alive
            </div>
            <div className="text-[10px] text-slate-400">
              Simulate continuous foreground microphone listener
            </div>
          </div>
          <button
            onClick={() =>
              onChange({
                ...config,
                backgroundServiceActive: !config.backgroundServiceActive,
              })
            }
            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
              config.backgroundServiceActive ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                config.backgroundServiceActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Footer done */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium text-xs hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-pink-500/20"
        >
          Apply Configuration
        </button>
      </div>
    </div>
  );
};
