const express = require("express");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Ensure downloads folder exists
if (!fs.existsSync("downloads")) {
  fs.mkdirSync("downloads");
}

// Write cookies.txt from environment variable (only if COOKIE_STRING exists)
if (process.env.COOKIE_STRING) {
  fs.writeFileSync("cookies.txt", process.env.COOKIE_STRING);
  console.log("cookies.txt created from environment variable.");
} else {
  console.warn("WARNING: COOKIE_STRING env variable not found! Cookies file not created.");
}

app.use(express.static("public"));
app.use(express.json());

app.post("/download", async (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) return res.status(400).send("No URL provided");

  const outputPath = "downloads/%(title)s.%(ext)s";

  try {
    await ytdlp(videoUrl, {
      output: outputPath,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
      cookies: "cookies.txt",
    });

    // Find newest downloaded file
    const files = fs.readdirSync("downloads");
    const newestFile = files
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join("downloads", f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    if (!newestFile) {
      return res.status(500).send("No downloaded file found");
    }

    // Send file to client
    res.download(path.join("downloads", newestFile.name), (err) => {
      if (err) console.error("Download error:", err);

      // Optionally delete file after download
      fs.unlink(path.join("downloads", newestFile.name), (err) => {
        if (err) console.error("Failed to delete file:", err);
      });
    });
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).send("Download failed");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
