import { useState, useEffect } from 'react'

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/ping')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend'))
  }, [])

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>BytePrune</h1>
      <p>Backend says: {message}</p>
    </div>
  )
}

export default App
