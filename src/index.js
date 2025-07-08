/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = [
	'https://lawdata.co.il',
	'https://www.lawdata.co.il',
];

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive'
};

function isOriginAllowed(origin) {
	if (!origin) return false;
	return ALLOWED_ORIGINS.includes(origin);
}

export default {
	async fetch(request, env, ctx) {
		// Check origin for ALL requests including OPTIONS
		const origin = request.headers.get('Origin');
		const referer = request.headers.get('Referer');
		
		// Check Origin header first (more reliable)
		if (origin) {
			if (!isOriginAllowed(origin)) {
				return new Response('Forbidden: Invalid origin', { 
					status: 403,
					headers: { 'Content-Type': 'text/plain' }
				});
			}
		}
		// Fallback to Referer header if Origin is not present
		else if (referer) {
			try {
				const refererUrl = new URL(referer);
				const refererOrigin = `${refererUrl.protocol}//${refererUrl.hostname}`;
				if (!isOriginAllowed(refererOrigin)) {
					return new Response('Forbidden: Invalid referer', { 
						status: 403,
						headers: { 'Content-Type': 'text/plain' }
					});
				}
			} catch (e) {
				return new Response('Forbidden: Invalid referer format', { 
					status: 403,
					headers: { 'Content-Type': 'text/plain' }
				});
			}
		}
		// No origin or referer header
		else {
			return new Response('Forbidden: No origin or referer header', { 
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		if (request.method === 'OPTIONS') {
			return new Response(null, { 
				headers: {
					...corsHeaders,
					'Access-Control-Allow-Origin': origin || referer ? `${new URL(referer).protocol}//${new URL(referer).hostname}` : ALLOWED_ORIGINS[0]
				}
			});
		}

		let oInputs = { text: "" };
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 0) {
			oInputs = await request.json();
		}

		const sAIToken = oInputs.aiToken;
		
		// Check if token exists
		if (!sAIToken) {
			return new Response('Error: Missing AI token', { 
				status: 400,
				headers: { 
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': actualOrigin
				}
			});
		}

		try {
			const tokenValidationResponse = await fetch(`https://www.lawdata.co.il/isAITokenValid.asp?aiToken=${sAIToken}`);
			const tokenValidationResult = await tokenValidationResponse.text();
			
			if (tokenValidationResult.trim() === '0') {
				return new Response('Error: Cannot make AI requests - invalid token', { 
					status: 403,
					headers: { 
						'Content-Type': 'text/plain',
						'Access-Control-Allow-Origin': actualOrigin
					}
				});
			} else if (tokenValidationResult.trim() !== '1') {
				return new Response('Error: Invalid token validation response', { 
					status: 500,
					headers: { 
						'Content-Type': 'text/plain',
						'Access-Control-Allow-Origin': actualOrigin
					}
				});
			}
		} catch (error) {
			return new Response('Error: Failed to validate AI token', { 
				status: 500,
				headers: { 
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': actualOrigin
				}
			});
		}

		const sPrompt = `

אתה תקבל מסמכים משפטיים ואתה צריך, בתור מומחה משפטי, לכתוב חוות דעת שמורכבת משני חלקים.
אנא כתוב את הטקסט בלבד בלי הוספה של כל מיני קישוטים כמו ### וכדומה.
החלקים הם תמצית ותחומים.
הכותרות צריכות להיות *1*תמצית*1* ו *1*תחומים*1*
בחלק התמצית עליך לכתוב תמצית של המסמך, עד 400 מילים, תוך שימוש במונחים משפטיים. התמצית צריכה לכלול 4 חלקים:

1. תיאור העניין המשפטי של המסמך. הכותרת היא *2*מהות ההליך*2*
2. תיאור העובדות המרכזיות של המסמך. הכותרת היא *2*עובדות מרכזיות*2*
3. תיאור הטענות המרכזיות של המסמך. הכותרת היא *2*טענות מרכזיות*2*
4. החלטת השופט והסיבות שהובילו אותו להחלטה זו. הכותרת היא *2*החלטה שיפוטית*2*. אנא השתמש במונחים משפטיים
   בחלק התחומים עליך לבחור 20 שורות של תחומים, כל שורה מכילה שלושה אלמנטים:
5. תחום עיקרי
6. תת תחום
7. תת תת תחום
   הפורמט צריך להיות בשורה אחת כלהלן:
   תחום > תת תחום > תת תת תחום
   בסיום ובתחילת כל שורה צרף את המחרוזת : *3*

למשל:
נזיקין > נזק ראייתי > נטל ההוכחה
תקשורת > רשות השידור > תחולת כללי משפט מנהלי
אגודות שיתופיות > בוררות > ביטול פסק חריגה מסמכות
נא השתמש בתחום עיקרי מתוך רשימה זו בלבד
אגודות שיתופיות
איכות הסביבה
אינטרנט
אפוטרופסות
אשפוז כפוי
אתיקה ועורכי דין
בוררות
ביזיון ביהמ"ש
ביטוח
ביטוח לאומי
בנקאות
בריאות
גישור
דיבידנד
דין משמעתי
דיני משפחה
הגבלים עסקיים
הגנת הדייר
הגנת הפרטיות
הוצאה לפועל
השבת אבידה
התיישנות
זכויות החולה
חברות
חדלות פרעון
חוזים
חוזים אחידים
חופש הביטוי
חופש הדת
חופש המידע
חופש העיסוק
חוקתי
חיובים
חינוך
ירושה
כבוד האדם וחירותו
כינוס נכסים
כרטיסי חיוב
כשרות משפטית
לשון הרע
מחשבים
מיסים
מכר
מכר דירות
מכרזים
מנהלי
מעמד אישי
מקרקעין
משפט בינ"ל
משפט רפואי
מתנה
נאמנות
נזיקין
ני"ע
סדר דין אזרחי
סדר דין פלילי
סימני מסחר
סעד הצהרתי
סעדים זמניים
עבודה
עוולות מסחריות
עונשין
עמותות
ערבות
עשיית עושר
פלילי
פשיטת רגל
צבאי
צער בעלי חיים
צרכנות
קנין רוחני
קצין תגמולים
ראיות
רדיפות הנאצים
רואי חשבון
רישוי עסקים
רשויות מקומיות
רשם הפטנטים
שוויון זכויות לאנשים עם מוגבלות
שותפויות
שטרות
שיעבודים
שליחות
תאגידים
תביעה יצוגית
תכנון ובניה
תעבורה
תקשורת

			המסמך הוא:
			${oInputs.text}
		`;

		const oOpenAi = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
			baseURL: "https://gateway.ai.cloudflare.com/v1/1719b913db6cbf5b9e3267b924244e58/summarize-docs/openai"
		});

		const messagesForOpenAI = [
			{ role: 'system', content: sPrompt.trim() },
			{ role: 'user', content: oInputs.text }
		];
		const bufferThreshold = 10;
		let buffer = "";
		let summary = "";
		let response;
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					const chatCompletion = await oOpenAi.chat.completions.create({
						model: "gpt-4.1-mini",
						messages: messagesForOpenAI,
						temperature: 0,
						presence_penalty: 0,
						frequency_penalty: 0,
						stream: true
					});

					for await (const chunk of chatCompletion) {
						const content = chunk?.choices?.[0]?.delta?.content || '';
						summary += content;
						buffer += content;
						if (buffer.length >= bufferThreshold) {
							controller.enqueue(encoder.encode(buffer));
							buffer = '';
						}
					}
					if (buffer.length > 0) {
						controller.enqueue(encoder.encode(buffer));
					}
					controller.close();
				} catch (error) {
					console.error("Error during OpenAI streaming:", error);
					controller.error(error);
				}
			}
		});

		return new Response(stream, { headers: corsHeaders });
	}
};
