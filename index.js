const express = require("express");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());

app.post("/download", async (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) return res.status(400).send("No URL provided");

  const outputPath = "downloads/%(title)s.%(ext)s";

  try {
    const result = await ytdlp(videoUrl, {
      output: outputPath,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
      ffmpegLocation: 'K:/ffmpeg-master-latest-win64-gpl-shared/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe'

    });
    console.log(result);

    const files = fs.readdirSync("downloads");
    const newestFile = files
      .map(f => ({ name: f, time: fs.statSync(path.join("downloads", f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0];

    res.download(path.join("downloads", newestFile.name));
  } catch (err) {
    console.error(err);
    res.status(500).send("Download failed");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});