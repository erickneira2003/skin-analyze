// api/analyze.js

const axios = require('axios');
const FormData = require('form-data');
const formidable = require('formidable');
const fs = require('fs');

// Disable Vercel's default body parser for this endpoint
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST allowed' });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: 'Form parsing error' });
    }

    const imageFile = files.image;

    if (!imageFile) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const formData = new FormData();
    formData.append('image', fs.createReadStream(imageFile.filepath));

    try {
      const response = await axios.post('https://www.ailabapi.com/api/portrait/analysis/skin-analysis-pro', formData, {
        headers: {
          'ailab-api-key': 'ey7mV5aEppSHoWqFBqkRbQJwa0DjA6ozxhKG1TMz8ZluSOEV22x08WruKAbIdZU5', // 👈 Replace with your actual API key
          ...formData.getHeaders()
        }
      });

      res.status(200).json(response.data);
    } catch (error) {
      console.error('API call failed:', error.response?.data || error.message);
      res.status(500).json({ message: 'Failed to get analysis result', details: error.response?.data });
    }
  });
}
