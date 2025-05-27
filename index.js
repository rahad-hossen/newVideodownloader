const express = require('express');
const ytdlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const sanitize = require('sanitize-filename');

const app = express();
const port = process.env.PORT || 3000;

// Create downloads folder
const downloadsDir = 'downloads';
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Check and create cookies file if not exists
const cookiesFile = 'cookies.txt';
if (!fs.existsSync(cookiesFile)) {
  fs.writeFileSync(cookiesFile, '', { flag: 'wx' }); // Create empty file if doesn't exist
  console.log('Created empty cookies.txt file. Add your YouTube cookies if needed.');
}

app.use(express.static('public'));
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/download', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
}));

app.post('/download', async (req, res) => {
  try {
    const videoUrl = req.body.url;
    if (!videoUrl || !isValidUrl(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const options = {
      output: path.join(downloadsDir, '%(title)s.%(ext)s'),
      format: 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // Check if cookies file has content (not just empty file)
    const cookiesContent = fs.readFileSync(cookiesFile, 'utf8');
    if (cookiesContent.trim().length > 0) {
      options.cookies = cookiesFile;
      console.log('Using cookies.txt for authentication');
    }

    await ytdlp(videoUrl, options);

    const files = fs.readdirSync(downloadsDir);
    const newestFile = files
      .map(f => ({ 
        name: f, 
        time: fs.statSync(path.join(downloadsDir, f)).mtime.getTime() 
      }))
      .sort((a, b) => b.time - a.time)[0];

    res.download(
      path.join(downloadsDir, newestFile.name),
      sanitize(newestFile.name),
      () => fs.unlinkSync(path.join(downloadsDir, newestFile.name))
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: 'Download failed',
      details: err.message.includes('Sign in') 
        ? 'This video requires valid cookies in cookies.txt' 
        : err.message 
    });
  }
});

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Cookies file path: ${path.resolve(cookiesFile)}`);
});
