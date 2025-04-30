import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp'; // ✅ Auto-converts image to JPEG

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      return res.status(400).json({ message: 'Invalid content-type boundary' });
    }

    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const body = Buffer.concat(buffers);

    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    if (!filePart) {
      return res.status(400).json({ message: 'Image not found in request' });
    }

    // Debug original content type
    console.log('📤 Uploaded file:', {
      name: filePart.filename,
      contentType: filePart.contentType,
      sizeKB: Math.round(filePart.data.length / 1024)
    });

    // ✅ Convert uploaded image to valid JPEG using sharp
    const jpegBuffer = await sharp(filePart.data).jpeg().toBuffer();

    // Form the request body
    const formData = new FormData();
    formData.append('image', jpegBuffer, {
      filename: 'converted.jpg',
      contentType: 'image/jpeg'
    });

    // Send to AILab
    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 20000
      }
    );

    return res.status(200).json(response.data);

  } catch (err) {
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      return res.status(err.response.status).json({
        message: 'AILab API error',
        status: err.response.status,
        data: err.response.data
      });
    } else {
      console.error('❌ Unexpected error:', err.message);
      return res.status(500).json({ message: 'Unexpected error', error: err.message });
    }
  }
}

function getBoundary(contentType) {
  const match = contentType?.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

function parseMultipart(body, boundary) {
  const parts = [];
  const chunks = body.toString().split(`--${boundary}`);
  for (let chunk of chunks) {
    if (chunk.includes('Content-Disposition')) {
      const [header, ...rest] = chunk.split('\r\n\r\n');
      const nameMatch = header.match(/name="(.+?)"/);
      const filenameMatch = header.match(/filename="(.+?)"/);
      const contentTypeMatch = header.match(/Content-Type: (.+)/);
      const data = Buffer.from(rest.join('\r\n\r\n').trim(), 'binary');
      parts.push({
        name: nameMatch?.[1],
        filename: filenameMatch?.[1],
        contentType: contentTypeMatch?.[1],
        data
      });
    }
  }
  return parts;
}
