'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts'

const MAX_POINTS = 40

function MetricCard({ label, value, unit, bg, labelColor, valColor, unitColor }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '14px 16px', flex: 1 }}>
      <p style={{ fontSize: 11, color: labelColor, margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 500, color: valColor, margin: 0 }}>
        {value ?? '—'}
      </p>
      <p style={{ fontSize: 10, color: unitColor, marginTop: 3, fontFamily: 'monospace' }}>{unit}</p>
    </div>
  )
}

function LiveChart({ data, dataKey, color, bg, domain }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="time" hide />
        <YAxis
          domain={domain}
          tick={{ fill: '#a8693a', fontSize: 10 }}
          tickCount={3}
        />
        <Tooltip
          contentStyle={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#9a3412' }}
          itemStyle={{ color }}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
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
      time:      new Date(r.created_at).toLocaleTimeString(),
      tension:   +r.tension,
      courant:   +r.courant,
      puissance: +r.puissance,
    }
  }

  function formatSct(r) {
    return {
      time:      new Date(r.created_at).toLocaleTimeString(),
      courant:   +r.courant,
      puissance: +r.puissance,
    }
  }

  const lp = pzemData[pzemData.length - 1]
  const ls = sctData[sctData.length - 1]

  const tabActive   = { background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
  const tabInactive = { background: '#ffedd5', color: '#c2410c', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }
  const chartCard   = { background: '#fff7ed', borderRadius: 14, padding: '14px 16px', border: '1px solid #fed7aa', marginBottom: 14 }

  return (
    <div style={{ minHeight: '100vh', background: '#fff7ed', padding: '28px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, color: '#ea580c', fontFamily: 'monospace', margin: '0 0 4px', letterSpacing: '0.05em' }}>
            ENETCOM · GII 2e année · PFA 2025–2026
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#7c2d12', margin: 0 }}>
            Réseau IoT géré par Raspberry PI5 via I2C
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffedd5', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'block',
            opacity: liveTick ? 1 : 0.3, transition: 'opacity 0.3s'
          }} />
          <span style={{ fontSize: 11, color: '#c2410c', fontFamily: 'monospace', letterSpacing: '0.1em' }}>LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={page === 'pzem' ? tabActive : tabInactive} onClick={() => setPage('pzem')}>
          PZEM-004T v2.0
        </button>
        <button style={page === 'sct' ? tabActive : tabInactive} onClick={() => setPage('sct')}>
          SCT013 — 60A/1V
        </button>
      </div>

      {/* PZEM Page */}
      {page === 'pzem' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Tension"   value={lp ? lp.tension.toFixed(1)    + ' V' : null} unit="Volts (V)"   bg="#ffedd5" labelColor="#c2410c" valColor="#7c2d12" unitColor="#f97316" />
            <MetricCard label="Courant"   value={lp ? lp.courant.toFixed(3)    + ' A' : null} unit="Ampères (A)" bg="#fef2f2" labelColor="#b91c1c" valColor="#7f1d1d" unitColor="#ef4444" />
            <MetricCard label="Puissance" value={lp ? Math.round(lp.puissance) + ' W' : null} unit="Watts (W)"   bg="#fdf2f8" labelColor="#be185d" valColor="#9d174d" unitColor="#ec4899" />
          </div>
          <div style={chartCard}>
            <p style={{ fontSize: 12, color: '#c2410c', margin: '0 0 10px' }}>Tension (V)</p>
            <LiveChart data={pzemData} dataKey="tension"   color="#f97316" domain={[200, 260]} />
          </div>
          <div style={chartCard}>
            <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 10px' }}>Courant (A)</p>
            <LiveChart data={pzemData} dataKey="courant"   color="#ef4444" domain={[0, 10]} />
          </div>
          <div style={chartCard}>
            <p style={{ fontSize: 12, color: '#be185d', margin: '0 0 10px' }}>Puissance active (W)</p>
            <LiveChart data={pzemData} dataKey="puissance" color="#ec4899" domain={[0, 2000]} />
          </div>
        </div>
      )}

      {/* SCT Page */}
      {page === 'sct' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Courant"   value={ls ? ls.courant.toFixed(3)    + ' A' : null} unit="Ampères (A)" bg="#ffedd5" labelColor="#c2410c" valColor="#7c2d12" unitColor="#f97316" />
            <MetricCard label="Puissance" value={ls ? Math.round(ls.puissance) + ' W' : null} unit="Watts (W)"   bg="#fef2f2" labelColor="#b91c1c" valColor="#7f1d1d" unitColor="#ef4444" />
          </div>
          <div style={chartCard}>
            <p style={{ fontSize: 12, color: '#c2410c', margin: '0 0 10px' }}>Courant (A)</p>
            <LiveChart data={sctData} dataKey="courant"   color="#f97316" domain={[0, 2]} />
          </div>
          <div style={chartCard}>
            <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 10px' }}>Puissance (W)</p>
            <LiveChart data={sctData} dataKey="puissance" color="#ef4444" domain={[0, 500]} />
          </div>
        </div>
      )}

    </div>
  )
}