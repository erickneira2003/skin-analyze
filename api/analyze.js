// Import dependencies
import formidable from 'formidable';   // For parsing multipart/form-data (file uploads)
import fs from 'fs/promises';          // Node.js promises-based file system API
import sharp from 'sharp';             // Image processing library (we use it to ensure JPEG format)
import axios from 'axios';             // To make HTTP requests to AILab Tools API
import FormData from 'form-data';      // To build form-data for API requests

// Vercel config: tell Vercel not to parse the body (formidable will do it)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Main function: handles /api/analyze requests
export default async function handler(req, res) {
  // Only allow POST requests — all others are rejected
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
        // Initialize formidable to parse uploaded file

    const form = formidable({
      keepExtensions: true, // Keep file extension (like .jpg)
      multiples: false, // Only allow one file upload
    });

    const result = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ✅ Fix: handle array or single file
    const uploadedFile = Array.isArray(result.files.image)
      ? result.files.image[0]
      : result.files.image;

    console.log('📷 Uploaded file:', uploadedFile);

    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const buffer = await fs.readFile(uploadedFile.filepath);
    const jpegBuffer = await sharp(buffer).jpeg().toBuffer();

    const apiForm = new FormData();
    apiForm.append('image', jpegBuffer, {
      filename: 'converted.jpg',
      contentType: 'image/jpeg',
    });

    apiForm.append('return_maps', 'red_area,brown_area,texture_enhanced_pores,texture_enhanced_blackheads,texture_enhanced_lines,water_area,rough_area,roi_outline_map');

    const response = await axios.post(
      'https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro',
      apiForm,
      {
        headers: {
          ...apiForm.getHeaders(),
          'ailabapi-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 20000,
      }
    );

    console.log('✅ AILab response:', response.data);
    res.status(200).json(response.data);
  } catch (err) {
    if (err.response) {
      console.error('❌ AILab API error:', err.response.status, err.response.data);
      res.status(err.response.status).json({
        error_msg: err.response.data?.error_msg || err.response.data?.message || 'Unknown AILab error',
      });
    } else {
      console.error('❌ Unexpected error:', err.message);
      res.status(500).json({ error_msg: err.message || 'Internal server error' });
    }
  }
}


