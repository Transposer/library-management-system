// frontend/src/components/admin/components/SimpleBarChart.jsx
export default function SimpleBarChart({ data, xKey, yKey, height = 150 }) {
  if (!data || data.length === 0) {
    return <div className="chart-placeholder">No data available</div>
  }

  const values = data.map(item => Number(item[yKey]) || 0)
  const maxY = Math.max(...values, 1)

  return (
    <div className="simple-bar-chart" style={{ height: `${height}px` }}>
      {data.map((item, idx) => {
        const val = Number(item[yKey]) || 0
        const barHeight = (val / maxY) * (height - 30)
        return (
          <div key={idx} className="bar-wrapper" title={`${item[xKey]}: ${val}`}>
            <div
              className="bar"
              style={{ height: `${barHeight}px` }}
            />
            <div className="bar-label">{item[xKey]}</div>
          </div>
        )
      })}
      <style>{`
        .simple-bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 10px 0;
          overflow-x: auto;
        }
        .bar-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          min-width: 30px;
        }
        .bar {
          width: 100%;
          background-color: #4f46e5;
          border-radius: 4px 4px 0 0;
          transition: height 0.2s;
        }
        .bar-label {
          font-size: 10px;
          margin-top: 6px;
          color: #6b7280;
          transform: rotate(-15deg);
          white-space: nowrap;
        }
        .chart-placeholder {
          text-align: center;
          color: #9ca3af;
          padding: 20px;
        }
      `}</style>
    </div>
  )
}
