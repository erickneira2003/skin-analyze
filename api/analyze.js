import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp'; // To convert any image into JPEG

export const config = {
  api: {
    bodyParser: false // Let us manually read the body (for file uploads)
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    // Get the boundary string from the content-type (needed to parse multipart manually)
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      return res.status(400).json({ message: 'Invalid content-type boundary' });
    }

    // Collect the binary data of the entire request (image + headers)
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const body = Buffer.concat(buffers);

    // Parse the multipart/form-data manually
    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename); // Get the file part only

    if (!filePart) {
      return res.status(400).json({ message: 'Image not found in request' });
    }

    // Debug: Show file info before conversion
    console.log('📤 Preparing to send image to AILab:', {
      filename: filePart.filename,
      contentType: filePart.contentType,
      sizeInKB: Math.round(filePart.data.length / 1024),
    });

    // ✅ Convert image to JPEG using sharp to ensure AILab accepts it
    const jpegBuffer = await sharp(filePart.data).jpeg().toBuffer();

    // Create a form-data body to send to AILab
    const formData = new FormData();
    formData.append('image', jpegBuffer, {
      filename: 'converted.jpg',
      contentType: 'image/jpeg'
    });

    // Send to AILab API
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

    // Return the result from AILab to frontend
    res.status(200).json(response.data);

  } catch (err) {
    // Catch and report AILab errors or internal errors
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      res.status(err.response.status).json({
        message: 'AILab API error',
        status: err.response.status,
        data: err.response.data
      });
    } else {
      console.error('❌ Unexpected error:', err.message);
      res.status(500).json({ message: 'Unexpected error', error: err.message });
    }
  }
}

// ✅ Extracts the multipart boundary from the Content-Type header
function getBoundary(contentType) {
  const match = contentType?.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

// ✅ Parses multipart/form-data and extracts files safely
function parseMultipart(body, boundary) {
  const parts = [];
  const chunks = body.toString('latin1').split(`--${boundary}`); // Use latin1 for binary-safe split

  for (let chunk of chunks) {
    if (chunk.includes('Content-Disposition')) {
      const [header, ...rest] = chunk.split('\r\n\r\n');
      const nameMatch = header.match(/name="(.+?)"/);
      const filenameMatch = header.match(/filename="(.+?)"/);
      const contentTypeMatch = header.match(/Content-Type: (.+)/);

      const rawBody = rest.join('\r\n\r\n');
      const data = Buffer.from(rawBody, 'latin1'); // ✅ FIXED: binary-safe buffer creation

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
