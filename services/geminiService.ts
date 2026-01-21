
import { GoogleGenAI, Type } from "@google/genai";
import { ModelType, AspectRatio, ImageSize } from "../types";
import { createContactSheet } from "../utils/imageUtils";

export const generateImage = async (
  prompt: string,
  model: ModelType,
  config: { aspectRatio: AspectRatio; imageSize: ImageSize },
  base64Image?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    let contents: any;
    if (base64Image) {
      const cleanPrompt = prompt.trim() || "Improve and enhance this image based on its content.";
      const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      contents = {
        parts: [
          { inlineData: { data: imageData, mimeType: 'image/png' } },
          { text: cleanPrompt }
        ]
      };
    } else {
      contents = prompt.trim() || "A beautiful creative artwork";
    }

    const generationConfig: any = {
      imageConfig: { aspectRatio: config.aspectRatio }
    };

    if (model === 'gemini-3-pro-image-preview') {
      generationConfig.imageConfig.imageSize = config.imageSize;
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: generationConfig
    });

    if (!response.candidates?.[0]) throw new Error("No response from AI.");

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data found.");
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_EXPIRED_OR_INVALID");
    throw error;
  }
};

/**
 * Uses Gemini Vision to analyze a Contact Sheet of frames and select the best ones.
 */
export const curateFrames = async (
  frames: { url: string; index: number }[],
  actionDescription: string
): Promise<{ index: number; tag: 'idle' | 'talking' | 'special' }[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // Create the Contact Sheet (Grid Image)
    const contactSheetBase64 = await createContactSheet(frames.map(f => f.url));
    const imageData = contactSheetBase64.split(',')[1];

    const prompt = `Task: Analyze this Contact Sheet of video frames (numbered by yellow index) to extract animation states.

TARGET ACTION: "${actionDescription}"

GOAL: Extract the 'special' sequence that represents the Target Action from start to finish.
The user wants to see the character transition from a normal state, perform the action, and return to normal.

STRICT INSTRUCTIONS:
1. "idle": Identify 3-5 frames where the character is absolutely static/neutral (eyes open, mouth closed).
2. "special": Identify the CONTIGUOUS RANGE of frames that form the Target Action.
   - For "blinking": You MUST find the frames where eyes are CLOSING, FULLY CLOSED, and OPENING.
   - If a frame looks exactly like an "idle" frame (eyes fully open), DO NOT tag it as "special", unless it is the very first/last frame of the transition sequence.
   - STRICT: If you see the pupil/iris clearly, it is NOT a closed eye.
   - Capture the arc: Normal -> [Start Closing -> Closed -> Opening] -> Normal. The part in brackets is 'special'.

3. "talking": Frames with distinct mouth movements.

OUTPUT:
Return a JSON array of objects with the frame "index" and its "tag".
Example: [{"index": 4, "tag": "special"}, {"index": 5, "tag": "special"}, ...]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: { 
        parts: [
          { inlineData: { data: imageData, mimeType: 'image/jpeg' } }, 
          { text: prompt }
        ] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              tag: { type: Type.STRING, enum: ["idle", "talking", "special"] }
            },
            required: ["index", "tag"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Curate Error:", error);
    return [];
  }
};
