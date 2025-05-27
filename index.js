const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const sanitize = require('sanitize-filename');

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const downloadsDir = 'downloads';
const cookiesPath = process.env.COOKIES_PATH || 'cookies.txt';

// Initialize directories
[downloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use('/download', require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 5
}));

// Routes
app.post('/download', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const options = {
      output: path.join(downloadsDir, '%(title)s.%(ext)s'),
      format: 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      referer: 'https://www.youtube.com/',
      userAgent: getRandomUserAgent()
    };

    // Add cookies if exists and valid
    if (await isValidCookiesFile(cookiesPath)) {
      options.cookies = cookiesPath;
      console.log('Using cookies for authentication');
    }

    await ytdlp(url, options);

    const downloadedFile = getNewestFile(downloadsDir);
    if (!downloadedFile) throw new Error('No file downloaded');

    res.download(
      downloadedFile.path,
      downloadedFile.safeName,
      () => fs.unlinkSync(downloadedFile.path)
    );

  } catch (err) {
    handleDownloadError(res, err);
  }
});

// Helper Functions
function isValidUrl(url) {
  try {
    return new URL(url).hostname.includes('youtube');
  } catch {
    return false;
  }
}

async function isValidCookiesFile(filePath) {
  try {
    return fs.existsSync(filePath) && 
           fs.readFileSync(filePath, 'utf8').includes('youtube.com');
  } catch {
    return false;
  }
}

function getNewestFile(dir) {
  const files = fs.readdirSync(dir)
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      time: fs.statSync(path.join(dir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  return files[0] ? {
    ...files[0],
    safeName: sanitize(files[0].name)
  } : null;
}

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function handleDownloadError(res, err) {
  console.error('Download Error:', err);
  
  let message = 'Download failed';
  if (err.message.includes('Sign in')) {
    message = 'This video requires authentication. Please ensure cookies.txt is properly configured.';
  } else if (err.message.includes('Private video')) {
    message = 'Cannot download private video';
  }

  res.status(500).json({ 
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Cookies path: ${cookiesPath}`);
  console.log(`Downloads dir: ${path.resolve(downloadsDir)}`);
});
