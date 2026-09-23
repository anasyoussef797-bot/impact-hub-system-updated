export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { roomName } = req.body || {};
    if (roomName) {
      const apiKey = process.env.DAILY_CO_API_KEY || '023158a9157dfeb9a9b37c3766761c48e294800e1693a34be95c67960f3fcda1';
      try {
        await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      } catch (err) {
        console.warn('Daily room cleanup notice:', err.message);
      }
    }
    res.status(200).json({ success: true, message: 'Network meeting closed successfully' });
  } catch (error) {
    console.error('Error in end-network-meeting handler:', error);
    res.status(500).json({ error: error.message });
  }
}
