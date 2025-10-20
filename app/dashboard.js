cat > /mnt/user-data/outputs/ootp-dashboard/app/dashboard.js << 'ENDFILE'
'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Upload, RefreshCw, AlertCircle, TrendingUp, Users, BarChart3, Zap, Trash2 } from 'lucide-react'

export default function Dashboard() {
  const [dataMode, setDataMode] = useState('input')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [rawData, setRawData] = useState('')
  const [analyses, setAnalyses] = useState([])
  const [combinedAnalysis, setCombinedAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    depth: true,
    warnings: true,
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    const newFiles = []

    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const csvText = event.target.result
        newFiles.push({
          name: file.name,
          data: csvText,
          size: file.size,
          id: Date.now() + Math.random()
        })

        if (newFiles.length === files.length) {
          setUploadedFiles([...uploadedFiles, ...newFiles])
        }
      }
      reader.readAsText(file)
    })
  }

  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return null

    const headers = lines[0].split(',').map(h => h.trim())
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const obj = {}
      headers.forEach((header, idx) => {
        obj[header] = values[idx] || ''
      })
      return obj
    }).filter(row => Object.values(row).some(v => v !== ''))

    return { headers, rows }
  }

  const analyzePlayerData = (data, fileName) => {
    const rows = data.rows
    const columns = data.headers.join('|').toUpperCase()
    
    const isBattingData = columns.includes('BATTING_RATINGS') || columns.includes('CONTACT') || columns.includes('POWER')
    const isPitchingData = columns.includes('PITCHING_RATINGS') || columns.includes('STUFF') || columns.includes('CONTROL')
    
    let analysis = {
      fileName,
      dataType: isBattingData ? 'Batting' : isPitchingData ? 'Pitching' : 'Unknown',
      totalPlayers: rows.length,
      insights: [],
      warnings: [],
      opportunities: [],
      statsBreakdown: {},
    }

    if (isBattingData) {
      analysis = analyzeBattingRoster(rows, data.headers, analysis)
    } else if (isPitchingData) {
      analysis = analyzePitchingRoster(rows, data.headers, analysis)
    }

    return analysis
  }

  const analyzeBattingRoster = (rows, headers, baseAnalysis) => {
    const contactIdx = headers.findIndex(h => h.includes('contact') && !h.includes('talent'))
    const powerIdx = headers.findIndex(h => h === 'batting_ratings_overall_power')
    const speedIdx = headers.findIndex(h => h === 'running_ratings_speed')

    let contactSum = 0, powerSum = 0, speedSum = 0, activeCount = 0

    rows.forEach(row => {
      const contact = parseInt(row[headers[contactIdx]]) || 0
      const power = parseInt(row[headers[powerIdx]]) || 0
      const speed = parseInt(row[headers[speedIdx]]) || 0

      if (contact > 0 || power > 0) {
        activeCount++
        contactSum += contact
        powerSum += power
        speedSum += speed
      }
    })

    const rosterStats = {
      avgContact: activeCount > 0 ? (contactSum / activeCount).toFixed(1) : 0,
      avgPower: activeCount > 0 ? (powerSum / activeCount).toFixed(1) : 0,
      avgSpeed: activeCount > 0 ? (speedSum / activeCount).toFixed(1) : 0,
    }

    baseAnalysis.statsBreakdown = rosterStats
    
    if (rosterStats.avgPower < 25) {
      baseAnalysis.warnings.push('Offensive power below average - consider upgrades')
    }
    if (rosterStats.avgContact < 20) {
      baseAnalysis.warnings.push('Contact ability weak - expect strikeouts')
    }

    baseAnalysis.insights.push(`Batting: ${rows.length} players analyzed`)
    baseAnalysis.opportunities.push('Review lineup construction for efficiency')

    return baseAnalysis
  }

  const analyzePitchingRoster = (rows, headers, baseAnalysis) => {
    const stuffIdx = headers.findIndex(h => h === 'pitching_ratings_overall_stuff')
    const controlIdx = headers.findIndex(h => h === 'pitching_ratings_overall_control')

    let stuffSum = 0, controlSum = 0, count = 0

    rows.forEach(row => {
      const stuff = parseInt(row[headers[stuffIdx]]) || 0
      const control = parseInt(row[headers[controlIdx]]) || 0

      if (stuff > 0 && control > 0) {
        stuffSum += stuff
        controlSum += control
        count++
      }
    })

    const staffStats = {
      avgStuff: count > 0 ? (stuffSum / count).toFixed(1) : 0,
      avgControl: count > 0 ? (controlSum / count).toFixed(1) : 0,
    }

    baseAnalysis.statsBreakdown = staffStats

    if (staffStats.avgControl < 28) {
      baseAnalysis.warnings.push('Pitching control weak - higher walk rates expected')
    }

    baseAnalysis.insights.push(`Pitching: ${rows.length} players analyzed`)
    baseAnalysis.opportunities.push('Evaluate rotation depth and bullpen options')

    return baseAnalysis
  }

  const handleAnalyze = () => {
    if (uploadedFiles.length === 0 && !rawData.trim()) {
      alert('Please upload CSV files or paste data first')
      return
    }

    setLoading(true)
    setTimeout(() => {
      const newAnalyses = []

      uploadedFiles.forEach(file => {
        const parsed = parseCSVData(file.data)
        if (parsed && parsed.rows.length > 0) {
          const analysis = analyzePlayerData(parsed, file.name)
          newAnalyses.push(analysis)
        }
      })

      if (rawData.trim()) {
        const parsed = parseCSVData(rawData)
        if (parsed && parsed.rows.length > 0) {
          const analysis = analyzePlayerData(parsed, 'Pasted Data')
          newAnalyses.push(analysis)
        }
      }

      if (newAnalyses.length === 0) {
        alert('Could not parse any CSV data')
        setLoading(false)
        return
      }

      setAnalyses(newAnalyses)
      const totalPlayers = newAnalyses.reduce((sum, a) => sum + a.totalPlayers, 0)
      const allWarnings = newAnalyses.flatMap(a => a.warnings.map(w => `[${a.fileName}] ${w}`))
      
      setCombinedAnalysis({
        fileCount: newAnalyses.length,
        totalPlayers,
        warnings: allWarnings,
        battingCount: newAnalyses.filter(a => a.dataType === 'Batting').length,
        pitchingCount: newAnalyses.filter(a => a.dataType === 'Pitching').length,
      })
      
      setDataMode('dashboard')
      setLoading(false)
    }, 500)
  }

  const handleReset = () => {
    setRawData('')
    setUploadedFiles([])
    setAnalyses([])
    setCombinedAnalysis(null)
    setDataMode('input')
  }

  const removeFile = (id) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id))
  }

  if (dataMode === 'input') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">OOTP Dashboard</h1>
            <p className="text-slate-400">Multi-file roster analysis & comparison</p>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl mb-6">
            <div className="mb-6">
              <label className="block text-white font-semibold mb-3 flex items-center gap-2">
                <Upload size={20} />
                Upload CSV Files
              </label>
              <p className="text-slate-400 text-sm mb-4">
                Upload batting, pitching, or any OOTP player data
              </p>
              
              <div className="relative">
                <input
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="block w-full bg-slate-900 border-2 border-dashed border-slate-600 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition text-center"
                >
                  <Upload size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-white font-semibold mb-1">Click to upload or drag & drop</p>
                  <p className="text-slate-400 text-sm">Multiple CSV files supported</p>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-6">
                  <p className="text-white font-semibold mb-3">Files ({uploadedFiles.length}):</p>
                  <div className="space-y-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 bg-slate-900 p-3 rounded border border-slate-600">
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{file.name}</p>
                          <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-slate-800 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-slate-700">
                <p className="text-slate-400 text-sm mb-3 font-semibold">Or paste CSV data:</p>
                <textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  placeholder="player_id,team_id,position,batting_ratings_overall_contact,batting_ratings_overall_power
1,5,1,45,30
2,5,2,25,45"
                  className="w-full h-32 bg-slate-900 border border-slate-600 rounded p-4 text-white font-mono text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600"
                />
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || (uploadedFiles.length === 0 && !rawData.trim())}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 size={20} />
                  Analyze {uploadedFiles.length > 0 ? `${uploadedFiles.length} File(s)` : 'Data'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Roster Analysis</h1>
            <p className="text-slate-400">{combinedAnalysis?.totalPlayers} players | {combinedAnalysis?.fileCount} dataset(s)</p>
          </div>
          <button
            onClick={handleReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw size={18} />
            New Analysis
          </button>
        </div>

        {combinedAnalysis?.warnings.length > 0 && (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-red-300 font-bold mb-3">Critical Issues</h3>
                <ul className="space-y-2">
                  {combinedAnalysis.warnings.map((warning, idx) => (
                    <li key={idx} className="text-red-200 text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {analyses.map((analysis, idx) => (
            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => toggleSection(`file-${idx}`)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-750 transition bg-slate-750"
              >
                <div>
                  <h2 className="text-lg font-bold text-white">{analysis.fileName}</h2>
                  <p className="text-slate-400 text-sm">{analysis.dataType} • {analysis.totalPlayers} players</p>
                </div>
                {expandedSections[`file-${idx}`] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expandedSections[`file-${idx}`] && (
                <div className="px-6 py-4 border-t border-slate-700">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    {Object.entries(analysis.statsBreakdown).map(([key, value]) => (
                      <div key={key} className="bg-slate-900 p-3 rounded">
                        <p className="text-slate-400 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-xl font-bold text-blue-400">{value}</p>
                      </div>
                    ))}
                  </div>

                  {analysis.insights.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-white font-bold mb-2">Insights</h3>
                      <ul className="space-y-1">
                        {analysis.insights.map((insight, i) => (
                          <li key={i} className="text-slate-300 text-sm">• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.opportunities.length > 0 && (
                    <div>
                      <h3 className="text-white font-bold mb-2">Recommendations</h3>
                      <ul className="space-y-1">
                        {analysis.opportunities.map((opp, i) => (
                          <li key={i} className="text-slate-300 text-sm">→ {opp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
ENDFILE
cat /mnt/user-data/outputs/ootp-dashboard/app/dashboard.js | head -20
Output

'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Upload, RefreshCw, AlertCircle, TrendingUp, Users, BarChart3, Zap, Trash2 } from 'lucide-react'

export default function Dashboard() {
  const [dataMode, setDataMode] = useState('input')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [rawData, setRawData] = useState('')
  const [analyses, setAnalyses] = useState([])
  const [combinedAnalysis, setCombinedAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    depth: true,
    warnings: true,
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
