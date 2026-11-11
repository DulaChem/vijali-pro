import { Redis } from '@upstash/redis';
const kv = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body;

  try {
    // 1. Upstash Database එකෙන් යූසර්ව හොයනවා
    const user = await kv.get(`user:${username}`);

    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    if (user.password !== password) return res.status(401).json({ error: 'Invalid username or password.' });

    // 2. සාර්ථක වුනාම යූසර් විස්තර එවනවා
    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        packageType: user.packageType,
        remainingDays: user.packageDays,
        queriesLeft: user.queriesLeft
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
