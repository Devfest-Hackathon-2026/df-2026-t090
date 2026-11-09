import { GoogleGenAI } from "@google/genai";

const PROJECT_ID = "project-7f11774d-0f3a-4228-93f";
const LOCATION = "global";
export const GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Geminiクライアント（Vertex AI経由）を遅延初期化して返します。
 * APIキーは使用せず、Google Cloud環境のADC（Application Default Credentials）を使用します。
 */
export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION,
  });
}
