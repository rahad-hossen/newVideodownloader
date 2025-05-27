const express = require("express");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync("downloads")) {
  fs.mkdirSync("downloads");
}

app.use(express.static("public"));
app.use(express.json());

app.post("/download", (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) return res.status(400).send("No URL provided");

  const outputPath = "downloads/%(title)s.%(ext)s";

  const args = [
    videoUrl,
    "--output", outputPath,
    "--format", "bestvideo+bestaudio/best",
    "--merge-output-format", "mp4",
    "--cookies", "cookies.txt"
  ];

  const ytdlpPath = path.join(__dirname, "yt-dlp");

  execFile(ytdlpPath, args, (error, stdout, stderr) => {
    if (error) {
      console.error("yt-dlp error:", stderr || error);
      return res.status(500).send("Download failed");
    }

    // সর্বশেষ তৈরি হওয়া ফাইলটা বের করা
    const files = fs.readdirSync("downloads");
    const newestFile = files
      .map(f => ({ name: f, time: fs.statSync(path.join("downloads", f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0];

    const filePath = path.join("downloads", newestFile.name);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(newestFile.name)}"`);
    res.download(filePath, (err) => {
      if (err) console.error("Download error:", err);
      fs.unlink(filePath, err => {
        if (err) console.error("Failed to delete file:", err);
      });
    });
  });
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
