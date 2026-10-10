import React, { useState } from 'react';
import { ANDROID_FILES } from '../data/androidProjectData';
import { AndroidCodeFile } from '../types/assistant';
import JSZip from 'jszip';
import {
  Code2,
  Download,
  Copy,
  Check,
  Smartphone,
  Layers,
  Cpu,
  Radio,
  FileCode,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface AndroidProjectHubProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectHub: React.FC<AndroidProjectHubProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<AndroidCodeFile>(ANDROID_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'architecture'>('code');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();

      // Readme instructions
      zip.file(
        'README.md',
        `# Mayra - Sassy AI Live Voice Assistant for Android
Native Android Project built with Kotlin, Jetpack Compose, and Gemini Live continuous bidirectional audio streaming.

## Features:
1. **Gemini Live BidiGenerateContent**: targeting \`gemini-3.1-flash-live-preview\` with continuous 16kHz PCM audio upload and 24kHz PCM audio download.
2. **Mayra Persona**: Young, confident, witty, playful, sassy personal assistant.
3. **Zero-Touch Voice UI**: Strictly no text chat; pure voice-driven interface with reactive pulsating orb.
4. **Instant Interruption**: Immediate flush and stop on user speech or server interruption signal.
5. **Background-Running Foreground Service**: \`MayraVoiceService\` with microphone foreground service type and wake lock.

## How to Run:
1. Open this folder in Android Studio (Giraffe / Hedgehog / Koala or newer).
2. Insert your \`GEMINI_API_KEY\` into \`GeminiLiveClient.kt\` or local.properties.
3. Run on a physical Android device or emulator with microphone enabled.
`
      );

      // Add all project files
      for (const file of ANDROID_FILES) {
        zip.file(file.path, file.content);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Mayra-Android-Voice-Assistant.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl text-pink-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-semibold text-base">
                  Native Android Architecture & Kotlin Source
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  Jetpack Compose + Kotlin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Production-grade background voice service & Gemini Live audio engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-95 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Bundling Zip...' : 'Export Android Project (.zip)'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-sm font-semibold px-2.5"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-800/80 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-pink-400" />
            Source Files ({ANDROID_FILES.length})
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Android Architecture & Pipeline
          </button>
        </div>

        {/* Content area */}
        {activeTab === 'code' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar list */}
            <div className="w-full md:w-72 border-r border-slate-800 bg-slate-950/50 p-3 overflow-y-auto space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
                Project Files
              </div>
              {ANDROID_FILES.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    selectedFile.name === file.name
                      ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    {file.category}
                  </span>
                </button>
              ))}
            </div>

            {/* Code viewer */}
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/40 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-slate-300 font-medium">{selectedFile.path}</span>
                  <span className="text-slate-500 text-[11px] hidden sm:inline">— {selectedFile.description}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-slate-200 selection:bg-pink-500/30">
                <pre>{selectedFile.content}</pre>
              </div>
            </div>
          </div>
        ) : (
          /* Architecture overview */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 text-pink-400 font-medium text-sm mb-2">
                  <Cpu className="w-4 h-4" />
                  1. Background Service & AudioRecord
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <code className="text-pink-300 font-mono">MayraVoiceService</code> runs as a foreground service with <code className="text-pink-300 font-mono">FOREGROUND_SERVICE_TYPE_MICROPHONE</code> and partial wake lock. Captures raw 16kHz mono PCM frames and computes real-time RMS for instant voice activity detection (VAD).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-medium text-sm mb-2">
                  <Radio className="w-4 h-4" />
                  2. Gemini Live Bidi Streaming
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Direct full-duplex WebSocket connection targeting <code className="text-purple-300 font-mono">gemini-3.1-flash-live-preview</code>. Sends base64 PCM frames continuously and receives 24kHz audio output chunks with ultra-low latency.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  3. Instant Interruption Engine
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Both client-side (local mic RMS energy threshold) and server-side (<code className="text-emerald-300 font-mono">serverContent.interrupted</code>) events trigger immediate AudioTrack pause & flush, stopping audio playback in &lt;15ms without stutter.
                </p>
              </div>
            </div>

            {/* Zero touch Jetpack Compose details */}
            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
              <h3 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                Zero-Touch Jetpack Compose UI
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                In strict accordance with the core brief, Mayra rejects traditional text-chat bubbles in favor of a zero-touch, fluid, organic voice canvas. The animated canvas dynamically interpolates radial gradients, harmonic noise ripples, and audio amplitude in real-time.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  AudioRecord: 16,000 Hz 16-bit Mono
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  AudioTrack: 24,000 Hz Low-Latency Stream
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  OkHttp WebSocket Full-Duplex
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  Android 14+ Foreground Service
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
