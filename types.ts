
export type ModelType = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
export type ImageSize = '1K' | '2K' | '4K';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: ModelType | 'manual-slice' | 'animation-frame' | 'video-frame';
  timestamp: number;
  isSlice?: boolean;
  tag?: 'idle' | 'talking';
}

export interface CharacterAction {
  name: string;
  frames: string[];
}

export interface SceneConfig {
  charPosition: { x: number; y: number };
  charScale: number;
  bgPosition: { x: number; y: number };
  bgScale: number;
  // New persistence fields
  backgroundImage?: string | null;
  bgMusicData?: string | null; // Base64 audio
  bgMusicName?: string | null;
}

export interface Character {
  id: string;
  name: string;
  actions: CharacterAction[]; // Flexible list of actions (e.g., "Angry", "Happy", "Blinking")
  defaultIdleAction?: string;
  defaultTalkingAction?: string;
  sceneConfig?: SceneConfig;
}

export interface VideoState {
  id: string;
  name: string; // ex: "Piscar Olhos", "Falar Entusiasmado"
  videoFile: File | null;
  videoPreview: string | null;
  frames: { url: string; tag?: 'idle' | 'talking' | 'special' }[];
  actionIntent: string;
  isProcessing: boolean;
  isCurating: boolean;
  progress: number;
}

export interface SpriteAnimation {
  id: string;
  frames: string[];
  fps: number;
  timestamp: number;
  originalName: string;
}

export interface GenerationConfig {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}
