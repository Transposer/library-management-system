import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/adminApi";

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTime = (str) => {
  if (!str) return "-";
  return str;
};

const ConfirmModal = ({ open, message, loading, onClose, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Confirm Action</h3>
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: "#4a5568", fontSize: "14px" }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BackupManagement = ({ currentUserId, onNotify }) => {
  const [backups, setBackups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / size));

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.listBackups({ page, size });
      setBackups(data.list || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to load backups");
      setBackups([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, onNotify]);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      await adminApi.createBackup();
      if (onNotify) onNotify("success", "Backup created successfully");
      await fetchBackups();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await adminApi.deleteBackup(deleteTarget.id);
      if (onNotify) onNotify("success", "Backup deleted successfully");
      setDeleteTarget(null);
      await fetchBackups();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to delete backup");
    } finally {
      setDeleting(false);
    }
  };

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
        <h2>Backup Management</h2>
        <p className="config-subtitle" style={{ color: "#5b6882" }}>
          Create and manage SQLite database backups. Backups are stored on the
          server filesystem.
        </p>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={creating}
          style={{ padding: "12px 24px", fontSize: "14px" }}
        >
          {creating ? "Creating..." : "+ Create Backup"}
        </button>
      </div>

      <div className="table-section">
        <h3>Backup Records</h3>
        {loading ? (
          <div className="loading">Loading backups...</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Created At</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <code style={{ fontSize: "13px" }}>
                        {backup.fileName}
                      </code>
                    </td>
                    <td>{formatSize(backup.fileSize)}</td>
                    <td>{formatTime(backup.createdAt)}</td>
                    <td>
                      <div
                        className="action-buttons-cell"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <a
                          href={adminApi.getBackupDownloadUrl(backup.id)}
                          className="btn-sm btn-edit"
                          style={{ textDecoration: "none" }}
                          download
                        >
                          Download
                        </a>
                        <button
                          className="btn-sm btn-delete"
                          onClick={() => setDeleteTarget(backup)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {backups.length === 0 && (
              <div className="no-data">No backup records found.</div>
            )}

            <div
              className="form-actions"
              style={{ justifyContent: "space-between", marginTop: 18 }}
            >
              <span style={{ color: "#718096", fontSize: 13 }}>
                Total {total} records · Page {page}/{totalPages}
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="search-select"
                  style={{
                    marginLeft: 10,
                    minWidth: "auto",
                    width: "auto",
                    padding: "6px 10px",
                    fontSize: 13,
                  }}
                >
                  {[5, 10, 20, 50].map((s) => (
                    <option key={s} value={s}>
                      {s} / page
                    </option>
                  ))}
                </select>
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-secondary"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        message={`Are you sure you want to delete backup "${deleteTarget?.fileName}"? This action cannot be undone.`}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default BackupManagement;
