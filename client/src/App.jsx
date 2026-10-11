
import { useState } from 'react';
import './App.css';

function App() {
  const [resume, setResume] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState(null);

  const handleFile = (file) => {
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('The resume must be smaller than 5 MB.');
      return;
    }

    setResume(file);
    setError('');
    setEvaluation(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleScreen = async () => {
    if (!resume || !jobDescription.trim()) return;

    setIsScreening(true);
    setError('');
    setEvaluation(null);

    const formData = new FormData();
    formData.append('resume', resume);

    const completeJobDescription = [
      jobTitle.trim() ? `Job Title: ${jobTitle.trim()}` : '',
      jobDescription.trim()
    ].filter(Boolean).join('\n\n');

    formData.append('jobDescription', completeJobDescription);

    try {
      const response = await fetch('http://localhost:5000/api/screen', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Screening failed. Please try again.');
      }

      if (!data.result) {
        throw new Error('The server did not return an evaluation.');
      }

      setEvaluation(data.result);
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot connect to the backend. Make sure your server is running on port 5000.'
          : err.message
      );
    } finally {
      setIsScreening(false);
    }
  };

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">RS</div>
          <div>
            <div className="brand-name">ResumeScreen</div>
            <div className="brand-subtitle">
              Candidate intelligence workspace
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="live-dot"></span>
          {isScreening ? 'Screening in progress' : 'Screening engine ready'}
        </div>
      </header>

      <main className="page">
        <section className="intro">
          <div>
            <p className="eyebrow">NEW SCREENING</p>
            <h1>
              Find the right
              <br />
              <em>signal</em> in every CV.
            </h1>
            <p className="intro-text">
              Give us the role. We'll compare the candidate against
              what actually matters.
            </p>
          </div>

          <div className="case-number">
            <span>CASE</span>
            <strong>01</strong>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="panel brief-panel">
            <div className="panel-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Role brief</h2>
              </div>
              <span className="required">REQUIRED</span>
            </div>

            <label htmlFor="job-title">What are you hiring for?</label>
            <input
              id="job-title"
              className="role-input"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Frontend Developer"
            />

            <label htmlFor="job-description">Requirements &amp; context</label>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={`Tell us what makes someone a strong candidate.

Example:
2+ years of React experience
Strong JavaScript fundamentals
REST API experience
Good understanding of HTML & CSS
Bachelor's degree in Computer Science`}
            />

            <div className="brief-footer">
              <span>{jobDescription.length} characters</span>
              <span>TEXT ANALYSIS ENABLED</span>
            </div>
          </div>

          <div className="panel candidate-panel">
            <div className="panel-heading">
              <div>
                <span className="section-number">02</span>
                <h2>Candidate</h2>
              </div>
              <span className="optional">PDF / DOCX</span>
            </div>

            <input
              id="resume-input"
              type="file"
              accept=".pdf,.docx"
              hidden
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {!resume ? (
              <label
                htmlFor="resume-input"
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="drop-symbol">↳</div>
                <div className="drop-title">Drop candidate CV here</div>
                <div className="drop-description">
                  or click to browse your files
                </div>
                <div className="file-rule">MAX 5MB · PDF / DOCX</div>
              </label>
            ) : (
              <div className="uploaded-file">
                <div className="file-icon">CV</div>
                <div className="file-information">
                  <strong>{resume.name}</strong>
                  <span>
                    {(resume.size / 1024 / 1024).toFixed(2)} MB · Ready
                  </span>
                </div>
                <button
                  type="button"
                  className="remove-file"
                  aria-label="Remove resume"
                  onClick={() => {
                    setResume(null);
                    setEvaluation(null);
                    setError('');
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <div className="candidate-note">
              <span className="note-mark">i</span>
              <p>
                Your resume is parsed first. Only the extracted
                information is passed to the screening engine.
              </p>
            </div>
          </div>
        </section>

        <section className="action-area">
          <div className="process-note">
            <div className="process-line"></div>
            <div>
              <span>SCREENING FLOW</span>
              <p>Parse → Match → Evaluate → Recommend</p>
            </div>
          </div>

          <button
            type="button"
            className="screen-button"
            disabled={!resume || !jobDescription.trim() || isScreening}
            onClick={handleScreen}
          >
            <span>{isScreening ? 'Screening...' : 'Run screening'}</span>
            <span className="arrow">{isScreening ? '…' : '→'}</span>
          </button>
        </section>

        {error && (
          <div role="alert" className="screening-error">
            <strong>Screening error</strong>
            <p>{error}</p>
          </div>
        )}

        <section className="preview-result">
          <div className="result-heading">
            <div>
              <span className="section-number">03</span>
              <h2>Candidate evaluation</h2>
            </div>
            <span className="coming-soon">
              {evaluation ? 'SCREENING COMPLETE' : 'AWAITING SCREENING'}
            </span>
          </div>

          {!evaluation ? (
            <div className="result-placeholder">
              <div className="placeholder-score">
                <span>{isScreening ? '…' : '—'}</span>
              </div>
              <div>
                <h3>
                  {isScreening
                    ? 'Evaluating candidate...'
                    : 'Your screening result will appear here.'}
                </h3>
                <p>
                  Match score, skill alignment, missing requirements,
                  candidate summary and recommendation.
                </p>
              </div>
            </div>
          ) : (
            <div className="evaluation-content">
              <div className="evaluation-score">
                <span className="evaluation-label">MATCH SCORE</span>
                <strong>{evaluation.score}<small>/100</small></strong>
              </div>

              <h3>Score breakdown</h3>
              <div className="score-breakdown">
                {[
                  ['Skills Match', evaluation.breakdown?.skills, 40],
                  ['Experience Relevance', evaluation.breakdown?.experience, 30],
                  ['Education Fit', evaluation.breakdown?.education, 15],
                  ['Project Relevance', evaluation.breakdown?.projects, 15]
                ].map(([label, score, maximum]) => (
                  <div className="score-row" key={label}>
                    <div className="score-row-label">
                      <span>{label}</span>
                      <strong>{score ?? 0}/{maximum}</strong>
                    </div>
                    <div className="score-track">
                      <div
                        className="score-fill"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, ((score ?? 0) / maximum) * 100)
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="skill-columns">
                <div>
                  <h3>Matched skills</h3>
                  {evaluation.matched_skills?.length ? (
                    <ul>
                      {evaluation.matched_skills.map((skill, index) => (
                        <li key={`${skill}-${index}`}>{skill}</li>
                      ))}
                    </ul>
                  ) : <p>No matched skills returned.</p>}
                </div>

                <div>
                  <h3>Missing skills</h3>
                  {evaluation.missing_skills?.length ? (
                    <ul>
                      {evaluation.missing_skills.map((skill, index) => (
                        <li key={`${skill}-${index}`}>{skill}</li>
                      ))}
                    </ul>
                  ) : <p>No missing skills reported.</p>}
                </div>
              </div>

              <h3>AI summary</h3>
              <p className="evaluation-summary">{evaluation.summary}</p>

              <p className="evaluation-disclaimer">
                AI-assisted evaluation only. A human should review the
                resume and make the final hiring decision.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>RESUMESCREEN</span>
        <span>AI-ASSISTED · HUMAN DECISION</span>
        <span>v0.1</span>
      </footer>
    </div>
  );
}

export default App;
