// api/youtube.js — Vercel Serverless Function
// YouTube Data API v3 — channel videos fetch
// .env.local mein chahiye: YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // 5 min cache

  const apiKey    = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey)    return res.status(500).json({ error: 'YOUTUBE_API_KEY not set in env' });
  if (!channelId) return res.status(500).json({ error: 'YOUTUBE_CHANNEL_ID not set in env' });

  try {
    // Step 1: Channel ka uploads playlist ID fetch karo
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();

    if (!channelData.items?.length) {
      return res.status(404).json({ error: 'Channel not found. Check YOUTUBE_CHANNEL_ID.' });
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Step 2: Last 20 videos fetch karo uploads playlist se
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();

    if (!playlistData.items?.length) {
      return res.status(200).json({ videos: [], lastVideo: null });
    }

    // Step 3: Video IDs nikalo — statistics (views) ke liye
    const videoIds = playlistData.items.map(item => item.contentDetails.videoId).join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    // Step 4: Combined video objects banao
    const videos = statsData.items.map(v => ({
      videoId:     v.id,
      title:       v.snippet.title,
      description: v.snippet.description,
      thumbnail:   v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
      publishedAt: v.snippet.publishedAt,
      viewCount:   parseInt(v.statistics.viewCount || '0'),
      likeCount:   parseInt(v.statistics.likeCount || '0'),
    }));

    // Most recently published video
    const lastVideo = videos[0] || null;

    return res.status(200).json({ videos, lastVideo });

  } catch (err) {
    console.error('YouTube API error:', err);
    return res.status(500).json({ error: err.message || 'YouTube API call failed' });
  }
}
