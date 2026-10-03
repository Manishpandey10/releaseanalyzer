import "./src/lib/config.js";
import { GoogleGenAI } from "@google/genai";
import { config } from "./src/lib/config.js";

async function listModels() {
  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const response = await ai.models.list();
    
    // Wait, the API for listing models in @google/genai is usually ai.models.listModels() or ai.models.list()
    // Let's print out all model names that contain 'gemini'
    for await (const model of response) {
      if (model.name.includes("gemini")) {
        console.log(model.name);
      }
    }
  } catch (err) {
    console.error("Error listing models:", err);
  }
}

listModels();
