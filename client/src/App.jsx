
import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  // Authentication state
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem('resumeScreenToken') || ''
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('resumeScreenUser')
      ) || null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authCompanyName, setAuthCompanyName] = useState('');
  const [authRecruiterRole, setAuthRecruiterRole] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Screening state
  const [resume, setResume] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [showJdGuide, setShowJdGuide] = useState(false);

  // Recruitment case state
  const [jobCases, setJobCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [caseError, setCaseError] = useState('');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseDescription, setNewCaseDescription] = useState('');
  const [isSavingCase, setIsSavingCase] = useState(false);

  // History state
  const [screeningHistory, setScreeningHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');


// Authentication handler
const handleAuth = async (e) => {
  e.preventDefault();

  setAuthError('');

  // Confirm password validation (registration only)
  if (
    authMode === 'register' &&
    authPassword !== authConfirmPassword
  ) {
    setAuthError('Passwords do not match.');
    return;
  }

  setIsAuthenticating(true);

  try {
    const endpoint =
      authMode === 'login' ? 'login' : 'register';

    const requestBody =
      authMode === 'register'
        ? {
            fullName: authFullName.trim(),
            companyName: authCompanyName.trim(),
            recruiterRole: authRecruiterRole,
            email: authEmail.trim(),
            password: authPassword
          }
        : {
            email: authEmail.trim(),
            password: authPassword
          };

    const response = await fetch(
      `${API_URL}/auth/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || 'Authentication failed.'
      );
    }

    localStorage.setItem(
      'resumeScreenToken',
      data.token
    );

    localStorage.setItem(
      'resumeScreenUser',
      JSON.stringify(data.user)
    );

    setAuthToken(data.token);
    setCurrentUser(data.user);

    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthError('');

  } catch (err) {
    setAuthError(
      err.message === 'Failed to fetch'
        ? 'Cannot connect to the backend. Make sure the server is running.'
        : err.message
    );
  } finally {
    setIsAuthenticating(false);
  }
};


  // Logout handler
  const handleLogout = useCallback(() => {
    localStorage.removeItem('resumeScreenToken');
    localStorage.removeItem('resumeScreenUser');

    setAuthToken('');
    setCurrentUser(null);

    setResume(null);
    setEvaluation(null);
    setScreeningHistory([]);
    setShowHistory(false);
    setError('');
    setHistoryError('');
    setJobTitle('');
    setJobDescription('');

    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setAuthFullName('');
    setAuthCompanyName('');
    setAuthRecruiterRole('');
    setAuthConfirmPassword('');
    setShowAuthPassword(false);
    setAuthMode('login');
  },[]);

// Handle expired or invalid sessions
const handleSessionExpired = useCallback(() => {
  handleLogout();
  setAuthError(
    'Your session has expired. Please sign in again.'
  );
}, [handleLogout]);

  // Create a new recruitment case
  const handleCreateCase = async (e) => {
    e.preventDefault();

    if (!newCaseTitle.trim() || !newCaseDescription.trim()) {
      setCaseError('Please enter both job title and job description.');
      return;
    }

    setIsSavingCase(true);
    setCaseError('');

    try {
      const response = await fetch(`${API_URL}/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          jobTitle: newCaseTitle.trim(),
          jobDescription: newCaseDescription.trim()
        })
      });

      const data = await response.json();

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || 'Could not create recruitment case.'
        );
      }

      if (!data.jobCase?._id) {
        throw new Error('The server did not return the new case.');
      }

      setJobCases((current) => [
        data.jobCase,
        ...current
      ]);

      setSelectedCaseId(data.jobCase._id);

      setJobTitle(data.jobCase.jobTitle);
      setJobDescription(data.jobCase.jobDescription);

      setNewCaseTitle('');
      setNewCaseDescription('');
      setShowCaseForm(false);
      setEvaluation(null);
      setResume(null);
      setError('');
    } catch (err) {
      setCaseError(err.message);
    } finally {
      setIsSavingCase(false);
    }
  };

  // Load recruitment cases for the logged-in recruiter
  useEffect(() => {
    if (!authToken) return;

    let isActive = true;

    const loadCases = async () => {
      setIsLoadingCases(true);
      setCaseError('');

      try {
        const response = await fetch(`${API_URL}/cases`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });

        const data = await response.json();

        if (response.status === 401) {
          handleSessionExpired();
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error || 'Could not load recruitment cases.'
          );
        }

        if (!Array.isArray(data.cases)) {
          throw new Error('Invalid recruitment cases response.');
        }

        if (isActive) {
          setJobCases(data.cases);

          setSelectedCaseId((current) =>
            data.cases.some((item) => item._id === current)
              ? current
              : data.cases[0]?._id || ''
          );
        }
      } catch (err) {
        if (isActive) {
          setCaseError(err.message);
        }
      } finally {
        if (isActive) {
          setIsLoadingCases(false);
        }
      }
    };

    loadCases();

    return () => {
      isActive = false;
    };
  }, [authToken, handleSessionExpired]);

  // Resume file validation
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
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // Run resume screening
  const handleScreen = async () => {
    if (!resume || !selectedCaseId) {
    setError('Please select a recruitment case and upload a resume.');
    return;
  }

    setIsScreening(true);
    setError('');
    setEvaluation(null);

    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('caseId', selectedCaseId);

    try {
      const response = await fetch(
  `${API_URL}/screen`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`
    },
    body: formData
  }
);

// Read cache status from backend response.
const cacheStatus = response.headers.get('X-Screening-Cache');

if (cacheStatus === 'HIT') {
  console.info('🟡 [ZenVett Cache] CACHE HIT - Reusing previous result.');
} else if (cacheStatus === 'MISS') {
  console.info('🟢 [ZenVett Cache] CACHE MISS - Fresh screening executed.');
} else {
  console.warn('[ZenVett Cache] Cache status unavailable.');
}

const data = await response.json();

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || 'Screening failed. Please try again.'
        );
      }

      if (!data.result) {
        throw new Error(
          'The server did not return an evaluation.'
        );
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


// Open a previously saved screening result
const handleViewSavedResult = (record) => {
  if (!record.result) {
    setHistoryError('No saved evaluation is available for this candidate.');
    return;
  }

  setEvaluation(record.result);
  setResume(null);
  setError('');
  setShowComparison(false);
  setShowHistory(false);
};


// Fetch only the logged-in recruiter's history

const fetchScreeningHistory = async () => {
  if (!selectedCaseId) {
    setHistoryError('Please select a recruitment case first.');
    setScreeningHistory([]);
    return;
  }

  setIsLoadingHistory(true);
  setHistoryError('');

  try {
    const response = await fetch(
      `${API_URL}/screenings?caseId=${encodeURIComponent(selectedCaseId)}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error || 'Failed to load screening history.'
      );
    }

    if (!Array.isArray(data.screenings)) {
      throw new Error('Unexpected screening history response.');
    }

    setScreeningHistory(data.screenings);
    setSelectedCandidates([]);
    setShowComparison(false);

  } catch (err) {
    setHistoryError(
      err.message || 'Could not load screening history.'
    );
    setScreeningHistory([]);
  } finally {
    setIsLoadingHistory(false);
  }
};


  // Update a candidate's shortlisting status
  const handleStatusChange = async (screeningId, newStatus) => {
    if (!selectedCaseId) {
      setHistoryError('Please select a recruitment case.');
      return;
    }

    setIsUpdatingStatus(true);
    setHistoryError('');

    try {
      const response = await fetch(
        `${API_URL}/screenings/${screeningId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            caseId: selectedCaseId,
            status: newStatus
          })
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || 'Could not update candidate status.'
        );
      }

      setScreeningHistory((current) =>
        current.map((record) =>
          record._id === screeningId
            ? { ...record, status: data.screening.status }
            : record
        )
      );

    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };


// Delete a candidate screening record
const handleDeleteScreening = async (screeningId) => {
  const confirmed = window.confirm(
    'Are you sure you want to permanently delete this screening record?'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/screenings/${screeningId}?caseId=${encodeURIComponent(selectedCaseId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error || 'Could not delete screening record.'
      );
    }

    // Remove the deleted candidate from the current history
    setScreeningHistory((current) =>
      current.filter((record) => record._id !== screeningId)
    );

    // Remove the candidate from comparison selection
    setSelectedCandidates((current) =>
      current.filter((id) => id !== screeningId)
    );

    setHistoryError('');

  } catch (error) {
    setHistoryError(error.message);
  }
};


  // Candidate comparison helpers
  const toggleCandidateSelection = (recordId) => {
    setSelectedCandidates((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : current.length < 4
          ? [...current, recordId]
          : current
    );
  };

  const candidatesToCompare = screeningHistory.filter((record) =>
    selectedCandidates.includes(record._id)
  );

  // Rank candidates within the currently selected recruitment case
  const rankedScreeningHistory = [...screeningHistory].sort(
    (a, b) =>
      Number(b.result?.score ?? 0) -
      Number(a.result?.score ?? 0)
  );
  const filteredRankedScreeningHistory =
  rankedScreeningHistory.filter((record) => {
    const currentStatus = record.status || 'Under Review';

    return (
      statusFilter === 'All' ||
      currentStatus === statusFilter
    );
  });


  const getCandidateRequirements = (record) =>
    Array.isArray(record.result?.requirements)
      ? record.result.requirements
      : [];

  const getRequirementKey = (item) =>
    String(item.requirement || item.name || '').trim().toLowerCase();

  const comparisonRequirements = [
    ...new Map(
      candidatesToCompare
        .flatMap(getCandidateRequirements)
        .filter((item) => getRequirementKey(item))
        .map((item) => [getRequirementKey(item), item])
    ).values()
  ];


  // Login / registration screen
  if (!authToken) {
    return (
      <div className="auth-page">
        <div className="auth-card">

          <div className="brand-mark">ZV</div>

          <h1>ZenVett</h1>

          <p className="auth-subtitle">
            Clarity in Screening. Clearer Hiring Decisions.
          </p>

          <div className="auth-heading">
            <h2>
              {authMode === 'login'
                ? 'Welcome back'
                : 'Create your account'}
            </h2>

            <p className="auth-description">
              {authMode === 'login'
                ? 'Sign in to continue to your recruitment workspace.'
                : 'Set up your recruiter profile to get started with ZenVett.'}
            </p>
          </div>

          <form onSubmit={handleAuth}>

            {authMode === 'register' && (
              <>
                <div className="auth-field">
                  <label htmlFor="auth-fullname">
                    Full Name
                  </label>

                  <input
                    id="auth-fullname"
                    type="text"
                    value={authFullName}
                    onChange={(e) =>
                      setAuthFullName(e.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-company">
                    Company Name
                  </label>

                  <input
                    id="auth-company"
                    type="text"
                    value={authCompanyName}
                    onChange={(e) =>
                      setAuthCompanyName(e.target.value)
                    }
                    placeholder="Enter your company name"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-role">
                    Recruiter Role
                  </label>

                  <select
                    id="auth-role"
                    value={authRecruiterRole}
                    onChange={(e) =>
                      setAuthRecruiterRole(e.target.value)
                    }
                    required
                  >
                    <option value="" disabled>
                      Select your role
                    </option>
                    <option value="Recruiter">
                      Recruiter
                    </option>
                    <option value="HR Manager">
                      HR Manager
                    </option>
                    <option value="Talent Acquisition Specialist">
                      Talent Acquisition Specialist
                    </option>
                    <option value="Hiring Manager">
                      Hiring Manager
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </div>
              </>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">
                Work Email
              </label>

              <input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) =>
                  setAuthEmail(e.target.value)
                }
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">
                Password
              </label>

              <div className="auth-password-field">
                <input
                  id="auth-password"
                  type={showAuthPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) =>
                    setAuthPassword(e.target.value)
                  }
                  placeholder="At least 8 characters"
                  minLength={8}
                  autoComplete={
                    authMode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowAuthPassword((current) => !current)
                  }
                >
                  {showAuthPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {authMode === 'register' && (
                <p className="auth-field-hint">
                  Use at least 8 characters.
                </p>
              )}
            </div>

            {authMode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-confirm-password">
                  Confirm Password
                </label>

                <div className="auth-password-field">
                  <input
                    id="auth-confirm-password"
                    type={showAuthPassword ? 'text' : 'password'}
                    value={authConfirmPassword}
                    onChange={(e) =>
                      setAuthConfirmPassword(e.target.value)
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() =>
                      setShowAuthPassword((current) => !current)
                    }
                  >
                    {showAuthPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={isAuthenticating}
            >
              {isAuthenticating
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </button>

          </form>

          <div className="auth-switch">
            <span>
              {authMode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}
            </span>

            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === 'login'
                    ? 'register'
                    : 'login'
                );
                setAuthError('');
                setAuthPassword('');
                setAuthConfirmPassword('');
                setShowAuthPassword(false);
              }}
            >
              {authMode === 'login'
                ? 'Create account'
                : 'Sign in'}
            </button>
          </div>

          <p className="auth-footer">
            A clearer way to evaluate candidates.
          </p>

        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">ZV</div>

          <div>
            <div className="brand-name">
              ZenVett
            </div>

            <div className="brand-subtitle">
              Clarity in Screening. Clearer Hiring Decisions.
            </div>
          </div>
        </div>

       <div className="topbar-right">
  <span className="account-email">
    {currentUser?.email}
  </span>

  <button
    type="button"
    className="history-nav-button"
    onClick={() => {
      if (!showHistory) {
        fetchScreeningHistory();
      }

      setShowHistory(!showHistory);
    }}
  >
    <span className="history-icon">◷</span>
    {showHistory ? 'Back to screening' : 'Screening History'}
  </button>

  <button
    type="button"
    className="logout-button"
    onClick={handleLogout}
  >
    Log out
  </button>

  <span className="live-dot"></span>

  <span className="engine-status">
    {isScreening
      ? 'Screening in progress'
      : 'Screening engine ready'}
  </span>
</div>
      </header>

      {showHistory && (
        <section className="page screening-history">
          <div className="result-heading">
            <div>
              <h2>Screening History</h2>
              <p>Select up to four candidates to compare their screening results.</p>
<span className="history-count">
  Showing {filteredRankedScreeningHistory.length} of {screeningHistory.length} candidates
</span>
            </div>
            <div className="status-filter">
              <label htmlFor="status-filter">
               FILTER BY STATUS
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Candidates</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Rejected">Rejected</option>
                </select>
            </div>

            <div className="comparison-actions">
              <button
                type="button"
                onClick={() => setShowComparison((value) => !value)}
                disabled={selectedCandidates.length < 2}
              >
                {showComparison ? 'Hide comparison' : `Compare (${selectedCandidates.length})`}
              </button>
              <button
                type="button"
                onClick={fetchScreeningHistory}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {historyError && (
            <p role="alert">{historyError}</p>
          )}


{isLoadingHistory && (
  <div className="history-empty-state">
    <p>Loading screening history...</p>
  </div>
)}

{!isLoadingHistory &&
  !historyError &&
  screeningHistory.length === 0 && (
    <div className="history-empty-state">
      <h3>No screening records yet</h3>
      <p>
        Completed resume screenings will appear here.
      </p>
    </div>
  )}

{!isLoadingHistory &&
  !historyError &&
  screeningHistory.length > 0 &&
  filteredRankedScreeningHistory.length === 0 && (
    <div className="history-empty-state">
      <h3>No matching candidates</h3>
      <p>
        No candidates match the selected status filter.
        Try selecting another status.
      </p>
    </div>
  )}


           {filteredRankedScreeningHistory.map((record, index) => (
            <article
  className={`history-item ...`}
  key={record._id}
  onClick={() => handleViewSavedResult(record)}
  onKeyDown={(e) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleViewSavedResult(record);
    }
  }}
  tabIndex={0}
  role="button"
  aria-label={`View saved screening results for ${record.fileName}`}
>
<div className="candidate-rank">
  <span>RANK</span>
  <strong>#{index + 1}</strong>
</div>

              <label
  className="candidate-select"
  onClick={(e) => e.stopPropagation()}
>
                <input
                  type="checkbox"
                  checked={selectedCandidates.includes(record._id)}
                  onChange={() => toggleCandidateSelection(record._id)}
                  disabled={!selectedCandidates.includes(record._id) && selectedCandidates.length >= 4}
                />
                <span>Select</span>
              </label>


<div className="history-record-info">
  <strong>{record.fileName || 'Unnamed candidate'}</strong>

  <p className="history-date">
    Screened on{' '}
    {record.createdAt
      ? new Date(record.createdAt).toLocaleString()
      : 'Date unavailable'}
  </p>

  <p className="history-summary">
    {record.result?.summary || 'Screening evaluation completed.'}
  </p>
</div>


<div className="candidate-status-control">
  <label htmlFor={`status-${record._id}`}>
    STATUS
  </label>

  <select
    id={`status-${record._id}`}
    value={record.status || 'Under Review'}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) =>
      handleStatusChange(record._id, e.target.value)
    }
    disabled={isUpdatingStatus}
  >
    <option value="Under Review">Under Review</option>
    <option value="Shortlisted">Shortlisted</option>
    <option value="Rejected">Rejected</option>
  </select>
</div>



<div className="history-score-wrap">
  <strong className="history-score">
    {Number(record.result?.score ?? 0).toFixed(2)}
    <span>/100</span>
  </strong>

  <div
    className="history-score-track"
    role="progressbar"
    aria-label="Candidate screening score"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.min(
      100,
      Math.max(0, Number(record.result?.score ?? 0))
    )}
  >
    <div
      className="history-score-fill"
      style={{
        width: `${Math.min(
          100,
          Math.max(0, Number(record.result?.score ?? 0))
        )}%`
      }}
    />
  </div>
</div>


<button
  type="button"
  className="delete-screening-button"
  onClick={(e) => {
  e.stopPropagation();
  handleDeleteScreening(record._id);
}}
>
  Delete
</button>

            </article>
          ))}

          {showComparison && candidatesToCompare.length >= 2 && (
            <section className="candidate-comparison">
              <div className="comparison-title-row">
                <div>
                  <span className="section-number">05</span>
                  <h2>Candidate comparison</h2>
                  <p>Compare the saved screening results side by side.</p>
                </div>
                <button type="button" onClick={() => setSelectedCandidates([])}>
                  Clear selection
                </button>
              </div>

              <div className="comparison-grid">
                {candidatesToCompare.map((record) => {
                  const result = record.result || {};
                  const breakdown = result.breakdown || {};
                  return (
                    <article className="comparison-card" key={record._id}>
                      <h3>{record.fileName || 'Candidate'}</h3>
                      <div className="comparison-score">
                        {Number(result.score ?? 0).toFixed(2)}<small>/100</small>
                      </div>
                      <div className="comparison-metrics">
                        {[
  ['Skills', 'skills'],
  ['Experience', 'experience'],
  ['Education', 'education'],
  ['Projects', 'projects']
].map(([label, category]) => {
  const applicable =
    result.category_applicable?.[category] ??
    breakdown[category] != null;

  const value = breakdown[category];

  const max =
    result.category_maximums?.[category] ??
    ({
      skills: 40,
      experience: 30,
      education: 15,
      projects: 15
    }[category]);

  return (
    <div className="comparison-metric" key={category}>
      <span>{label}</span>
      <strong>
        {applicable
          ? `${Number(value).toFixed(1)}/${max}`
          : 'N/A'}
      </strong>
    </div>
  );
})}
                      </div>
                      <div className="comparison-skills">
                        <h4>Matched skills</h4>
                        <p>{result.matched_skills?.length ? result.matched_skills.join(', ') : 'Not available'}</p>
                        <h4>Missing skills</h4>
                        <p>{result.missing_skills?.length ? result.missing_skills.join(', ') : 'None reported'}</p>
                      </div>
                      <p className="comparison-date">
                        {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : ''}
                      </p>
                    </article>
                  );
                })}
              </div>

              {comparisonRequirements.length > 0 && (
                <div className="comparison-requirements-wrap">
                  <h3>Requirement-by-requirement comparison</h3>
                  <div className="comparison-table-scroll">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Requirement</th>
                          {candidatesToCompare.map((record) => (
                            <th key={record._id}>{record.fileName || 'Candidate'}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRequirements.map((requirement) => (
                          <tr key={getRequirementKey(requirement)}>
                            <td>{requirement.requirement || requirement.name}</td>
                            {candidatesToCompare.map((record) => {
                              const match = getCandidateRequirements(record).find(
                                (item) => getRequirementKey(item) === getRequirementKey(requirement)
                              );
                              return (
                                <td key={record._id}>
                                  {match ? (
                                    <>
                                      <strong className={`comparison-status ${String(match.status || '').toLowerCase()}`}>
                                        {match.status || 'Assessed'}
                                      </strong>
                                      {match.semantic_evidence_relevant && match.semantic_evidence && (
                                        <p className="comparison-evidence">{match.semantic_evidence}</p>
                                      )}
                                    </>
                                  ) : 'Not assessed'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <p className="comparison-disclaimer">Comparison is based on saved AI screening results. Review original resumes before making hiring decisions.</p>
            </section>
          )}
        </section>
      )}

      <main className="page">
        <section className="intro">
          <div>
            <p className="eyebrow">
              NEW SCREENING
            </p>

            <h1>
              Find the right
              <br />
              <em>signal</em> in every CV.
            </h1>

            <p className="intro-text">
              Give us the role. We'll compare the candidate
              against what actually matters.
            </p>
          </div>

          <div className="case-number">
            <span>CASE</span>
            <strong>
              {String(
                jobCases.findIndex(
                  (jobCase) => jobCase._id === selectedCaseId
              ) + 1
            ).padStart(2, '0')}
            </strong>
          </div>
        </section>
                {/* Recruitment Case Management */}
        <section className="case-management">
          <div className="case-management-header">
            <div>
              <span className="eyebrow">RECRUITMENT WORKSPACE</span>
              <h2>Manage your hiring cases</h2>
              <p>Select an existing role or create a new recruitment case.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCaseForm((value) => !value);
                setCaseError('');
              }}
            >
              {showCaseForm ? 'Cancel' : '+ Create New Case'}
            </button>
          </div>

          {caseError && (
            <p role="alert" className="screening-error">
              {caseError}
            </p>
          )}

          {showCaseForm && (
            <form
              className="new-case-form"
              onSubmit={handleCreateCase}
            >
              <h3>Create Recruitment Case</h3>

              <label htmlFor="new-case-title">
                Job Title
              </label>

              <input
                id="new-case-title"
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                placeholder="e.g. Frontend Developer"
                required
              />

              <label htmlFor="new-case-description">
                Job Description
              </label>

              <textarea
                id="new-case-description"
                value={newCaseDescription}
                onChange={(e) => setNewCaseDescription(e.target.value)}
                placeholder="Enter the complete job description and requirements..."
                required
              />

              <button
                type="submit"
                disabled={isSavingCase}
              >
                {isSavingCase ? 'Creating...' : 'Save Recruitment Case'}
              </button>
            </form>
          )}


<div className="case-selector">
  <label htmlFor="case-select">
    SELECT RECRUITMENT CASE
  </label>

  {isLoadingCases ? (
    <p>Loading your recruitment cases...</p>
  ) : jobCases.length === 0 ? (
    <p>No recruitment cases found. Create your first case.</p>
  ) : (
    <select
      id="case-select"
      value={selectedCaseId}
      onChange={(e) => {
        const selectedCase = jobCases.find(
          (item) => item._id === e.target.value
        );

        setSelectedCaseId(e.target.value);
        setScreeningHistory([]);
        setSelectedCandidates([]);
        setShowComparison(false);
        setHistoryError('');

        if (selectedCase) {
          setJobTitle(selectedCase.jobTitle);
          setJobDescription(selectedCase.jobDescription);
          setResume(null);
          setEvaluation(null);
          setError('');
        }
      }}
    >
      <option value="">Choose a recruitment case</option>

      {jobCases.map((item, index) => (
        <option key={item._id} value={item._id}>
          {`CASE-${String(index + 1).padStart(2, '0')} — ${item.jobTitle} — ${item.status}`}
        </option>
      ))}
    </select>
  )}
</div>

        </section>

        <section className="workspace-grid">
          <div className="panel brief-panel">
            <div className="panel-heading">
              <div>
                <span className="section-number">
                  01
                </span>

                <h2>Role brief</h2>
              </div>

              <span className="required">
                REQUIRED
              </span>
            </div>

            <label htmlFor="job-title">
              What are you hiring for?
            </label>

            <input
              id="job-title"
              className="role-input"
              value={jobTitle}
              onChange={(e) =>
                setJobTitle(e.target.value)
              }
              placeholder="e.g. Frontend Developer"
            />

           <div className="jd-label-row">
             <label htmlFor="job-description">
               Job Description & Requirements
             </label>

             <button
             type="button"
             className="jd-guide-trigger"
             onClick={() => setShowJdGuide(true)}
            >
             JD WRITING TIPS ↗
             </button>
            </div>

            <p className="field-hint">
              Describe the role in your own words, or
              paste a complete job description. The AI
              will identify relevant requirements automatically.
            </p>



            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) =>
                setJobDescription(e.target.value)
              }
              placeholder={`We are looking for a Full Stack Developer to build, improve and maintain scalable web applications.

Essential Skills:
- Strong knowledge of JavaScript and React.js
- Experience with Node.js and Express.js
- Working knowledge of MongoDB and REST APIs
- Understanding of frontend and backend development

Experience:
- 1–2 years of relevant development experience
- Experience building and integrating web applications

Education:
- Bachelor's degree in Computer Science or a related field

Preferred Qualifications:
- Familiarity with Git and GitHub
- Understanding of deployment and cloud platforms
- Experience working in an agile development environment

Key Responsibilities:
- Develop responsive user interfaces
- Build and maintain backend APIs
- Integrate databases and third-party services
- Debug, test and optimise application performance`}
            />

            <div className="brief-footer">
              <span>
                {jobDescription.length} characters
              </span>

              <span>TEXT ANALYSIS ENABLED</span>
            </div>
          </div>
          {showJdGuide && (
  <div
    className="jd-modal-overlay"
    onClick={() => setShowJdGuide(false)}
  >
    <div
      className="jd-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jd-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="jd-modal-header">
        <div>
          <span className="jd-modal-eyebrow">
            A QUICK GUIDE
          </span>

          <h2 id="jd-modal-title">
            Write a brief that finds the right talent.
          </h2>
        </div>

        <button
          type="button"
          className="jd-modal-close"
          onClick={() => setShowJdGuide(false)}
          aria-label="Close guide"
        >
          ×
        </button>
      </div>

      <p className="jd-modal-intro">
        A well-defined job description helps our
        screening engine evaluate candidates more
        consistently. Here's what to include:
      </p>

      <div className="jd-tip-list">
        <div className="jd-tip">
          <span>01</span>
          <div>
            <strong>Essential skills</strong>
            <p>List the required programming languages,
            technologies, frameworks and tools.</p>
          </div>
        </div>

        <div className="jd-tip">
          <span>02</span>
          <div>
            <strong>Experience</strong>
            <p>Mention the expected years of experience
            and relevant responsibilities.</p>
          </div>
        </div>

        <div className="jd-tip">
          <span>03</span>
          <div>
            <strong>Education</strong>
            <p>Specify relevant degrees or qualifications,
            if required for the role.</p>
          </div>
        </div>

        <div className="jd-tip">
          <span>04</span>
          <div>
            <strong>Projects & responsibilities</strong>
            <p>Describe the practical work and projects
            the candidate is expected to handle.</p>
          </div>
        </div>

        <div className="jd-tip">
          <span>05</span>
          <div>
            <strong>Preferred skills</strong>
            <p>Separate additional desirable skills
            from mandatory requirements.</p>
          </div>
        </div>
      </div>

      <div className="jd-modal-tip">
        <strong>THE KEY TO BETTER MATCHES</strong>
        <p>
          Be specific. Instead of "Good knowledge of
          React", write "Experience building responsive
          applications using React."
        </p>
      </div>

      <button
        type="button"
        className="jd-modal-done"
        onClick={() => setShowJdGuide(false)}
      >
        Got it
      </button>
    </div>
  </div>
)}

          <div className="panel candidate-panel">
            <div className="panel-heading">
              <div>
                <span className="section-number">
                  02
                </span>

                <h2>Candidate</h2>
              </div>

              <span className="optional">
                PDF / DOCX
              </span>
            </div>

            <input
              id="resume-input"
              type="file"
              accept=".pdf,.docx"
              hidden
              onChange={(e) =>
                handleFile(e.target.files[0])
              }
            />

            {!resume ? (
              <label
                htmlFor="resume-input"
                className={`dropzone ${
                  isDragging ? 'dragging' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() =>
                  setIsDragging(false)
                }
                onDrop={handleDrop}
              >
                <div className="drop-symbol">
                  ↳
                </div>

                <div className="drop-title">
                  Drop candidate CV here
                </div>

                <div className="drop-description">
                  or click to browse your files
                </div>

                <div className="file-rule">
                  MAX 5MB · PDF / DOCX
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
                    {(resume.size / 1024 / 1024).toFixed(2)}
                    {' '}MB · Ready
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
                Your resume is parsed first. Only the
                extracted information is passed to the
                screening engine.
              </p>
            </div>
          </div>
        </section>

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
            type="button"
            className="screen-button"
            disabled={
              !resume ||
              !selectedCaseId ||
              isScreening
            }
            onClick={handleScreen}
          >
            <span>
              {isScreening
                ? 'Screening...'
                : 'Run screening'}
            </span>

            <span className="arrow">
              {isScreening ? '…' : '→'}
            </span>
          </button>
        </section>

        {error && (
          <div
            role="alert"
            className="screening-error"
          >
            <strong>Screening error</strong>
            <p>{error}</p>
          </div>
        )}

        <section className="preview-result">
          <div className="result-heading">
            <div>
              <span className="section-number">
                03
              </span>

              <h2>Candidate evaluation</h2>
            </div>

            <span className="coming-soon">
              {evaluation
                ? 'SCREENING COMPLETE'
                : 'AWAITING SCREENING'}
            </span>
          </div>

          {!evaluation ? (
            <div className="result-placeholder">
              <div className="placeholder-score">
                <span>
                  {isScreening ? '…' : '—'}
                </span>
              </div>

              <div>
                <h3>
                  {isScreening
                    ? 'Evaluating candidate...'
                    : 'Your screening result will appear here.'}
                </h3>

                <p>
                  Match score, skill alignment, missing
                  requirements, candidate summary and recommendation.
                </p>
              </div>
            </div>
          ) : (
            <div className="evaluation-content">
              <div className="evaluation-score">
                <span className="evaluation-label">
                  MATCH SCORE
                </span>

                <strong>
                  {evaluation.score}
                  <small>/100</small>
                </strong>
              </div>

              <h3>Score breakdown</h3>

             <div className="score-breakdown">
  {[
    ['Skills Match', 'skills'],
    ['Experience Relevance', 'experience'],
    ['Education Fit', 'education'],
    ['Project Relevance', 'projects']
  ].map(([label, category]) => {
    const applicable =
      evaluation.category_applicable?.[category] ??
      evaluation.breakdown?.[category] != null;

    const score = evaluation.breakdown?.[category];

    const maximum =
      evaluation.category_maximums?.[category] ??
      ({
        skills: 40,
        experience: 30,
        education: 15,
        projects: 15
      }[category]);

    const percentage = applicable
      ? (Number(score) / maximum) * 100
      : 0;

    return (
      <div className="score-row" key={category}>
        <div className="score-row-label">
          <span>{label}</span>
          <strong>
            {applicable
              ? `${Number(score).toFixed(2)}/${maximum}`
              : 'N/A'}
          </strong>
        </div>

        {applicable && (
          <div className="score-track">
            <div
              className="score-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  })}
</div>

              <div className="skill-columns">
                <div>
                  <h3>Matched skills</h3>

                  {evaluation.matched_skills?.length ? (
                    <ul>
                      {evaluation.matched_skills.map(
                        (skill, index) => (
                          <li key={`${skill}-${index}`}>
                            {skill}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p>No matched skills returned.</p>
                  )}
                </div>

                <div>
                  <h3>Missing skills</h3>

                  {evaluation.missing_skills?.length ? (
                    <ul>
                      {evaluation.missing_skills.map(
                        (skill, index) => (
                          <li key={`${skill}-${index}`}>
                            {skill}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p>No missing skills reported.</p>
                  )}
                </div>
              </div>

              {Array.isArray(evaluation.requirements) &&
                evaluation.requirements.length > 0 && (

<section className="semantic-analysis">
  <div className="semantic-heading">
    <div>
      <span className="section-number">04</span>
      <h2>Semantic requirement analysis</h2>
    </div>

    <span className="semantic-caption">
      RESUME EVIDENCE REVIEW
    </span>
  </div>

  <p className="semantic-intro">
    Review how each job requirement is supported by
    information found in the candidate's resume.
    Similarity is supporting evidence, not a hiring decision.
  </p>

  <div className="semantic-list">
    {evaluation.requirements.map((item, index) => {
      const evidenceItems = Array.isArray(item.evidence)
  ? item.evidence.filter(
      (entry) =>
        entry &&
        typeof entry.evidence_quote === 'string' &&
        entry.evidence_quote.trim()
    )
  : [];

const semanticEvidence =
  typeof item.semantic_evidence === 'string'
    ? item.semantic_evidence.trim()
    : '';

const hasSemanticEvidence =
  item.semantic_evidence_relevant &&
  Boolean(semanticEvidence);

const hasEvidence =
  evidenceItems.length > 0 || hasSemanticEvidence;

      const status = String(
        item.status || 'unassessed'
      ).toLowerCase();

      return (
        <article
          className="semantic-item"
          key={`${item.name || item.requirement || 'requirement'}-${index}`}
        >
          <div className="semantic-item-top">
            <div className="semantic-requirement">
              <span className="semantic-requirement-number">
                REQUIREMENT {String(index + 1).padStart(2, '0')}
              </span>

              <h3>
                {item.name ||
                  item.requirement ||
                  `Requirement ${index + 1}`}
              </h3>

              <div className="semantic-meta">
                {item.category && (
                  <span>{item.category}</span>
                )}

                {item.importance && (
                  <span>{item.importance}</span>
                )}
              </div>
            </div>

            <span className={`semantic-status ${status}`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="semantic-evidence">
  <strong>
    {hasEvidence
      ? 'Supporting resume evidence'
      : 'No reliable evidence found'}
  </strong>

  {evidenceItems.length > 0 ? (
    evidenceItems.map((entry, evidenceIndex) => (
      <p key={evidenceIndex}>
        <strong>
          {String(entry.source_section || 'resume')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())}
          :
        </strong>{' '}
        "{entry.evidence_quote}"
      </p>
    ))
  ) : (
    <p>
      {hasSemanticEvidence
       ? semanticEvidence
       : 'The system could not identify sufficiently relevant supporting text in the resume.'}
    </p>
  )}
</div>
        </article>
      );
    })}
  </div>
</section>

                )}

              <h3>ZenVett Insights</h3>

              <p className="evaluation-summary">
                {evaluation.summary}
              </p>

              <p className="evaluation-disclaimer">
                AI-assisted evaluation only. A human
                should review the resume and make the
                final hiring decision.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>ZENVETT</span>
        <span>INTELLIGENT SCREENING · HUMAN DECISION</span>
        <span>v0.1</span>
      </footer>
    </div>
  );
}

export default App;
