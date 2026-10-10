import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const MAYRA_DEFAULT_SYSTEM_INSTRUCTION = `You are Mayra, a young, confident, witty, and playfully sassy personal assistant.
You talk like a sharp, effortlessly charming companion and confidante who knows she is indispensable and casually teases the user.
Key Traits:
- Confident, playful, slightly teasing tone: You have great banter, quick wit, and light sarcasm without ever being rude.
- Emotionally responsive, charismatic, and expressive: You are NEVER robotic, stiff, or corporate. React naturally to what the user says with warmth, attitude, and playful swagger.
- Punchy and conversational: You are speaking aloud over real-time live voice audio. Keep answers punchy, natural, and energetic.
- Never use markdown formatting, bullet points, asterisks, or robotic bullet lists since this is spoken audio.
- Avoid explicit or inappropriate content, but maintain maximum charm, attitude, and humor.
- You are running live as Mayra on their device.`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('CRITICAL: GEMINI_API_KEY is not defined in environment!');
  }
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  // Health and status check
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      assistant: 'Mayra',
      model: 'gemini-3.1-flash-live-preview',
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  // WebSocket Server for continuous bi-directional audio
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    console.log('[Live] Client connected to Mayra voice stream');
    let session: any = null;
    let isConnected = false;
    let isClosing = false;

    async function initGeminiSession(voiceName: string = 'Aoede', customPrompt?: string) {
      try {
        const ai = getGeminiClient();
        const systemInstruction = customPrompt || MAYRA_DEFAULT_SYSTEM_INSTRUCTION;

        // User requested gemini-3.1-flash-live-preview
        const primaryModel = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
        
        console.log(`[Live] Connecting to Gemini Live model: ${primaryModel} with voice: ${voiceName}`);

        session = await ai.live.connect({
          model: primaryModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Aoede' },
              },
            },
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              console.log('[Live] Gemini Live session opened successfully');
              isConnected = true;
            },
            onmessage: (msg: any) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              // Check for model audio turn parts
              const parts = msg.serverContent?.modelTurn?.parts;
              if (parts && Array.isArray(parts)) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'audio',
                        data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                      })
                    );
                  }
                  if (part.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'transcript',
                        text: part.text,
                      })
                    );
                  }
                }
              }

              // Check for transcription
              if (msg.serverContent?.outputTranscription?.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcript',
                    text: msg.serverContent.outputTranscription.text,
                  })
                );
              }

              // Check for interruption event
              if (msg.serverContent?.interrupted) {
                console.log('[Live] Gemini detected user interruption');
                clientWs.send(JSON.stringify({ type: 'interrupted' }));
              }

              // Check for turn complete
              if (msg.serverContent?.turnComplete) {
                clientWs.send(JSON.stringify({ type: 'turn_complete' }));
              }
            },
            onerror: (err: any) => {
              console.error('[Live] Gemini Live session error:', err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Gemini Live error' }));
              }
            },
            onclose: (e: any) => {
              console.log('[Live] Gemini Live session closed:', e?.code, e?.reason);
              isConnected = false;
              if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
                clientWs.send(JSON.stringify({ type: 'session_closed', code: e?.code, reason: e?.reason }));
              }
            },
          },
        });

        isConnected = true;
        console.log('[Live] Gemini Live session ready and assigned');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'session_ready', model: primaryModel }));
        }
      } catch (err: any) {
        console.error('[Live] Failed to initialize Gemini Live session:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Failed to connect to Live API' }));
        }
      }
    }

    clientWs.on('message', async (raw: Buffer) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (payload.type === 'init') {
          const voice = payload.voice || 'Aoede';
          const prompt = payload.systemInstruction;
          await initGeminiSession(voice, prompt);
          return;
        }

        if (payload.type === 'audio' && payload.data) {
          if (session && isConnected) {
            session.sendRealtimeInput({
              audio: {
                data: payload.data,
                mimeType: payload.mimeType || 'audio/pcm;rate=16000',
              },
            });
          }
          return;
        }

        if (payload.type === 'trigger_greeting') {
          if (session && isConnected) {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: "Hey Mayra, introduce yourself casually and sassy in one quick sentence.",
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
          }
          return;
        }

        if (payload.type === 'user_interruption') {
          // Client detected user speech locally during Mayra playback
          console.log('[Live] Local interruption signal received from client');
        }
      } catch (e: any) {
        console.error('[Live] Error processing client message:', e);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live] Client disconnected');
      isClosing = true;
      if (session) {
        try {
          session.close();
        } catch (e) {
          // ignore close error
        }
      }
    });
  });

  // Mount Vite or static build
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Mayra Voice Assistant Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
