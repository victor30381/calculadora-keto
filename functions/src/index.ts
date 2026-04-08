import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");

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

export const optimizeDeliveryRoute = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { origin, destination, stops } = request.data;

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      throw new HttpsError("invalid-argument", "Se necesitan al menos 2 paradas para optimizar.");
    }

    if (!origin) {
      throw new HttpsError("invalid-argument", "Falta la dirección de origen.");
    }

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const stopsDescription = stops.map((s: any, i: number) => 
        `  Parada ${i + 1}: "${s.clientName}" en "${s.address}" (orderId: "${s.orderId}")`
      ).join("\n");

      const prompt = `Eres un experto en logística de entregas y optimización de rutas en Argentina.

Necesito que optimices el orden de las siguientes paradas de entrega para minimizar la distancia total recorrida y el tiempo de viaje.

PUNTO DE PARTIDA: "${origin}"
PUNTO FINAL: "${destination || origin}"

PARADAS A ORDENAR:
${stopsDescription}

INSTRUCCIONES:
1. Analiza las direcciones geográficamente
2. Determina el orden más eficiente considerando proximidad geográfica
3. Considera que las direcciones están en Argentina (probablemente Buenos Aires y alrededores)
4. Agrupa paradas que estén en la misma zona

Devuelve tu respuesta ÚNICAMENTE en este formato JSON exacto, sin texto adicional ni bloques de código markdown:
{
  "optimizedOrder": [
    { "orderId": "id_del_pedido", "clientName": "nombre", "address": "dirección" }
  ],
  "reasoning": "Explicación breve en español de por qué este orden es óptimo (máximo 2 oraciones)"
}

El array "optimizedOrder" debe contener TODAS las paradas en el nuevo orden optimizado. Usa los mismos orderId que te di.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const responseText = result.response.text();
      logger.info("Gemini route optimization response:", responseText);

      const parsed = JSON.parse(responseText);

      return {
        optimizedOrder: parsed.optimizedOrder || [],
        reasoning: parsed.reasoning || "Ruta optimizada.",
      };

    } catch (error) {
      logger.error("Error al optimizar ruta con Gemini", error);
      throw new HttpsError("internal", "No se pudo optimizar la ruta de entrega.");
    }
  }
);

// ═══════════════════════════════════════════════════════
// TELEGRAM NOTIFICATION ON NEW ORDER
// ═══════════════════════════════════════════════════════
export const notifyNewOrderTelegram = onDocumentCreated(
  {
    document: "orders/{orderId}",
    secrets: [telegramBotToken],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data in new order event");
      return;
    }

    const order = snapshot.data();
    const userId = order.userId;

    if (!userId) {
      logger.warn("Order has no userId, skipping notification");
      return;
    }

    try {
      // Get user profile to find Telegram Chat ID
      const profileDoc = await db.collection("userProfiles").doc(userId).get();

      if (!profileDoc.exists) {
        logger.info(`No profile found for user ${userId}, skipping Telegram notification`);
        return;
      }

      const profile = profileDoc.data();
      const chatId = profile?.telegramChatId;

      if (!chatId) {
        logger.info(`No Telegram Chat ID configured for user ${userId}, skipping`);
        return;
      }

      // Build a nice message
      const clientName = order.clientName || "Cliente sin nombre";
      const total = order.total || 0;
      const deposit = order.deposit || 0;
      const remaining = total - deposit;
      const source = order.source === "catalog" ? "🌐 Catálogo Web" : "📋 Panel Admin";
      const deliveryMethod = order.deliveryMethod === "delivery" ? "🚗 Envío" : "🏪 Retiro";
      const itemCount = order.items?.length || 0;

      // Format delivery date
      let deliveryDateStr = "No especificada";
      if (order.deliveryDate) {
        const d = order.deliveryDate.toDate ? order.deliveryDate.toDate() : new Date(order.deliveryDate);
        deliveryDateStr = d.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
      }

      // Build items list
      let itemsList = "";
      if (order.items && Array.isArray(order.items)) {
        itemsList = order.items
          .map((item: any) => `   • ${item.name} x${item.quantity}`)
          .join("\n");
      }

      // Build message parts, filter empty lines
      const messageParts: string[] = [
        `🛒 *¡NUEVO PEDIDO!*`,
        ``,
        `👤 *Cliente:* ${escapeMarkdown(clientName)}`,
      ];
      if (order.clientPhone) messageParts.push(`📱 Tel: ${escapeMarkdown(order.clientPhone)}`);
      if (order.clientAddress) messageParts.push(`📍 ${escapeMarkdown(order.clientAddress)}`);
      messageParts.push(``);
      messageParts.push(`📦 *Detalle (${itemCount} producto${itemCount !== 1 ? "s" : ""}):*`);
      if (itemsList) messageParts.push(itemsList);
      messageParts.push(``);
      messageParts.push(`💰 *Total: $${total.toLocaleString("es-AR")}*`);
      if (deposit > 0) {
        messageParts.push(`✅ Seña: $${deposit.toLocaleString("es-AR")}`);
        messageParts.push(`💵 Resta: $${remaining.toLocaleString("es-AR")}`);
      }
      messageParts.push(`📅 *Entrega:* ${escapeMarkdown(deliveryDateStr)}${order.deliveryTime ? ` a las ${escapeMarkdown(order.deliveryTime)}` : ""}`);
      messageParts.push(`${deliveryMethod} | ${source}`);
      if (order.clientNotes) messageParts.push(`\n📝 _${escapeMarkdown(order.clientNotes)}_`);

      const message = messageParts.join("\n");

      // Send via Telegram Bot API
      const token = telegramBotToken.value();
      const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        logger.error("Telegram API error:", result);
      } else {
        logger.info(`Telegram notification sent successfully to chat ${chatId}`);
      }
    } catch (error) {
      logger.error("Error sending Telegram notification:", error);
      // Don't throw - we don't want to fail order creation because of notification errors
    }
  }
);

// Helper to escape special Markdown v1 characters for Telegram
// In Markdown v1, only _ * ` [ need escaping
function escapeMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[");
}

// ═══════════════════════════════════════════════════════
// TEST TELEGRAM NOTIFICATION (callable from the app)
// ═══════════════════════════════════════════════════════
export const testTelegramNotification = onCall(
  {
    secrets: [telegramBotToken],
    cors: true,
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { chatId } = request.data;
    if (!chatId) {
      throw new HttpsError("invalid-argument", "Falta el Chat ID de Telegram.");
    }

    try {
      const token = telegramBotToken.value();
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      const message = `✅ *¡Conexión exitosa!*

Tu panel de *Alternativa Keto* está conectado correctamente.

A partir de ahora vas a recibir una notificación acá cada vez que entre un pedido nuevo. 🎉`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        logger.error("Telegram test error:", result);
        throw new HttpsError("internal", `Error de Telegram: ${result.description || "Error desconocido"}`);
      }

      logger.info(`Test notification sent successfully to chat ${chatId}`);
      return { success: true, message: "Notificación de prueba enviada correctamente." };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error sending test Telegram notification:", error);
      throw new HttpsError("internal", "No se pudo enviar la notificación de prueba.");
    }
  }
);
