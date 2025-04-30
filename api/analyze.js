// api/analyze.js

import fs from 'fs/promises';   // To read/write image files temporarily
import path from 'path';        // To create safe file paths
import os from 'os';            // To access the system's temp folder
import axios from 'axios';      // To send the request to AILab
import FormData from 'form-data'; // To build a valid form-data body

// Tells Vercel NOT to auto-process the request body (we need raw data)
export const config = {
  api: {
    bodyParser: false
  }
};

// The main backend function: runs when the frontend calls /api/analyze
export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Only POST allowed' });
    return;
  }

  try {
    // Extract the boundary string from the Content-Type header
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      return res.status(400).json({ message: 'Invalid content-type boundary' });
    }

    // Read the raw incoming image data from the request
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const body = Buffer.concat(buffers); // Join all chunks into one buffer

    // Parse the multipart/form-data manually and extract the file part
    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    if (!filePart) {
      return res.status(400).json({ message: 'Image not found in request' });
    }

    // Save the file temporarily to the system (we'll read from it below)
    const tempPath = path.join(os.tmpdir(), filePart.filename);
    await fs.writeFile(tempPath, filePart.data);
    const fileBuffer = await fs.readFile(tempPath);

    // ✅ Debug: Show what's being uploaded
    console.log('📤 Preparing to send image to AILab:', {
      filename: filePart.filename,
      sizeInKB: Math.round(fileBuffer.length / 1024),
    });

    // Build a valid form-data body to send to AILab Tools
    const formData = new FormData();
    formData.append('image', fileBuffer, {
      filename: filePart.filename || 'photo.jpg',
      contentType: 'image/jpeg' // ✅ Force JPEG, AILab only accepts this
    });

    // Send the image to AILab's API
    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5' // 👈 Use your actual key here
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 20000 // 20 seconds max wait time
      }
    );

    // If successful, return the result to the frontend
    res.status(200).json(response.data);

  } catch (err) {
    // Handle any errors returned by AILab
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      res.status(err.response.status).json({
        message: 'AILab API error',
        status: err.response.status,
        data: err.response.data
      });
    } else {
      // If anything else fails (like file system or network), show generic error
      console.error('❌ Unexpected error:', err.message);
      res.status(500).json({ message: 'Unexpected error', error: err.message });
    }
  }
}

// Extracts the "boundary" from the content-type header
function getBoundary(contentType) {
  const match = contentType?.match(/boundary=(.+)$/);
  return match ? match[1] : null;
}

// Manually parses a multipart/form-data body and extracts file parts
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
