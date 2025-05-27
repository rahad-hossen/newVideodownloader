const express = require("express");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// cookies.txt create from environment variable
fs.writeFileSync("cookies.txt", process.env.YTDLP_COOKIES || "", "utf-8");

// Ensure 'downloads' folder exists
if (!fs.existsSync("downloads")) {
  fs.mkdirSync("downloads");
}

app.use(express.static("public"));
app.use(express.json());

app.post("/download", async (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) return res.status(400).send("No URL provided");

  const outputPath = "downloads/%(title)s.%(ext)s";

  try {
    await ytdlp(videoUrl, {
      execPath: path.join(__dirname, "yt-dlp"),
      output: outputPath,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
      cookies: "cookies.txt"
    });

    const files = fs.readdirSync("downloads");
    const newestFile = files
      .map(f => ({
        name: f,
        time: fs.statSync(path.join("downloads", f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)[0];

    res.download(path.join("downloads", newestFile.name), err => {
      if (err) console.error("Download error:", err);
      fs.unlink(path.join("downloads", newestFile.name), err => {
        if (err) console.error("Failed to delete file:", err);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Download failed");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
