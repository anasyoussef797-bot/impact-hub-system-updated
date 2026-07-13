import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Parse JSON bodies
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Route to securely create a Daily.co room using our API key
app.post('/api/create-daily-room', async (req, res) => {
  try {
    const apiKey = process.env.DAILY_CO_API_KEY || '023158a9157dfeb9a9b37c3766761c48e294800e1693a34be95c67960f3fcda1';
    
    // Call Daily.co API to create a room
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.round(Date.now() / 1000) + 86400 // Expire in 24 hours
        }
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      console.error('Daily.co API error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to create room in Daily.co' });
    }
    
    res.json({
      url: data.url,
      name: data.name
    });
  } catch (error) {
    console.error('Error in /api/create-daily-room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route handlers for SPA-like navigation or direct access
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server running on http://0.0.0.0:${PORT}`);
});
