const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const sanitize = require('sanitize-filename');

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const downloadsDir = 'downloads';
const cookiesPath = process.env.COOKIES_PATH || path.join(__dirname, 'cookies.txt');

// Initialize directories
[downloadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use('/download', require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many requests, please try again later'
}));

// Improved YouTube URL validation
function isValidYouTubeUrl(url) {
  try {
    const parsed = new URL(url);
    const validHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtu.be'
    ];
    
    return (
      validHosts.includes(parsed.hostname) &&
      (parsed.pathname.includes('/watch') || 
       parsed.pathname.includes('/shorts') ||
       parsed.pathname === '/')
    );
  } catch {
    return false;
  }
}

// Enhanced cookies validation
async function validateCookies(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('Cookies file not found at:', filePath);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const isValid = content.includes('.youtube.com') && 
                   content.includes('YES') &&
                   content.length > 500;
    
    if (!isValid) {
      console.warn('Invalid cookies.txt content');
    }
    return isValid;
  } catch (err) {
    console.error('Cookie validation error:', err);
    return false;
  }
}

// Get newest file with error handling
function getNewestFile(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => fs.statSync(path.join(dir, f)).isFile())
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
  } catch (err) {
    console.error('Error finding newest file:', err);
    return null;
  }
}

// Routes
app.post('/download', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // URL cleaning and validation
    url = url.toString().trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL',
        example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });
    }

    const options = {
      output: path.join(downloadsDir, '%(title)s.%(ext)s'),
      format: 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      referer: 'https://www.youtube.com/',
      userAgent: getRandomUserAgent(),
      noCheckCertificates: true,
      socketTimeout: 30000,
      retries: 3
    };

    // Add cookies if valid
    if (await validateCookies(cookiesPath)) {
      options.cookies = cookiesPath;
      console.log('Using cookies for authentication');
    }

    console.log('Downloading:', url);
    await ytdlp(url, options);

    const downloadedFile = getNewestFile(downloadsDir);
    if (!downloadedFile) {
      throw new Error('Downloaded file not found');
    }

    res.download(
      downloadedFile.path,
      downloadedFile.safeName,
      (err) => {
        if (err) {
          console.error('File download error:', err);
        }
        try {
          fs.unlinkSync(downloadedFile.path);
        } catch (unlinkErr) {
          console.error('File cleanup error:', unlinkErr);
        }
      }
    );

  } catch (err) {
    console.error('Download failed:', err);
    
    let message = 'Download failed';
    if (err.message.includes('Sign in')) {
      message = 'YouTube requires authentication. Please add valid cookies.txt';
    } else if (err.message.includes('Private video')) {
      message = 'Cannot download private video';
    } else if (err.message.includes('Unsupported URL')) {
      message = 'Invalid YouTube URL format';
    }

    res.status(500).json({ 
      error: message,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Utility functions
function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Cookies path: ${cookiesPath}`);
  console.log(`Downloads dir: ${path.resolve(downloadsDir)}`);
  console.log(`Node environment: ${process.env.NODE_ENV || 'development'}`);
});
