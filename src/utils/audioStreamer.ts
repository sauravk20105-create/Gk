/**
 * Real-time bidirectional Web Audio streaming engine for Gemini Live API.
 * Handles 16kHz PCM capture, 24kHz PCM playback, scheduling, and instant interruption.
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;

  private isRecording = false;
  private isSpeaking = false;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  
  // Callbacks
  public onInputVolume: ((vol: number) => void) | null = null;
  public onOutputVolume: ((vol: number) => void) | null = null;
  public onAudioData: ((base64Pcm: string) => void) | null = null;
  public onInterrupted: (() => void) | null = null;
  public onSpeechStateChange: ((state: 'idle' | 'listening' | 'speaking') => void) | null = null;

  // Interruption sensitivity
  public interruptionSensitivity = 0.04;
  private speakingTimeout: any = null;

  constructor() {}

  /**
   * Initializes both input (16kHz) and output (24kHz) AudioContexts.
   */
  public async start(): Promise<void> {
    if (this.isRecording) return;

    // Output AudioContext (24kHz for Gemini Live audio responses)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
    }

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 128;
    this.outputAnalyser.connect(this.outputAudioCtx.destination);

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    // Input AudioContext (16kHz for Gemini input)
    try {
      this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
    } catch {
      this.inputAudioCtx = new AudioContextClass();
    }
    if (this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume();
    }

    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 128;

    this.inputSource = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.inputSource.connect(this.inputAnalyser);

    // Buffer size 2048 or 4096 gives ~128ms - 256ms chunk latency
    const bufferSize = 2048;
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const inputData = event.inputBuffer.getChannelData(0);

      // Measure volume (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const volume = Math.min(1, rms * 4);
      if (this.onInputVolume) {
        this.onInputVolume(volume);
      }

      // Local interruption detection:
      // If user speaks while Mayra is speaking, interrupt immediately!
      if (this.isSpeaking && rms > this.interruptionSensitivity) {
        console.log('[AudioStreamer] User speech detected during assistant playback -> Triggering interruption');
        this.stopPlaybackAndClearQueue();
        if (this.onInterrupted) {
          this.onInterrupted();
        }
      }

      // Downsample/Resample if input context rate is not 16000
      const currentRate = this.inputAudioCtx ? this.inputAudioCtx.sampleRate : 16000;
      const resampled = this.resampleTo16k(inputData, currentRate);

      // Convert Float32 to 16-bit PCM Little-Endian
      const base64 = this.floatTo16BitPCMBase64(resampled);
      if (this.onAudioData) {
        this.onAudioData(base64);
      }
    };

    this.inputSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioCtx.destination);

    this.isRecording = true;
    this.startVolumeMonitoringLoop();
  }

  /**
   * Resamples Float32 audio buffer to 16kHz
   */
  private resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
    if (fromRate === 16000) return input;
    const ratio = fromRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const indexFloor = Math.floor(originalIndex);
      const indexCeil = Math.min(input.length - 1, indexFloor + 1);
      const fraction = originalIndex - indexFloor;
      result[i] = input[indexFloor] * (1 - fraction) + input[indexCeil] * fraction;
    }
    return result;
  }

  /**
   * Converts Float32 [-1.0, 1.0] to Base64 Int16 Little-Endian PCM
   */
  private floatTo16BitPCMBase64(input: Float32Array): string {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, int16, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Enqueues and schedules 24kHz PCM audio chunk from Gemini Live
   */
  public enqueueAudioChunk(base64Pcm: string): void {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') return;

    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM to Float32
      const dataView = new DataView(bytes.buffer);
      const numSamples = Math.floor(len / 2);
      const float32 = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32[i] = int16 / 32768.0;
      }

      // Create AudioBuffer at 24000 Hz
      const audioBuffer = this.outputAudioCtx.createBuffer(1, numSamples, 24000);
      audioBuffer.copyToChannel(float32, 0);

      // Create BufferSourceNode
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;

      if (this.outputAnalyser) {
        source.connect(this.outputAnalyser);
      } else {
        source.connect(this.outputAudioCtx.destination);
      }

      // Schedule playback smoothly
      const now = this.outputAudioCtx.currentTime;
      // Allow a small 20ms lead time if playback fell behind
      const startTime = Math.max(now + 0.015, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);
      this.isSpeaking = true;
      if (this.onSpeechStateChange) {
        this.onSpeechStateChange('speaking');
      }

      if (this.speakingTimeout) {
        clearTimeout(this.speakingTimeout);
      }

      const durationMs = (this.nextPlayTime - now) * 1000;
      this.speakingTimeout = setTimeout(() => {
        if (this.activeSources.length === 0) {
          this.isSpeaking = false;
          if (this.onSpeechStateChange) {
            this.onSpeechStateChange('listening');
          }
        }
      }, Math.max(100, durationMs + 80));

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0) {
          this.isSpeaking = false;
          if (this.onSpeechStateChange) {
            this.onSpeechStateChange('listening');
          }
        }
      };
    } catch (err) {
      console.error('[AudioStreamer] Error decoding audio chunk:', err);
    }
  }

  /**
   * Immediately stops all currently playing and queued audio sources
   */
  public stopPlaybackAndClearQueue(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore already stopped
      }
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
    this.isSpeaking = false;
    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
      this.speakingTimeout = null;
    }
    if (this.onSpeechStateChange) {
      this.onSpeechStateChange('listening');
    }
  }

  /**
   * Monitor output volume for visualizer
   */
  private startVolumeMonitoringLoop(): void {
    const dataArray = new Uint8Array(64);

    const update = () => {
      if (!this.isRecording) return;

      if (this.outputAnalyser && this.isSpeaking) {
        this.outputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 120);
        if (this.onOutputVolume) {
          this.onOutputVolume(normalized);
        }
      } else {
        if (this.onOutputVolume) {
          this.onOutputVolume(0);
        }
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }

  /**
   * Stops recording and tears down audio contexts
   */
  public stop(): void {
    this.isRecording = false;
    this.stopPlaybackAndClearQueue();

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }
}
