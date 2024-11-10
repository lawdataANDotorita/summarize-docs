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
		var sPrompt = "json ";
		sPrompt+="אתה תקבל מסמכים משפטיים ואתה צריך, בתור מומחה משפטי, לכתוב חוות דעת שמורכבת משני חלקים בפורמט ג'ייסון";
		sPrompt+="החלקים הם תמצית ותחומים. המיפוי לג'ייסון הוא כדלהלן: תמצית - summary, תחומים - areas";
		sPrompt+="בחלק התמצית עליך לכתוב תמצית של המסמך, עד 400 מילים, תוך שימוש במונחים משפטיים. התמצית צריכה לכלול 4 חלקים: ";
		sPrompt+="1. first - תיאור העניין המשפטי של המסמך";
		sPrompt+="2. second - תיאור העובדות המרכזיות של המסמך";
		sPrompt+="3. third - תיאור הטענות המרכזיות של המסמך";
		sPrompt+="4. fourth - החלטת השופט והסיבות שהובילו אותו להחלטה זו. אנא השתמש במונחים משפטיים";
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
