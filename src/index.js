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
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		let oInputs = { text: "" };
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 0) {
			oInputs = await request.json();
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
את חלק התחומים השאר ריק

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

					let additionalText = "";

					try {
						response = await oOpenAi.embeddings.create({
						model: "text-embedding-3-large",
						input: summary,
						dimensions: 1536,
					  });
					  let oVector = response.data[0].embedding;

					  const privateKey = env.SUPABASE_API_KEY;
					  if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
					  const url = env.SUPABASE_URL;
			  
					  if (!url) throw new Error(`Expected env var SUPABASE_URL`);
					  const supabase = createClient(url, privateKey);

					  

					const { data,error } = await supabase.rpc('match_documents_test', {
							query_embedding: oVector,
							match_threshold: 0.5,
							match_count: 10,
					});
			
					if (data) {
						additionalText = data.map(item => item.content).join('<br>')
					}
					else {
						additionalText = "didn't find any subjects ";
					}
			
				  } 
				  catch (error) {
					  additionalText = "Error generating embedding. error is "+error;
				  }
		  
					controller.enqueue(encoder.encode(additionalText));
					
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
