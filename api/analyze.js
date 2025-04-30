// api/analyze.js

import { IncomingMessage } from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Only POST allowed' });
    return;
  }

  try {
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      return res.status(400).json({ message: 'No boundary found in content-type' });
    }

    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const body = Buffer.concat(buffers);

    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    if (!filePart) {
      return res.status(400).json({ message: 'Image file not found in request' });
    }

    // Save file temporarily
    const tempPath = path.join(os.tmpdir(), filePart.filename);
    await fs.writeFile(tempPath, filePart.data);

    // Create multipart request manually for AILab API
    const uploadBoundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fileBuffer = await fs.readFile(tempPath);
    const payload = Buffer.concat([
      Buffer.from(
        `--${uploadBoundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="${filePart.filename}"\r\n` +
        `Content-Type: ${filePart.contentType}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(`\r\n--${uploadBoundary}--\r\n`)
    ]);

    const response = await fetch('https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${uploadBoundary}`,
        'ailab-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5' // 🔐 Replace with your real AILab API key
      },
      body: payload
    });

    const result = await response.json();
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error handling upload or API request', error: err.message });
  }
}

function getBoundary(contentType) {
  const match = contentType.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

function parseMultipart(body, boundary) {
  const result = [];
  const parts = body.toString().split(`--${boundary}`);
  parts.forEach(part => {
    if (part.includes('Content-Disposition')) {
      const [headers, ...bodyParts] = part.split('\r\n\r\n');
      const bodyContent = bodyParts.join('\r\n\r\n').trimEnd();
      const nameMatch = headers.match(/name="([^"]+)"/);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const contentTypeMatch = headers.match(/Content-Type: ([^\s]+)/);

      result.push({
        name: nameMatch?.[1],
        filename: filenameMatch?.[1],
        contentType: contentTypeMatch?.[1],
        data: Buffer.from(bodyContent, 'binary')
      });
    }
  });
  return result;
}

