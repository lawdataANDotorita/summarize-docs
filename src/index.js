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

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
	async fetch(request, env, ctx) {

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		// Check if the request body is empty
		var oInputs={text:""};
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) >0) {
			oInputs = !!request ? await request.json() : {text:""};
		}

		const oOpenAi = new OpenAI({
			apiKey:env.OPENAI_API_KEY,
			baseURL:"https://gateway.ai.cloudflare.com/v1/1719b913db6cbf5b9e3267b924244e58/query_db_gateway/openai"
		});

		const messagesForOpenAI = [
			{ role: 'system', content: "json  אתה תקבל מסמכים משפטיים ואתה צריך, בתור מומחה משפטי, לכתוב חוות דעת שמורכבת משלושה חלקים בפורמט ג'ייסון. החלקים הם: תמצית, תחומים והכרעה. המיפוי בגייסון הוא כדלהלן: תמצית - summary, תחומים - areas, הכרעה - resolution בחלק התמצית עליך  לכתוב תמצית של המסמך בסך של עד 200  מילים. התמצית צריכה לכלול מספר חלקים: א. המחלוקת. ב.ב טענות התביעה. ג. טענות ההגנה. ד. פסיקת השופט והסיבות לפסיקה הזו. התוצאה צריכה להיות בלי כותרת כמו 'תמצית...' החלקים השונים צריכים להיות עם כותרת החלק, למשל 'מחלוקת', 'טענות ההגנה' וכ\"ו. עם  שתי נקודות ובלי כל מיני קשקושים כמו ** תוחמים בחלק התחומים עליך לכתוב עד עשרה תחומים משפטיים שקשורים לפסק הדין, מופרדים בפסיק. בחלק ההכרעה אתה צריך לכתוב אחד משלושה ערכים: פשרה, זיכוי, הרשעה" },
			{ role: 'user', content: oInputs.text }
		];
		const chatCompletion = await oOpenAi.chat.completions.create({
			model: 'gpt-4o-mini',
			messages:messagesForOpenAI,
			temperature: 0,
			presence_penalty: 0,
			frequency_penalty: 0,
			response_format:{
				"type":"json_object"
			}
		})

		return new Response(JSON.stringify(chatCompletion.choices[0].message.content),{headers:corsHeaders});
	},
};
