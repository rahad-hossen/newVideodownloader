FROM node:18-slim

# ffmpeg এবং yt-dlp ইনস্টল করো
RUN apt-get update && \
    apt-get install -y ffmpeg python3-pip && \
    pip3 install yt-dlp && \
    apt-get clean

# app ডিরেক্টরি তৈরি
WORKDIR /app

# সব ফাইল কপি
COPY . .

# npm install
RUN npm install

# স্টার্ট কমান্ড
CMD ["npm", "start"]
