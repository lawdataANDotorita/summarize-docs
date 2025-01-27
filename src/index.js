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
	'Access-Control-Allow-Headers': 'Content-Type',
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive'
};

export default {
	async fetch(request, env, ctx) {

		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		// Check if the request body is empty
		var oInputs={text:""};

/*
		var sPrompt = "json ";
		sPrompt+="אתה תקבל מסמכים משפטיים ואתה צריך, בתור מומחה משפטי, לכתוב חוות דעת שמורכבת משני חלקים בפורמט ג'ייסון";
		sPrompt+="החלקים הם תמצית ותחומים. המיפוי לג'ייסון הוא כדלהלן: תמצית - summary, תחומים - areas";
		sPrompt+="בחלק התמצית עליך לכתוב תמצית של המסמך, עד 400 מילים, תוך שימוש במונחים משפטיים. התמצית צריכה לכלול 4 חלקים: ";
		sPrompt+="1. first - תיאור העניין המשפטי של המסמך";
		sPrompt+="2. second - תיאור העובדות המרכזיות של המסמך";
		sPrompt+="3. third - תיאור הטענות המרכזיות של המסמך";
		sPrompt+="4. fourth - החלטת השופט והסיבות שהובילו אותו להחלטה זו. אנא השתמש במונחים משפטיים";
		sPrompt+="בחלק התחומים עליך לכתוב את התחומים המשפטיים שקשורם למסמך, עד עשרה תחומים ועם פסיק שמפריד ביניהם";
*/
		var sPrompt = "";
		sPrompt+="אתה תקבל מסמכים משפטיים ואתה צריך, בתור מומחה משפטי, לכתוב חוות דעת שמורכבת משני חלקים.";
		sPrompt+="אנא כתוב את הטקסט בלבד בלי הוספה של כל מיני קישוטים כמו ### וכדומה.";
		sPrompt+="החלקים הם תמצית ותחומים.";
		sPrompt+="הכותרות צריכות להיות *1*תמצית*1* ו *1*תחומים*1*"
		sPrompt+="בחלק התמצית עליך לכתוב תמצית של המסמך, עד 400 מילים, תוך שימוש במונחים משפטיים. התמצית צריכה לכלול 4 חלקים: ";
		sPrompt+="1. תיאור העניין המשפטי של המסמך. הכותרת היא *2*עניין משפטי*2*";
		sPrompt+="2. תיאור העובדות המרכזיות של המסמך. הכותרת היא *2*עובדות מרכזיות*2*";
		sPrompt+="3. תיאור הטענות המרכזיות של המסמך. הכותרת היא *2*טענות מרכזיות*2*";
		sPrompt+="4. החלטת השופט והסיבות שהובילו אותו להחלטה זו. הכותרת היא *2*החלטה וסיבות*2*. אנא השתמש במונחים משפטיים";
		sPrompt+="בחלק התחומים עליך לכתוב את התחומים המשפטיים שקשורם למסמך, עד עשרה תחומים ועם פסיק שמפריד ביניהם";


		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) >0) {
			oInputs = !!request ? await request.json() : {text:""};
		}

		const oOpenAi = new OpenAI({
			apiKey:env.OPENAI_API_KEY,
			baseURL:"https://gateway.ai.cloudflare.com/v1/1719b913db6cbf5b9e3267b924244e58/summarize-docs/openai"
		});

		const messagesForOpenAI = [
			{ role: 'system', content: sPrompt },
			{ role: 'user', content: oInputs.text }
		];
		const stream = new ReadableStream({
			async start(controller) {
			  const encoder = new TextEncoder();
			  try {
				// Call OpenAI with stream:true.
				const chatCompletion = await oOpenAi.chat.completions.create({
				  model: "gpt-4o-mini",
				  messages: messagesForOpenAI,
				  temperature: 0,
				  presence_penalty: 0,
				  frequency_penalty: 0,
				  stream: true
				});
	  
	  
				// for await...of will yield each streamed chunk.
				for await (const chunk of chatCompletion) {
					const content = chunk?.choices?.[0]?.delta?.content || '';
					controller.enqueue(encoder.encode(content));
				}
				controller.close();
			  } catch (error) {
				// If there's an error, report it and signal failure.
				console.error("Error during OpenAI streaming:", error);
				controller.error(error);
			  }
			}
		});
		return new Response(stream, {
			headers: corsHeaders
		});
	},
};
