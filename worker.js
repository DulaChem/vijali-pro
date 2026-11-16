import { Redis } from '@upstash/redis';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- API: LOGIN ---
    if (url.pathname === '/api/login') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
      try {
        const { username, password } = await request.json();
        const kv = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
        
        const user = await kv.get(`user:${username}`);
        if (!user) return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
        if (user.password !== password) return Response.json({ error: 'Invalid username or password.' }, { status: 401 });

        return Response.json({
          success: true,
          user: {
            username: user.username,
            packageType: user.packageType,
            remainingDays: user.packageDays,
            queriesLeft: user.queriesLeft
          }
        });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // --- API: CHAT ---
    if (url.pathname === '/api/chat') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
      try {
        const { question, username } = await request.json();
        const kv = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });

        const user = await kv.get(`user:${username}`);
        if (!user) return Response.json({ error: 'User not found.' }, { status: 401 });
        if (user.queriesLeft !== 'Unlimited' && user.queriesLeft <= 0) {
          return Response.json({ error: 'Query limit reached.' }, { status: 403 });
        }

        const API_KEY = env.GEMINI_API_KEY;
        const MODEL = "gemini-3.8-flash";
        const SYSTEM_PROMPT = `You are the official DulaChem Engineering & Consultancy Technical Advisory System... (ඔබේ සම්පූර්ණ Instructions ටික මෙතනට paste කරන්න)`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ parts: [{ text: question }] }]
            })
          }
        );

        const data = await response.json();
        if (data.error) return Response.json({ error: 'Gemini API Error: ' + data.error.message }, { status: 500 });

        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer generated.";

        let newQueriesLeft = user.queriesLeft;
        if (newQueriesLeft !== 'Unlimited') {
          newQueriesLeft -= 1;
          user.queriesLeft = newQueriesLeft;
          await kv.set(`user:${username}`, user);
        }

        return Response.json({ answer: answer, remainingQueries: newQueriesLeft });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // --- STATIC FILES (index.html) ---
    return env.ASSETS.fetch(request);
  }
};
