import { useState } from "react";
import { useReports, TABS } from "../hooks/useReports";
import StatCard from "../components/StatCard";
import SimpleBarChart from "../components/SimpleBarChart";

const TAB_LIST = [
  { key: "borrowing", label: "Borrowing Report" },
  { key: "overdue", label: "Overdue Stats" },
  { key: "usage", label: "Usage Summary" },
];

const formatMonthLabel = (month) => {
  if (!month) return "";
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

const Reports = ({ currentUserId, onNotify }) => {
  const [activeTab, setActiveTab] = useState("borrowing");
  const {
    month,
    data,
    loading,
    error,
    exportUrl,
    navigateMonth,
    isCurrentMonth,
  } = useReports(activeTab);

  const renderMetrics = () => {
    if (!data) return null;
    const { summary } = data;

    switch (activeTab) {
      case "borrowing":
        return (
          <div className="stats-grid">
            <StatCard
              title="Total Checkouts"
              value={summary.totalCheckouts}
              icon="📤"
              loading={loading}
              variant="blue"
            />
            <StatCard
              title="Total Returns"
              value={summary.totalReturns}
              icon="📥"
              loading={loading}
              variant="green"
            />
            <StatCard
              title="Net Borrowed"
              value={summary.netBorrowed}
              icon="📊"
              loading={loading}
              variant="orange"
            />
            <StatCard
              title="Active Borrowers"
              value={summary.activeBorrowers}
              icon="👥"
              loading={loading}
              variant="purple"
            />
          </div>
        );
      case "overdue":
        return (
          <div className="stats-grid">
            <StatCard
              title="Overdue Count"
              value={summary.overdueCount}
              icon="⚠️"
              loading={loading}
              variant="red"
            />
            <StatCard
              title="Total Fines"
              value={`¥${summary.totalFines}`}
              icon="💰"
              loading={loading}
              variant="orange"
            />
            <StatCard
              title="Avg Overdue Days"
              value={`${summary.avgOverdueDays}d`}
              icon="📅"
              loading={loading}
              variant="blue"
            />
            <StatCard
              title="Overdue Rate"
              value={`${summary.overdueRate}%`}
              icon="📈"
              loading={loading}
              variant="purple"
            />
          </div>
        );
      case "usage":
        return (
          <div className="stats-grid">
            <StatCard
              title="Total Checkouts"
              value={summary.totalCheckouts}
              icon="📤"
              loading={loading}
              variant="blue"
            />
            <StatCard
              title="Active Borrowers"
              value={summary.activeBorrowers}
              icon="👥"
              loading={loading}
              variant="green"
            />
            <StatCard
              title="Avg Loans/User"
              value={summary.avgLoansPerUser}
              icon="📊"
              loading={loading}
              variant="orange"
            />
            <StatCard
              title="New Users"
              value={summary.newUsers}
              icon="🆕"
              loading={loading}
              variant="purple"
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderChart = () => {
    if (!data) return null;

    switch (activeTab) {
      case "borrowing":
        return (
          <SimpleBarChart
            data={(data.dailyTrends || []).map((d) => ({
              date: d.date.slice(5),
              checkouts: d.checkouts,
            }))}
            xKey="date"
            yKey="checkouts"
            height={170}
          />
        );
      case "overdue":
        return (
          <SimpleBarChart
            data={(data.byDayOverdue || []).map((d) => ({
              date: d.day.slice(5),
              checkouts: d.count,
            }))}
            xKey="date"
            yKey="checkouts"
            height={170}
          />
        );
      case "usage":
        return (
          <SimpleBarChart
            data={(data.dailyActivity || []).map((d) => ({
              date: d.date.slice(5),
              checkouts: d.activeUsers,
            }))}
            xKey="date"
            yKey="checkouts"
            height={170}
          />
        );
      default:
        return null;
    }
  };

  const renderTable = () => {
    if (!data) return null;

    switch (activeTab) {
      case "borrowing":
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Title</th>
                <th>Author</th>
                <th style={{ textAlign: "right" }}>Loan Count</th>
              </tr>
            </thead>
            <tbody>
              {(data.topBooks || []).map((book) => (
                <tr key={book.bookId}>
                  <td>{book.rank}</td>
                  <td style={{ fontWeight: 500 }}>{book.title}</td>
                  <td style={{ color: "#718096" }}>{book.author}</td>
                  <td style={{ textAlign: "right" }}>{book.loanCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "overdue":
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ textAlign: "right" }}>Overdue Count</th>
                <th style={{ textAlign: "right" }}>Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {(data.topOverdueBooks || []).map((book) => (
                <tr key={book.bookId}>
                  <td style={{ fontWeight: 500 }}>{book.title}</td>
                  <td style={{ textAlign: "right" }}>{book.overdueCount}</td>
                  <td style={{ textAlign: "right" }}>{book.avgDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "usage":
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Email</th>
                <th style={{ textAlign: "right" }}>Loan Count</th>
              </tr>
            </thead>
            <tbody>
              {(data.topBorrowers || []).map((user) => (
                <tr key={user.userId}>
                  <td>{user.rank}</td>
                  <td style={{ fontWeight: 500 }}>{user.name}</td>
                  <td style={{ color: "#718096", fontSize: "13px" }}>
                    {user.email}
                  </td>
                  <td style={{ textAlign: "right" }}>{user.loanCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  const chartTitle = {
    borrowing: "Daily Checkouts",
    overdue: "Daily New Overdues",
    usage: "Daily Active Borrowers",
  }[activeTab];

  return (
    <div className="content">
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <h2>Reports</h2>
        <p className="config-subtitle" style={{ color: "#5b6882" }}>
          Generate and export library operation reports with detailed
          statistics.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <a
          href={exportUrl || "#"}
          className="btn-primary"
          style={{
            textDecoration: "none",
            padding: "12px 24px",
            fontSize: "14px",
          }}
        >
          Export Excel
        </a>
      </div>

      <div
        className="search-section"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="btn-secondary"
            onClick={() => navigateMonth(-1)}
            disabled={loading}
          >
            &lt;
          </button>
          <span
            style={{
              fontWeight: 600,
              fontSize: "15px",
              minWidth: 140,
              textAlign: "center",
            }}
          >
            {formatMonthLabel(month)}
          </span>
          <button
            className="btn-secondary"
            onClick={() => navigateMonth(1)}
            disabled={loading || isCurrentMonth}
          >
            &gt;
          </button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TAB_LIST.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "search-btn" : "btn-secondary"}
              style={
                activeTab === tab.key
                  ? {}
                  : { background: "#edf2f7", color: "#4a5568" }
              }
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="config-error-banner">
          <span className="config-error-icon">⚠</span>
          <span>{error}</span>
          <button className="config-retry-btn" onClick={() => navigateMonth(0)}>
            Retry
          </button>
        </div>
      )}

      {renderMetrics()}

      <div className="dashboard-two-columns">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>{chartTitle}</h3>
          </div>
          <div className="card-content">
            {loading ? <div className="skeleton-chart" /> : renderChart()}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-header">
            <h3>
              {activeTab === "overdue"
                ? "Top Overdue Books"
                : activeTab === "usage"
                  ? "Top Borrowers"
                  : "Top Books"}
            </h3>
          </div>
          <div className="card-content">
            {loading ? <div className="skeleton-list" /> : renderTable()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
