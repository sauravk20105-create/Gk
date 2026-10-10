export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';

export interface PersonaConfig {
  voiceName: 'Aoede' | 'Kore' | 'Zephyr' | 'Puck';
  sassLevel: number; // 1 to 5
  confidence: string;
  name: string;
  backgroundServiceActive: boolean;
  hapticFeedback: boolean;
  micSensitivity: number;
}

export interface AndroidCodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
  category: 'Service' | 'UI' | 'Network' | 'Audio' | 'Config';
}
