import { useState } from 'react';
import './App.css';

function App() {
  const [resume, setResume] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file) => {
    if (!file) return;

    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'];

    if (!allowed.includes(file.type)) {
      alert('Please upload a PDF or DOCX file.');
      return;
    }

    setResume(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleScreen = () => {
    if (!resume || !jobDescription.trim()) return;

    alert('Screening connection will be added next.');
  };

  return (
    <div className="workspace">

      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">RS</div>

          <div>
            <div className="brand-name">ResumeScreen</div>
            <div className="brand-subtitle">Candidate intelligence workspace</div>
          </div>
        </div>

        <div className="topbar-right">
          <span className="live-dot"></span>
          Screening engine ready
        </div>
      </header>

      {/* PAGE */}
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

          {/* JOB BRIEF */}
          <div className="panel brief-panel">

            <div className="panel-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Role brief</h2>
              </div>

              <span className="required">REQUIRED</span>
            </div>

            <label>What are you hiring for?</label>

            <input
              className="role-input"
              placeholder="e.g. Frontend Developer"
            />

            <label>Requirements & context</label>

            <textarea
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

          {/* RESUME */}
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
              accept=".pdf,.doc,.docx"
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

                <div className="drop-title">
                  Drop candidate CV here
                </div>

                <div className="drop-description">
                  or click to browse your files
                </div>

                <div className="file-rule">
                  MAX 10MB · PDF / DOCX
                </div>
              </label>
            ) : (
              <div className="uploaded-file">

                <div className="file-icon">
                  CV
                </div>

                <div className="file-information">
                  <strong>{resume.name}</strong>

                  <span>
                    {(resume.size / 1024 / 1024).toFixed(2)} MB · Ready
                  </span>
                </div>

                <button
                  className="remove-file"
                  onClick={() => setResume(null)}
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

        {/* ACTION */}
        <section className="action-area">

          <div className="process-note">
            <div className="process-line"></div>

            <div>
              <span>SCREENING FLOW</span>
              <p>
                Parse → Match → Evaluate → Recommend
              </p>
            </div>
          </div>

          <button
            className="screen-button"
            disabled={!resume || !jobDescription.trim()}
            onClick={handleScreen}
          >
            <span>Run screening</span>
            <span className="arrow">→</span>
          </button>

        </section>

        {/* PREVIEW RESULT */}
        <section className="preview-result">

          <div className="result-heading">
            <div>
              <span className="section-number">03</span>
              <h2>Candidate evaluation</h2>
            </div>

            <span className="coming-soon">AWAITING SCREENING</span>
          </div>

          <div className="result-placeholder">

            <div className="placeholder-score">
              <span>—</span>
            </div>

            <div>
              <h3>Your screening result will appear here.</h3>
              <p>
                Match score, skill alignment, missing requirements,
                candidate summary and recommendation.
              </p>
            </div>

          </div>

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