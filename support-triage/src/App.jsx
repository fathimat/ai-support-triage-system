
import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const initialTickets = [
  {
    id: 1001,
    title: 'Application returns 500 error',
    description: 'Users cannot access the application after deployment.',
    category: 'Application',
    priority: 'Critical',
    status: 'Open',
  },
  {
    id: 1002,
    title: 'Password reset not working',
    description: 'I cannot reset my password using the reset link.',
    category: 'Access',
    priority: 'Medium',
    status: 'Open',
  },
  {
    id: 1003,
    title: 'Database response is slow',
    description: 'Queries are taking too long to return results.',
    category: 'Database',
    priority: 'High',
    status: 'In Progress',
  },
]

function classifyTicket(title, description) {
  const text = `${title} ${description}`.toLowerCase()

  let category = 'General'

  if (/database|sql|query|postgres|oracle/.test(text)) {
    category = 'Database'
  } else if (/network|connection|vpn|dns|internet/.test(text)) {
    category = 'Network'
  } else if (/application|app |server|error|crash|deploy|api/.test(text)) {
    category = 'Application'
  } else if (/password|login|access|permission|account/.test(text)) {
    category = 'Access'
  }

  let priority = 'Low'
  if (/all users|production down|system down|outage|critical/.test(text)) {
    priority = 'Critical'
  } else if (/500 error|server error|database down|cannot access|not working/.test(text)) {
    priority = 'High'
  } else if (/slow|failed|failure|unable|error|issue|problem/.test(text)) {
    priority = 'Medium'
  }

  return { category, priority }
}

function App() {

  const [tickets, setTickets] = useState(() => {
    try {
      const savedTickets = localStorage.getItem('support-triage-tickets')
      return savedTickets ? JSON.parse(savedTickets) : initialTickets
    } catch {
      return initialTickets
    }
  })

  const [loadingTickets, setLoadingTickets] = useState(true)
  const [databaseError, setDatabaseError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)

  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const aiRequestId = useRef(0)
  const [analyzedDescription, setAnalyzedDescription] = useState('')
  const [aiError, setAiError] = useState('')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Default')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [editingTicket, setEditingTicket] = useState(null)


  const analyzeWithAI = async () => {
    if (!description.trim()) {
      setAiError('Please enter a ticket description first.')
      setAiAnalysis(null)
      return
    }

    const requestId = ++aiRequestId.current
    const currentDescription = description.trim()

    setAnalyzingAI(true)
    setAiError('')
    setAiAnalysis(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: currentDescription,
        }),
      })

      if (!response.ok) {
        throw new Error('AI analysis failed. Please try again.')
      }

      const data = await response.json()

      if (requestId !== aiRequestId.current) {
        return
      }

      setAiAnalysis(data.analysis)
      setAnalyzedDescription(currentDescription)

    } catch (error) {
      if (requestId === aiRequestId.current) {
        setAiError(error.message)
      }
    } finally {
      if (requestId === aiRequestId.current) {
        setAnalyzingAI(false)
      }
    }
  }


  const loadTickets = () => {
    setLoadingTickets(true)
    setDatabaseError('')

    fetch(`${API_BASE_URL}/api/tickets`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load tickets from the database')
        }
        return response.json()
      })
      .then((data) => {
        setTickets(data)
      })
      .catch((error) => {
        setDatabaseError(error.message)
      })
      .finally(() => {
        setLoadingTickets(false)
      })
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function createTicket(event) {
    event.preventDefault()

    setFormSuccess('')

    if (!title.trim() || !description.trim()) {
      setFormError('Please enter both a ticket title and issue description.')
      return
    }

    setFormError('')


    const ruleBasedResult = classifyTicket(title, description)

    const validCategories = ['Application', 'Database', 'Network', 'Access', 'General']
    const validPriorities = ['Low', 'Medium', 'High', 'Critical']

    const hasValidAiAnalysis =
      aiAnalysis &&
      analyzedDescription === description &&
      validCategories.includes(aiAnalysis.category) &&
      validPriorities.includes(aiAnalysis.priority)

    const result = hasValidAiAnalysis
      ? {
        ...ruleBasedResult,
        category: aiAnalysis.category,
        priority: aiAnalysis.priority,
      }
      : ruleBasedResult


    const newTicket = {
      title: title.trim(),
      description: description.trim(),
      ...result,
      status: 'Open',
    }

    setSavingTicket(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTicket),
      })

      if (!response.ok) {
        throw new Error('Failed to save ticket to the database')
      }

      const savedTicket = await response.json()

      setTickets((current) => [savedTicket, ...current])

      setTitle('')
      setDescription('')
      setAiAnalysis(null)
      setAnalyzedDescription('')
      setAiError('')

      setFormError('')
      setFormSuccess(`Ticket #${savedTicket.id} created successfully!`)

      setDatabaseError('')
      console.log('Ticket saved to PostgreSQL:', savedTicket.id)

    } catch (error) {
      setFormError('Unable to create ticket. Please check that the backend is running and try again.')
      setFormSuccess('')
      console.error('Could not save ticket:', error)
    } finally {
      setSavingTicket(false)
    }
  }


  async function updateStatus(id, status) {
    const ticket = tickets.find((item) => item.id === id)

    if (!ticket) return

    const updatedTicket = { ...ticket, status }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTicket),
      })

      if (!response.ok) {
        throw new Error('Failed to update ticket in the database')
      }

      const savedTicket = await response.json()

      setTickets((current) =>
        current.map((item) => (item.id === id ? savedTicket : item))
      )

      setDatabaseError('')
    } catch (error) {
      setDatabaseError(error.message)
      console.error('Could not update ticket:', error)
    }
  }

  async function deleteTicket(id) {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this ticket? This action cannot be undone.'
    )

    if (!confirmDelete) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete ticket from the database')
      }

      setTickets((current) =>
        current.filter((ticket) => ticket.id !== id)
      )

      setDatabaseError('')
    } catch (error) {
      setDatabaseError(error.message)
      console.error('Could not delete ticket:', error)
    }
  }

  const saveEditedTicket = async () => {
    if (!editingTicket) return

    if (!editingTicket.title?.trim() || !editingTicket.description?.trim()) {
      alert('Title and description are required.')
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tickets/${editingTicket.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...editingTicket,
            title: editingTicket.title.trim(),
            description: editingTicket.description.trim(),
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update ticket')
      }

      await loadTickets()
      setEditingTicket(null)

      alert('Ticket updated successfully!')
    } catch (error) {
      console.error('Error updating ticket:', error)
      alert('Unable to update ticket. Please try again.')
    }
  }

  const priorityOrder = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  }

  const visibleTickets = tickets
    .filter((ticket) => {
      const matchesSearch =
        `${ticket.title} ${ticket.description} ${ticket.category}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchesFilter = filter === 'All' || ticket.status === filter

      const matchesPriority =
        priorityFilter === 'All' || ticket.priority === priorityFilter

      const matchesCategory =
        categoryFilter === 'All' || ticket.category === categoryFilter

      return matchesSearch && matchesFilter && matchesPriority && matchesCategory
    })
    .sort((a, b) => {
      if (sortBy === 'Highest Priority') {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }

      if (sortBy === 'Lowest Priority') {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }

      return 0
    })

  const criticalCount = tickets.filter(
    (ticket) => ticket.priority === 'Critical'
  ).length
  const openCount = tickets.filter(
    (ticket) => ticket.status === 'Open'
  ).length
  const progressCount = tickets.filter(
    (ticket) => ticket.status === 'In Progress'
  ).length

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === 'Resolved'
  ).length

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">ST</div>
          <div>
            <h1>Support Triage</h1>
            <p>Intelligent ticket management</p>
          </div>
        </div>
        <span className="local-badge">● Live demo</span>
      </header>

      <section className="welcome">
        <p className="eyebrow">SUPPORT OPERATIONS</p>
        <h2>Ticket Dashboard</h2>
        <p>Identify, prioritise and manage support issues in one place.</p>
      </section>

      <section className="stats">
        <article className="stat-card">
          <span>Total tickets</span>
          <strong>{databaseError ? '—' : tickets.length}</strong>
        </article>
        <article className="stat-card">
          <span>Open tickets</span>
          <strong>{databaseError ? '—' : openCount}</strong>
        </article>
        <article className="stat-card">
          <span>Critical tickets</span>
          <strong>{databaseError ? '—' : criticalCount}</strong>
        </article>
        <article className="stat-card">
          <span>In progress</span>
          <strong>{databaseError ? '—' : progressCount}</strong>
        </article>
        <article className="stat-card">
          <span>Resolved tickets</span>
          <strong>{databaseError ? '—' : resolvedCount}</strong>
        </article>
      </section>

      <section className="content-grid">
        <form className="panel ticket-form" onSubmit={createTicket}>
          <h3>Create a ticket</h3>
          <p className="muted">Describe the issue. The triage engine will classify it.</p>

          {formError && (
            <p className="error-message" role="alert">
              {formError}
            </p>
          )}

          {formSuccess && (
            <p className="success-message" role="status">
              {formSuccess}
            </p>
          )}

          <label htmlFor="title">
            Ticket title <span className="required-star">*</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Application server is down"
            required
          />

          <label htmlFor="description">
            Issue description <span className="required-star">*</span>
          </label>
          <textarea
            id="description"
            value={description}

            onChange={(event) => {
              aiRequestId.current += 1
              setAnalyzingAI(false)
              setDescription(event.target.value)
              setAiAnalysis(null)
              setAiError('')
              setAnalyzedDescription('')
            }}

            placeholder="Explain what happened and who is affected..."
            rows={5}
            required
          />


          <button
            type="button"
            className="primary-button gemini-ai-button"
            onClick={analyzeWithAI}
            disabled={analyzingAI || savingTicket}
          >
            {analyzingAI ? 'Gemini AI is analyzing...' : '✨ Analyze with Gemini AI'}
          </button>

          {aiError && (
            <p className="error-message" role="alert">
              {aiError}
            </p>
          )}


          {aiAnalysis && (
            <div className="ai-analysis-result">
              <h4>Gemini AI Analysis</h4>

              <p><strong>Category:</strong> {aiAnalysis.category}</p>

              <p><strong>Priority:</strong> {aiAnalysis.priority}</p>

              <p><strong>Technical Summary:</strong></p>
              <p>{aiAnalysis.summary}</p>

              <p><strong>Suggested Troubleshooting Steps:</strong></p>
              <ul>
                {aiAnalysis.troubleshootingSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          )}



          <button
            className="primary-button create-ticket-button"
            type="submit"
            disabled={savingTicket || analyzingAI}
          >
            {savingTicket ? 'Creating ticket...' : '+ Analyse and create ticket'}
          </button>

          <p className="hint">Classification runs locally using predefined rules.</p>
        </form>

        <section className="panel ticket-list">
          <div className="list-heading">
            <div>
              <h3>Support tickets</h3>
              <p className="muted">
                {databaseError ? '— tickets displayed' : `${visibleTickets.length} tickets displayed`}
              </p>
            </div>
          </div>

          <div className="toolbar">
            <div className="filter-group search-group">
              <label htmlFor="ticket-search">Search Tickets</label>

              <input
                id="ticket-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets..."
              />
            </div>
            <div className="filter-group">
              <label htmlFor="status-filter">Status Filter</label>

              <select
                id="status-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="priority-filter">Priority Filter</label>

              <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="All">All</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="category-filter">Category Filter</label>

              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="All">All</option>
                <option value="Application">Application</option>
                <option value="Database">Database</option>
                <option value="Network">Network</option>
                <option value="Access">Access</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-filter">Sort By</label>

              <select
                id="sort-filter"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="Default">Default</option>
                <option value="Highest Priority">Highest Priority First</option>
                <option value="Lowest Priority">Lowest Priority First</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilter('All')
                setPriorityFilter('All')
                setCategoryFilter('All')
                setSortBy('Default')
              }}
            >
              Clear Filters
            </button>

          </div>

          {loadingTickets ? (
            <p>Loading tickets...</p>
          ) : databaseError ? (
            <div className="empty">
              <p>
                Unable to load tickets. Please check that the backend is running and try again.
              </p>
              <button
                type="button"
                onClick={loadTickets}
                disabled={loadingTickets}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="tickets">
              {visibleTickets.map((ticket) => (
                <article className="ticket" key={ticket.id}>
                  <div className="ticket-top">
                    <span className="ticket-id">#{ticket.id}</span>
                    <span className={`priority ${ticket.priority.toLowerCase()}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <h4>{ticket.title}</h4>
                  <p className="ticket-description">{ticket.description}</p>
                  <button
                    className="details-button"
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    View Details
                  </button>
                  <button
                    className="edit-button"
                    type="button"
                    onClick={() => setEditingTicket(ticket)}
                  >
                    Edit
                  </button>
                  <div className="ticket-footer">
                    <span className="category">{ticket.category}</span>
                    <select
                      aria-label={`Status for ${ticket.title}`}
                      value={ticket.status}
                      onChange={(event) =>
                        updateStatus(ticket.id, event.target.value)
                      }
                    >
                      <option>Open</option>
                      <option>In Progress</option>
                      <option>Resolved</option>
                    </select>
                    <button
                      className="delete-button"
                      type="button"
                      onClick={() => deleteTicket(ticket.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}

              {visibleTickets.length === 0 && (
                <p className="empty">
                  {tickets.length === 0
                    ? 'No tickets available. Create your first support ticket.'
                    : 'No matching tickets found. Try changing your search or filters.'}
                </p>
              )}
            </div>
          )}

          {editingTicket && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Edit Ticket</h2>

                <label htmlFor="edit-title">Ticket Title</label>
                <input
                  id="edit-title"
                  value={editingTicket.title ?? ''}
                  onChange={(event) =>
                    setEditingTicket({
                      ...editingTicket,
                      title: event.target.value,
                    })
                  }
                />

                <label htmlFor="edit-description">Issue Description</label>
                <textarea
                  id="edit-description"
                  value={editingTicket.description ?? ''}
                  onChange={(event) =>
                    setEditingTicket({
                      ...editingTicket,
                      description: event.target.value,
                    })
                  }
                  rows={5}
                />

                <label htmlFor="edit-priority">Priority</label>
                <select
                  id="edit-priority"
                  value={editingTicket.priority ?? 'Medium'}
                  onChange={(event) =>
                    setEditingTicket({
                      ...editingTicket,
                      priority: event.target.value,
                    })
                  }
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <label htmlFor="edit-category">Category</label>
                <select
                  id="edit-category"
                  value={editingTicket.category ?? 'Application'}
                  onChange={(event) =>
                    setEditingTicket({
                      ...editingTicket,
                      category: event.target.value,
                    })
                  }
                >
                  <option value="Application">Application</option>
                  <option value="Database">Database</option>
                  <option value="Network">Network</option>
                  <option value="Access">Access</option>
                  <option value="Security">Security</option>
                  <option value="Performance">Performance</option>
                  <option value="General">General</option>
                </select>

                <div className="edit-actions">
                  <button
                    type="button"
                    onClick={saveEditedTicket}
                  >
                    Save Changes
                  </button>

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setEditingTicket(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedTicket && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Ticket Details</h2>

                <p><strong>Ticket ID:</strong> {selectedTicket.id}</p>
                <p><strong>Title:</strong> {selectedTicket.title}</p>
                <p><strong>Description:</strong> {selectedTicket.description}</p>
                <p><strong>Category:</strong> {selectedTicket.category}</p>
                <p><strong>Priority:</strong> {selectedTicket.priority}</p>
                <p><strong>Status:</strong> {selectedTicket.status}</p>

                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      <footer>
        Support Triage Demo · Rule-based classification · Runs locally
      </footer>
    </main>
  )
}

export default App
