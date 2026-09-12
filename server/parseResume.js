const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

async function parseResume(fileName) {
  let parser;

  try {
    const filePath = path.join(
      __dirname,
      'test-resumes',
      fileName
    );

    const extension = path.extname(fileName).toLowerCase();

    const dataBuffer = fs.readFileSync(filePath);

    console.log(`📄 Reading: ${fileName}`);

    let resumeText = '';

    // PDF
    if (extension === '.pdf') {
      parser = new PDFParse({
        data: dataBuffer
      });

      const result = await parser.getText();
      resumeText = result.text;

      await parser.destroy();
    }

    // DOCX
    else if (extension === '.docx') {
      const result = await mammoth.extractRawText({
        buffer: dataBuffer
      });

      resumeText = result.value;
    }

    // Unsupported file
    else {
      throw new Error(
        'Unsupported file type. Only PDF and DOCX are allowed.'
      );
    }

    console.log('✅ Resume parsed successfully!\n');
    console.log('----- RESUME TEXT -----\n');
    console.log(resumeText);
    console.log('\n----- END -----');

  } catch (error) {
    console.error(
      '❌ Failed to parse resume:',
      error.message
    );
  }
}

// Change this to test different files
parseResume('sample.pdf');