
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

async function parseResume(buffer, originalName) {
  const extension = originalName.split('.').pop().toLowerCase();

  if (extension === 'pdf') {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      const text = result.text.trim();

      if (!text) {
        throw new Error('No text found in PDF. It may be scanned.');
      }

      return text;
    } finally {
      await parser.destroy();
    }
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      throw new Error('No readable text found in DOCX.');
    }

    return text;
  }

  throw new Error('Only PDF and DOCX files are supported.');
}

module.exports = { parseResume };
