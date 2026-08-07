import { useState } from 'react'

function getScoreColor(score) {
  if (score >= 80) return { text: 'text-green-600', bg: 'bg-green-100', ring: 'ring-green-500' }
  if (score >= 50) return { text: 'text-yellow-600', bg: 'bg-yellow-100', ring: 'ring-yellow-500' }
  return { text: 'text-red-600', bg: 'bg-red-100', ring: 'ring-red-500' }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function ScoreGauge({ label, score, size = 'large' }) {
  const colors = getScoreColor(score)
  const dimension = size === 'large' ? 'w-40 h-40' : 'w-24 h-24'
  const fontSize = size === 'large' ? 'text-5xl' : 'text-2xl'
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${dimension}`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={score >= 80 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${fontSize} font-bold ${colors.text}`}>{score}</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

function ResourceRow({ icon, label, bytes, count }) {
  if (!bytes && !count) return null
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="text-gray-700 font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-gray-900 font-semibold">{formatBytes(bytes)}</span>
        <span className="text-gray-400 text-sm ml-2">({count} requests)</span>
      </div>
    </div>
  )
}

function App() {
  const [urlInput, setUrlInput] = useState('')
  const [analysisData, setAnalysisData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAnalyze = async () => {
    if (!urlInput) return
    setLoading(true)
    setError(null)
    setAnalysisData(null)

    try {
      const response = await fetch(`http://127.0.0.1:5001/api/analyze?url=${encodeURIComponent(urlInput)}`)
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAnalysisData(data)
      }
    } catch (err) {
      setError('Could not reach backend. Is Flask running?')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent mb-2">
            🌱 BytePrune
          </h1>
          <p className="text-gray-500 text-lg">Measure. Detect. Optimize. Sustainably.</p>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-10 shadow-lg rounded-xl p-2 bg-white">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a website URL (e.g. https://example.com)"
            className="flex-1 px-4 py-3 rounded-lg focus:outline-none text-gray-700"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition disabled:bg-gray-400"
          >
            {loading ? 'Scanning...' : 'Analyze'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center text-gray-400 animate-pulse">
            Running sustainability analysis...
          </div>
        )}

        {/* Results */}
        {analysisData && !loading && (
          <div className="space-y-6">

            {/* Green Score Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-6">{analysisData.url}</h2>
              <div className="flex justify-around items-center flex-wrap gap-6">
                <ScoreGauge label="Green Score" score={analysisData.green_score} size="large" />
                <div className="flex gap-8">
                  <ScoreGauge label="Performance" score={analysisData.performance_sub_score} size="small" />
                  <ScoreGauge label="Carbon" score={analysisData.carbon_sub_score} size="small" />
                </div>
              </div>
            </div>

            {/* Carbon Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                <p className="text-gray-400 text-sm mb-1">CO₂ per visit</p>
                <p className="text-3xl font-bold text-green-700">{analysisData.co2_per_visit_g}g</p>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                <p className="text-gray-400 text-sm mb-1">Est. Monthly CO₂</p>
                <p className="text-3xl font-bold text-green-700">{analysisData.co2_monthly_kg}kg</p>
              </div>
            </div>

            {/* Resource Breakdown */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Resource Breakdown</h3>
              <p className="text-gray-400 text-sm mb-4">
                Total: {formatBytes(analysisData.total_page_size_bytes)} • Load time: {Math.round(analysisData.load_time_ms)}ms • {analysisData.num_requests} requests
              </p>
              <div>
                <ResourceRow icon="📄" label="Document" bytes={analysisData.resource_breakdown.document?.transferSize} count={analysisData.resource_breakdown.document?.requestCount} />
                <ResourceRow icon="🖼️" label="Images" bytes={analysisData.resource_breakdown.image?.transferSize} count={analysisData.resource_breakdown.image?.requestCount} />
                <ResourceRow icon="🎨" label="Stylesheets" bytes={analysisData.resource_breakdown.stylesheet?.transferSize} count={analysisData.resource_breakdown.stylesheet?.requestCount} />
                <ResourceRow icon="⚙️" label="Scripts" bytes={analysisData.resource_breakdown.script?.transferSize} count={analysisData.resource_breakdown.script?.requestCount} />
                <ResourceRow icon="🔤" label="Fonts" bytes={analysisData.resource_breakdown.font?.transferSize} count={analysisData.resource_breakdown.font?.requestCount} />
                <ResourceRow icon="📦" label="Other" bytes={analysisData.resource_breakdown.other?.transferSize} count={analysisData.resource_breakdown.other?.requestCount} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default App
