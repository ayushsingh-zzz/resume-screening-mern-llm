require('dotenv').config();

const mongoose = require('mongoose');
const Job = require('./models/job');
const Candidate = require('./models/candidate');

async function testMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ MongoDB connected!');

    // Find the job we created earlier
    const job = await Job.findOne({
      title: 'Frontend Developer'
    });

    if (!job) {
      throw new Error('Frontend Developer job not found.');
    }

    console.log('✅ Job found:', job.title);

    // Create a candidate linked to that job
    const candidate = await Candidate.create({
      jobId: job._id,

      name: 'Arjun Sharma',

      resumeFileName: 'sample.pdf',

      resumeText:
        'Frontend Developer with 2.5 years of experience using React, JavaScript, HTML, CSS, REST APIs, Redux and TypeScript.',

      score: 92,

      breakdown: {
        skills: 38,
        experience: 27,
        education: 15,
        projects: 12
      },

      matchedSkills: [
        'React',
        'JavaScript',
        'HTML',
        'CSS',
        'REST APIs',
        'Redux',
        'TypeScript'
      ],

      missingSkills: [],

      summary:
        'Strong candidate with relevant frontend experience and excellent alignment with the required skills.'
    });

    console.log('\n✅ Candidate created successfully!\n');

    console.log(
      JSON.stringify(candidate, null, 2)
    );

    // Verify the relationship
    const candidates = await Candidate.find({
      jobId: job._id
    });

    console.log(
      `\n✅ Candidates for "${job.title}": ${candidates.length}`
    );

    await mongoose.connection.close();

    console.log('\n✅ MongoDB connection closed.');

  } catch (error) {
    console.error(
      '❌ MongoDB test failed:',
      error.message
    );
  }
}

testMongo();