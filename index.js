// const express = require("express");
// const ytdlp = require("yt-dlp-exec");
// const path = require("path");
// const fs = require("fs");

// const app = express();
// // Render এ চলার সময় PORT env variable থেকে port নিতে হয়
// const port = process.env.PORT || 3000;

// // Ensure 'downloads' folder exists
// if (!fs.existsSync("downloads")) {
//   fs.mkdirSync("downloads");
// }

// app.use(express.static("public"));
// app.use(express.json());

// app.post("/download", async (req, res) => {
//   const videoUrl = req.body.url;
//   if (!videoUrl) return res.status(400).send("No URL provided");

//   const outputPath = "downloads/%(title)s.%(ext)s";

//   try {
//     const result = await ytdlp(videoUrl, {
//       output: outputPath,
//       format: "bestvideo+bestaudio/best",
//       mergeOutputFormat: "mp4",
//       cookies: "cookies.txt"
//       // ⚠ ffmpegLocation দরকার নেই Render-এ
//     });

//     console.log(result);

//     // সর্বশেষ তৈরি হওয়া ফাইলটা বের করা
//     const files = fs.readdirSync("downloads");
//     const newestFile = files
//       .map(f => ({ name: f, time: fs.statSync(path.join("downloads", f)).mtime.getTime() }))
//       .sort((a, b) => b.time - a.time)[0];

//     res.download(path.join("downloads", newestFile.name), (err) => {
//       if (err) console.error("Download error:", err);

//       // ডাউনলোডের পর temp ফাইল মুছে ফেলা (optional)
//       fs.unlink(path.join("downloads", newestFile.name), (err) => {
//         if (err) console.error("Failed to delete file:", err);
//       });
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Download failed");
//   }
// });

// app.listen(port, () => {
//   console.log(` Server is running on http://localhost:${port}`);
// });


const express = require("express");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

// Ensure 'downloads' folder exists
if (!fs.existsSync("downloads")) {
  fs.mkdirSync("downloads");
}

// Serve static files from 'public' folder (যেখানে তোমার HTML+JS আছে)
app.use(express.static("public"));

// Parse JSON body
app.use(express.json());

app.post("/download", async (req, res) => {
  const videoUrl = req.body.url;
  if (!videoUrl) return res.status(400).send("No URL provided");

  const outputPathTemplate = "downloads/%(title)s.%(ext)s";

  try {
    // ভিডিও ডাউনলোড করো
    const result = await ytdlp(videoUrl, {
      output: outputPathTemplate,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
      cookies: "cookies.txt" // তোমার যদি cookies.txt থাকে
    });

    console.log(result);

    // সর্বশেষ তৈরি হওয়া ফাইল বের করো
    const files = fs.readdirSync("downloads");
    const newestFile = files
      .map(f => ({ name: f, time: fs.statSync(path.join("downloads", f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0];

    const filePath = path.join("downloads", newestFile.name);
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${newestFile.name}"`);

    // ফাইল স্ট্রিম করে পাঠাও
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    // ডাউনলোড শেষ হলে ফাইল মুছে ফেলো (optional)
    readStream.on("close", () => {
      fs.unlink(filePath, err => {
        if (err) console.error("Failed to delete file:", err);
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Download failed");
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});


