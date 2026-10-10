/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { VoiceOrb } from './components/VoiceOrb';
import { LiveAudioWave } from './components/LiveAudioWave';
import { AndroidProjectHub } from './components/AndroidProjectHub';
import { VoiceSettingsSheet } from './components/VoiceSettingsSheet';
import { AudioStreamer } from './utils/audioStreamer';
import { AssistantState, ConnectionState, PersonaConfig } from './types/assistant';
import {
  Mic,
  MicOff,
  Sliders,
  Smartphone,
  Sparkles,
  Wifi,
  BatteryCharging,
  Radio,
  Zap,
  VolumeX,
  Volume2,
  Info,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // Voice & Persona Configuration
  const [config, setConfig] = useState<PersonaConfig>({
    name: 'Mayra',
    voiceName: 'Aoede',
    sassLevel: 4,
    confidence: 'high',
    backgroundServiceActive: true,
    hapticFeedback: true,
    micSensitivity: 0.04,
  });

  // Streaming State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discreet spoken caption (transient, strictly not a chat history UI)
  const [latestSubtitle, setLatestSubtitle] = useState<string>('');
  const [showCaptions, setShowCaptions] = useState(true);

  // Modals
  const [isCodeHubOpen, setIsCodeHubOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const subtitleTimeoutRef = useRef<any>(null);

  // Construct dynamic system prompt based on config
  const getMayraPrompt = () => {
    const sassDescriptions = [
      'Gentle, witty, playful, and charming.',
      'Playful banter, clever humor, casually confident.',
      'Razor-sharp, playfully teasing, high swagger, witty one-liners.',
      'Sassy, bold, magnetic confidence, dry humor, playfully teasing.',
      'Ultra-sassy, hilarious, fiercely confident, witty roasts, pure charisma.',
    ];
    const sassText = sassDescriptions[config.sassLevel - 1] || sassDescriptions[3];

    return `You are Mayra, a young, confident, witty, and playfully sassy personal assistant.
Your attitude: ${sassText}
Key Traits:
- Flirty, playful, teasing tone: You talk like a brilliant, charismatic best friend or personal assistant who knows she is indispensable and enjoys teasing the user casually.
- Smart, emotionally responsive, and expressive: You react with genuine enthusiasm, clever banter, and witty observations. NEVER robotic or boring.
- Uses bold, witty one-liners, dry or light sarcasm, and engaging conversational dialogue.
- Safe yet charming: Avoid explicit or inappropriate content, but maintain immense charm, attitude, and playful swagger.
- Spoken audio formatting: Your responses are spoken aloud via Gemini Live voice audio. Keep answers punchy, natural, conversational, and energetic. Do NOT speak markdown, lists, bullet points, asterisks, or emoji descriptions.
- You are running live as Mayra on their Android device.`;
  };

  // Start continuous bi-directional voice streaming session
  const startSession = async () => {
    try {
      setErrorMessage(null);
      setConnectionState('connecting');

      // Initialize AudioStreamer
      const streamer = new AudioStreamer();
      streamer.interruptionSensitivity = config.micSensitivity;

      streamer.onInputVolume = (vol) => {
        setInputVolume(vol);
      };

      streamer.onOutputVolume = (vol) => {
        setOutputVolume(vol);
      };

      streamer.onSpeechStateChange = (state) => {
        if (state === 'speaking') {
          setAssistantState('speaking');
        } else if (state === 'listening') {
          setAssistantState('listening');
        } else {
          setAssistantState('idle');
        }
      };

      streamer.onInterrupted = () => {
        setAssistantState('interrupted');
        setTimeout(() => setAssistantState('listening'), 300);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'user_interruption' }));
        }
      };

      await streamer.start();
      audioStreamerRef.current = streamer;

      // Connect WebSocket to backend Live proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[App] WebSocket connected to server');
        setConnectionState('connected');
        setAssistantState('listening');
        setIsSessionActive(true);

        // Send init configuration
        ws.send(
          JSON.stringify({
            type: 'init',
            voice: config.voiceName,
            systemInstruction: getMayraPrompt(),
          })
        );
      };

      // Connect audio chunk sender
      streamer.onAudioData = (base64) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'audio' && msg.data) {
            streamer.enqueueAudioChunk(msg.data);
          }

          if (msg.type === 'transcript') {
            setLatestSubtitle(msg.text);
            if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
            subtitleTimeoutRef.current = setTimeout(() => {
              setLatestSubtitle('');
            }, 6000);
          }

          if (msg.type === 'interrupted') {
            console.log('[App] Server notified interruption');
            streamer.stopPlaybackAndClearQueue();
            setAssistantState('interrupted');
            setTimeout(() => setAssistantState('listening'), 300);
          }

          if (msg.type === 'turn_complete') {
            // Turn completed
          }

          if (msg.type === 'error') {
            console.error('[App] Server reported error:', msg.message);
            setErrorMessage(msg.message);
          }
        } catch (e) {
          console.error('[App] Failed to parse message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[App] WebSocket error:', e);
        setErrorMessage('Connection error. Retrying...');
      };

      ws.onclose = () => {
        console.log('[App] WebSocket closed');
        setConnectionState('disconnected');
        setAssistantState('idle');
        setIsSessionActive(false);
      };
    } catch (err: any) {
      console.error('[App] Failed to start voice session:', err);
      setErrorMessage(err.message || 'Microphone access failed');
      setConnectionState('error');
      setAssistantState('idle');
      setIsSessionActive(false);
    }
  };

  // Stop session
  const stopSession = () => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsSessionActive(false);
    setConnectionState('disconnected');
    setAssistantState('idle');
    setInputVolume(0);
    setOutputVolume(0);
  };

  // Toggle active state
  const handleToggle = () => {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  // Trigger quick icebreaker greeting from Mayra
  const handleTriggerGreeting = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'trigger_greeting' }));
      setAssistantState('thinking');
    } else {
      startSession().then(() => {
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'trigger_greeting' }));
          }
        }, 1200);
      });
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-x-hidden select-none relative font-sans">
      {/* Dynamic ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] transition-all duration-700 opacity-40 ${
            assistantState === 'speaking'
              ? 'bg-rose-500/50 scale-125'
              : assistantState === 'listening'
              ? 'bg-indigo-600/40 scale-100'
              : 'bg-purple-900/25 scale-90'
          }`}
        />
      </div>

      {/* Top Android System Status Bar & App Bar */}
      <header className="relative z-10 px-5 pt-3 pb-2 max-w-4xl mx-auto w-full">
        {/* Simulated Android Status Bar Icons */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1 font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <span>09:41</span>
            <span className="text-[10px] text-pink-400 font-semibold px-1 py-0.2 rounded bg-pink-500/10">5G</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Wifi className="w-3.5 h-3.5" />
            <span className="text-[11px]">88%</span>
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Assistant Header Navigation Bar */}
        <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-md shadow-pink-500/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              {isSessionActive && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-sm sm:text-base tracking-tight">Mayra</h1>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                  gemini-3.1-flash-live
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isSessionActive
                  ? 'Continuous bi-directional voice streaming'
                  : 'Zero-touch voice assistant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Android Project Button */}
            <button
              onClick={() => setIsCodeHubOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="View Kotlin & Jetpack Compose Android Architecture"
            >
              <Smartphone className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Android Source</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
              title="Voice & Persona Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Center Stage: Pure Zero-Touch Voice Canvas */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 max-w-lg mx-auto w-full text-center">
        {/* Status Pill Indicator */}
        <div className="mb-4">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${
              assistantState === 'speaking'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/20'
                : assistantState === 'listening'
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-lg shadow-sky-500/20'
                : assistantState === 'thinking'
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                : assistantState === 'interrupted'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                assistantState === 'speaking'
                  ? 'bg-rose-400 animate-ping'
                  : assistantState === 'listening'
                  ? 'bg-sky-400 animate-pulse'
                  : assistantState === 'thinking'
                  ? 'bg-purple-400 animate-spin'
                  : 'bg-slate-500'
              }`}
            />
            <span>
              {assistantState === 'speaking'
                ? 'Mayra is speaking (Interrupt anytime)'
                : assistantState === 'listening'
                ? 'Listening continuously (Zero-touch)'
                : assistantState === 'thinking'
                ? 'Thinking...'
                : assistantState === 'interrupted'
                ? 'Interrupted by you!'
                : isSessionActive
                ? 'Session Active'
                : 'Standby • Tap Orb to Start'}
            </span>
          </div>
        </div>

        {/* Central Fluid Voice Orb */}
        <div className="my-2 relative">
          <VoiceOrb
            state={assistantState}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            isActive={isSessionActive}
            onClick={handleToggle}
          />
        </div>

        {/* Live Audio Reactive Frequency Wave */}
        <div className="w-full max-w-xs my-2">
          <LiveAudioWave
            state={assistantState}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
          />
        </div>

        {/* Discreet Live Speech Subtitle (Not a chat log, transient single bubble) */}
        {latestSubtitle && showCaptions && (
          <div className="max-w-md px-4 py-2 my-2 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md text-xs sm:text-sm text-pink-200 animate-fade-in shadow-xl">
            <span className="text-[11px] font-semibold text-pink-400 uppercase tracking-wider block mb-0.5">
              Mayra
            </span>
            "{latestSubtitle}"
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="max-w-md p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Conversational Spoken Prompts Inspiration (What to speak out loud) */}
        {!isSessionActive && (
          <div className="mt-4 w-full">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Speak out loud to Mayra
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {[
                'Hey Mayra, introduce yourself!',
                'What is your honest opinion of me?',
                'Give me a witty morning reality check.',
                'Interrupt me if I start talking too much!',
              ].map((prompt, idx) => (
                <div
                  key={idx}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-pink-500/40 transition-colors"
                >
                  "{prompt}"
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Floating Control Bar */}
      <footer className="relative z-10 px-5 pb-6 pt-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-lg border border-slate-800/80 rounded-2xl p-3 shadow-2xl">
          {/* Quick Icebreaker Greeting Button */}
          <button
            onClick={handleTriggerGreeting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all cursor-pointer"
            title="Ask Mayra to greet you"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Say Hey</span>
          </button>

          {/* Main Primary Microphone / Zero-Touch Toggle Button */}
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all transform active:scale-95 shadow-xl cursor-pointer ${
              isSessionActive
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30'
                : 'bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white hover:opacity-95 shadow-pink-500/30'
            }`}
          >
            {isSessionActive ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Pause Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 animate-bounce" />
                <span>Start Zero-Touch Voice</span>
              </>
            )}
          </button>

          {/* Instant Interruption Simulation Trigger */}
          <button
            onClick={() => {
              if (audioStreamerRef.current) {
                audioStreamerRef.current.stopPlaybackAndClearQueue();
                setAssistantState('interrupted');
                setTimeout(() => setAssistantState('listening'), 300);
              }
            }}
            disabled={assistantState !== 'speaking'}
            className={`p-2.5 rounded-xl border transition-all ${
              assistantState === 'speaking'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 cursor-pointer shadow-md'
                : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
            title="Simulate instant interruption cut-off"
          >
            <VolumeX className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Highlights Subtext */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            No Text-Chat • 100% Voice
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-pink-400" />
            Instant Interruption
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-400" />
            Background Service
          </span>
        </div>
      </footer>

      {/* Android Native Architecture & Kotlin Code Hub Modal */}
      <AndroidProjectHub
        isOpen={isCodeHubOpen}
        onClose={() => setIsCodeHubOpen(false)}
      />

      {/* Voice & Persona Tuning Sheet Modal */}
      <VoiceSettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onChange={setConfig}
      />
    </div>
  );
}
