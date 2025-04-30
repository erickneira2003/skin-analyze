// ✅ Import required packages
import fs from 'fs/promises';      // Not used here, but good for debugging in local environments
import path from 'path';           // Optional helper for paths
import os from 'os';               // Optional helper for temp folder access
import axios from 'axios';         // Used to send the image to the AILab API
import FormData from 'form-data';  // Builds the request body for sending the image
import sharp from 'sharp';         // Converts any image format into JPEG

// ✅ Tell Vercel to NOT parse the request body (we handle raw binary ourselves)
export const config = {
  api: {
    bodyParser: false
  }
};

// ✅ Main function that runs when someone sends a POST request to /api/analyze
export default async function handler(req, res) {
  // Only allow POST requests (image uploads)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    // ✅ Get the "boundary" string used in the multipart form upload
    const boundary = getBoundary(req.headers['content-type']);
    if (!boundary) {
      return res.status(400).json({ message: 'Invalid content-type boundary' });
    }

    // ✅ Read the full request body (raw binary data)
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk); // Collect each chunk of data
    }
    const body = Buffer.concat(buffers); // Merge chunks into one buffer

    // ✅ Parse the form data using our custom parser
    const parts = parseMultipart(body, boundary);

    // ✅ Look for the uploaded file among the form parts
    const filePart = parts.find(p => p.filename);
    if (!filePart) {
      return res.status(400).json({ message: 'Image not found in request' });
    }

    // ✅ Print info about the uploaded image to help debugging
    console.log('📤 Preparing to send image to AILab:', {
      filename: filePart.filename,
      contentType: filePart.contentType,
      sizeInKB: Math.round(filePart.data.length / 1024),
    });

    // ✅ Convert image to JPEG — required by AILab (even if it's already JPEG)
    const jpegBuffer = await sharp(filePart.data).jpeg().toBuffer();

    // ✅ Build a new form-data object to send to AILab
    const formData = new FormData();
    formData.append('image', jpegBuffer, {
      filename: 'converted.jpg',
      contentType: 'image/jpeg'
    });

    // ✅ Send image to AILab API with your API key
    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      formData,
      {
        headers: {
          ...formData.getHeaders(), // Includes boundary and content-type
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5' // ⛔ Replace with your real key
        },
        maxBodyLength: Infinity,       // Allow big images
        maxContentLength: Infinity,
        timeout: 20000                 // 20 seconds timeout
      }
    );

    // ✅ Send AILab's successful response back to your frontend
    res.status(200).json(response.data);

  } catch (err) {
    // ✅ If AILab responded with an error, forward it to the frontend
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      res.status(err.response.status).json({
        error_msg: err.response.data?.error_msg || err.response.data?.message || 'Unknown AILab error'
      });
    } else {
      // ❌ Catch unexpected internal errors (file system, parsing, etc.)
      console.error('❌ Unexpected error:', err.message);
      res.status(500).json({ error_msg: err.message || 'Unknown error' });
    }
  }
}
