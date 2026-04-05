'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts'

const MAX_POINTS = 40

function MetricCard({ label, value, unit, color }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-medium" style={{ color }}>
        {value ?? '—'}
      </p>
      <p className="text-xs text-gray-600 mt-1 font-mono">{unit}</p>
    </div>
  )
}

function LiveChart({ data, dataKey, color, domain }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" hide />
        <YAxis
          domain={domain}
          tick={{ fill: '#6b7280', fontSize: 10 }}
          tickCount={3}
        />
        <Tooltip
          contentStyle={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#9ca3af' }}
          itemStyle={{ color }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const [page, setPage] = useState('pzem')
  const [pzemData, setPzemData] = useState([])
  const [sctData, setSctData] = useState([])
  const [liveTick, setLiveTick] = useState(true)

  useEffect(() => {
    async function loadInitial() {
      const { data: pzem } = await supabase
        .from('pzem_readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_POINTS)

      const { data: sct } = await supabase
        .from('sct_readings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_POINTS)

      if (pzem) setPzemData(pzem.reverse().map(formatPzem))
      if (sct)  setSctData(sct.reverse().map(formatSct))
    }

    loadInitial()

    const pzemSub = supabase
      .channel('pzem-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pzem_readings' },
        ({ new: row }) => {
          setPzemData(prev => [...prev, formatPzem(row)].slice(-MAX_POINTS))
          setLiveTick(t => !t)
        }
      )
      .subscribe()

    const sctSub = supabase
      .channel('sct-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sct_readings' },
        ({ new: row }) => {
          setSctData(prev => [...prev, formatSct(row)].slice(-MAX_POINTS))
          setLiveTick(t => !t)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(pzemSub)
      supabase.removeChannel(sctSub)
    }
  }, [])

  function formatPzem(r) {
    return {
      time: new Date(r.created_at).toLocaleTimeString(),
      tension:   +r.tension,
      courant:   +r.courant,
      puissance: +r.puissance,
    }
  }

  function formatSct(r) {
    return {
      time: new Date(r.created_at).toLocaleTimeString(),
      courant_max: +r.courant_max,
      courant_rms: +r.courant_rms,
      frequence:   +r.frequence,
    }
  }

  const lp = pzemData[pzemData.length - 1]
  const ls = sctData[sctData.length - 1]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 font-mono mb-1">
            ENETCOM · GII 2e année · PFA 2025–2026
          </p>
          <h1 className="text-xl font-medium">
            Réseau IoT géré par ESP32 via I2C
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 transition-opacity duration-300"
            style={{ opacity: liveTick ? 1 : 0.3 }}
          />
          <span className="text-xs text-gray-400 font-mono tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-3">
        {[
          { key: 'pzem', label: 'PZEM-004T v2.0' },
          { key: 'sct',  label: 'SCT013 — 60A/1V' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setPage(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              page === tab.key
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PZEM Page */}
      {page === 'pzem' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <MetricCard label="Tension"   value={lp ? lp.tension.toFixed(1)   + ' V' : null} unit="Volts (V)"    color="#3b82f6" />
            <MetricCard label="Courant"   value={lp ? lp.courant.toFixed(2)   + ' A' : null} unit="Ampères (A)"  color="#10b981" />
            <MetricCard label="Puissance" value={lp ? Math.round(lp.puissance) + ' W' : null} unit="Watts (W)"    color="#f59e0b" />
          </div>
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Tension (V)</p>
              <LiveChart data={pzemData} dataKey="tension"   color="#3b82f6" domain={[200, 240]} />
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Courant (A)</p>
              <LiveChart data={pzemData} dataKey="courant"   color="#10b981" domain={[0, 10]} />
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Puissance active (W)</p>
              <LiveChart data={pzemData} dataKey="puissance" color="#f59e0b" domain={[0, 2000]} />
            </div>
          </div>
        </div>
      )}

      {/* SCT Page */}
      {page === 'sct' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <MetricCard label="Courant max" value={ls ? ls.courant_max.toFixed(2) + ' A' : null} unit="Ampères (A)" color="#ef4444" />
            <MetricCard label="Courant RMS" value={ls ? ls.courant_rms.toFixed(2) + ' A' : null} unit="Ampères (A)" color="#8b5cf6" />
            <MetricCard label="Fréquence"   value={ls ? ls.frequence.toFixed(2)   + ' Hz': null} unit="Hertz (Hz)"  color="#06b6d4" />
          </div>
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-3">Courant RMS (A)</p>
              <LiveChart data={sctData} dataKey="courant_rms" color="#8b5cf6" domain={[0, 50]} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}