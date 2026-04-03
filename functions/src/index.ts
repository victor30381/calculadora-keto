import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const generateNutrition = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { recipeName, ingredientsText } = request.data;

    if (!recipeName || !ingredientsText) {
      throw new HttpsError("invalid-argument", "Falta el nombre o los ingredientes de la receta.");
    }

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Analiza la siguiente receta y proporciona la información nutricional total estimada aproximada (el TOTAL de toda la receta suma de todos los ingredientes).

Nombre de la receta: ${recipeName}
Ingredientes:
${ingredientsText}

Devuelve los resultados ÚNICAMENTE en este formato JSON exacto, sin texto adicional ni bloques de código markdown:
{
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0
}
Los valores numéricos deben representar gramos (excepto calorías que es Kcal). Si hay un error devuelve 0 en todos los campos.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.response.text();
      logger.info("Gemini raw response:", responseText);

      const parsedJSON = JSON.parse(responseText);
      
      return {
        calories: Number(parsedJSON.calories) || 0,
        protein: Number(parsedJSON.protein) || 0,
        carbs: Number(parsedJSON.carbs) || 0,
        fat: Number(parsedJSON.fat) || 0,
        fiber: Number(parsedJSON.fiber) || 0,
      };

    } catch (error) {
      logger.error("Error al utilizar Gemini API", error);
      throw new HttpsError("internal", "No se pudo generar la información nutricional.");
    }
  }
);

export const generateDescription = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { recipeName, ingredientsText, imageUrls } = request.data;
    if (!recipeName) {
      throw new HttpsError("invalid-argument", "Falta el nombre de la receta.");
    }
    
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const parts: any[] = [];
      const prompt = `Actúa como un experto copywriter gastronómico para 'Alternativa Keto', una pastelería saludable sin azúcar y low-carb.
Escribe una breve y atractiva descripción para el catálogo de clientes sobre este producto:
Nombre: ${recipeName}
${ingredientsText ? `Ingredientes principales: \n${ingredientsText}` : ''}

La descripción DEBE cumplir esto rígidamente:
- Tener un tono casual, cercano y amigable.
- Utilizar un lenguaje sencillo, sin palabras complejas o rimbombantes.
- No tener más de 40-50 palabras en total.
- Ser muy apetitosa y destacar que es un producto premium.
- Resaltar que es saludable (keto, sin azúcar, bajo en carbohidratos).
- Mencionar sutilmente lo visual si proporciono una foto (ej. "Irresistible cubierta...", "Textura húmeda...").
- Usar como máximo 2 emojis adecuados.
- NUNCA devuelvas comillas rodeando todo el texto.

Devuelve SOLO el texto.`;

      parts.push({ text: prompt });

      if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
        for (const url of imageUrls) {
          try {
            const imageResp = await fetch(url);
            const arrayBuffer = await imageResp.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = imageResp.headers.get('content-type') || 'image/jpeg';
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType
              }
            });
          } catch(e) {
            logger.warn("No se pudo cargar la imagen:", url);
          }
        }
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
      });

      return { description: result.response.text() };

    } catch (error) {
      logger.error("Error al utilizar Gemini API para descripcion", error);
      throw new HttpsError("internal", "No se pudo generar la descripción.");
    }
  }
);
