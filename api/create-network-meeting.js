export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const apiKey = process.env.DAILY_CO_API_KEY || '023158a9157dfeb9a9b37c3766761c48e294800e1693a34be95c67960f3fcda1';
    const roomName = `network-meeting-${Date.now()}`;
    
    let roomUrl = '';
    let guestUrl = '';
    let hostUrl = '';
    let ownerToken = '';

    try {
      // 1. Create Daily.co Room for the network meeting
      const createRoomRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
            exp: Math.round(Date.now() / 1000) + 86400 // 24 hours
          }
        })
      });

      const roomData = await createRoomRes.json();

      if (createRoomRes.ok && roomData.url) {
        roomUrl = roomData.url;
        guestUrl = roomData.url;

        // 2. Create Meeting Token with is_owner: true specifically for Super Admin
        const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              room_name: roomData.name || roomName,
              is_owner: true,
              user_name: 'Super Admin (المضيف العام)',
              enable_screenshare: true,
              exp: Math.round(Date.now() / 1000) + 86400
            }
          })
        });

        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.token) {
          ownerToken = tokenData.token;
          hostUrl = `${roomUrl}?t=${ownerToken}`;
        } else {
          hostUrl = roomUrl;
        }
      } else {
        throw new Error(roomData.message || 'Daily room creation failed');
      }
    } catch (dailyErr) {
      console.warn('Fallback to Jitsi Meet for staff room:', dailyErr.message);
      const fallbackRoom = `ImpactHub-StaffMeeting-${Date.now()}`;
      roomUrl = `https://meet.ffmuc.net/${fallbackRoom}`;
      guestUrl = roomUrl;
      hostUrl = `${roomUrl}#config.prejoinConfig.enabled=false`;
    }

    res.status(200).json({
      success: true,
      roomName,
      roomUrl,
      guestUrl,
      hostUrl,
      ownerToken: ownerToken || null
    });
  } catch (error) {
    console.error('Error in create-network-meeting handler:', error);
    res.status(500).json({ error: error.message });
  }
}
