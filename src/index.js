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
			{ role: 'system', content: "אתה עורך דין מומחה לענייני משפט. בשאלה הבאה אני הולך לספק לך מסמך משפטי ואתה צריך לסכם אותו בטקסט שאורכו עד 100 מילה ושתופס את התמצית של המסמך המשפטי"},
			{ role: 'user', content: oInputs.text }
		];
		const chatCompletion = await oOpenAi.chat.completions.create({
			model: 'gpt-4o',
			messages:messagesForOpenAI,
			temperature: 1.1,
			presence_penalty: 0,
			frequency_penalty: 0
		})

		const oResponse={
			summary:chatCompletion.choices[0].message.content
		}

		return new Response(JSON.stringify(oResponse),{headers:corsHeaders});
	},
};
