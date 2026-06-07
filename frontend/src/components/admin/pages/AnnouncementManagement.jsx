import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/adminApi";

const ANNOUNCEMENT_TYPES = [
  "CLOSURE",
  "ACTIVITY",
  "RULE_CHANGE",
  "TIME_CHANGE",
  "OTHER",
];

const TYPE_LABELS = {
  CLOSURE: "Closure",
  ACTIVITY: "Activity",
  RULE_CHANGE: "Rule Change",
  TIME_CHANGE: "Time Change",
  OTHER: "Other",
};

const TYPE_OPTIONS = ANNOUNCEMENT_TYPES.map((v) => ({
  value: v,
  label: TYPE_LABELS[v],
}));

const formatTime = (str) => {
  if (!str) return "-";
  return str;
};

const AnnouncementFormModal = ({
  key,
  open,
  mode,
  announcement,
  loading,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  const isEdit = mode === "edit";
  const [title, setTitle] = useState(announcement?.title || "");
  const [type, setType] = useState(announcement?.type || "OTHER");
  const [content, setContent] = useState(announcement?.content || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title: title.trim(), type, content: content.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{isEdit ? "Edit Announcement" : "New Announcement"}</h3>
          <button className="modal-close" onClick={onClose}>
            x
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title (1-200 characters)"
                maxLength={200}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Announcement content (1-10000 characters)"
                maxLength={10000}
                rows={6}
                required
                style={{ resize: "vertical", minHeight: 120 }}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

const AnnouncementManagement = ({ currentUserId, onNotify }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterKeyword, setFilterKeyword] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editTarget, setEditTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / size));

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, size };
      if (filterType) params.type = filterType;
      if (filterStatus && filterStatus !== "all") params.status = filterStatus;
      if (filterKeyword.trim()) params.keyword = filterKeyword.trim();
      const data = await adminApi.listAnnouncements(params);
      setAnnouncements(data.list || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (onNotify)
        onNotify("error", err.message || "Failed to load announcements");
      setAnnouncements([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, filterType, filterStatus, filterKeyword, onNotify]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  const openCreate = () => {
    setFormMode("create");
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setFormMode("edit");
    setEditTarget(item);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    try {
      setSubmitting(true);
      if (formMode === "create") {
        await adminApi.createAnnouncement(payload);
        if (onNotify) onNotify("success", "Announcement created successfully");
      } else {
        await adminApi.updateAnnouncement(editTarget.id, payload);
        if (onNotify) onNotify("success", "Announcement updated successfully");
      }
      setFormOpen(false);
      setEditTarget(null);
      await fetchAnnouncements();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (item) => {
    try {
      await adminApi.publishAnnouncement(item.id);
      if (onNotify) onNotify("success", "Announcement published successfully");
      await fetchAnnouncements();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to publish");
    }
  };

  const handleUnpublish = async (item) => {
    try {
      await adminApi.unpublishAnnouncement(item.id);
      if (onNotify)
        onNotify("success", "Announcement unpublished successfully");
      await fetchAnnouncements();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to unpublish");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await adminApi.deleteAnnouncement(deleteTarget.id);
      if (onNotify) onNotify("success", "Announcement deleted successfully");
      setDeleteTarget(null);
      await fetchAnnouncements();
    } catch (err) {
      if (onNotify) onNotify("error", err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const handleReset = () => {
    setFilterType("");
    setFilterStatus("all");
    setFilterKeyword("");
    setPage(1);
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
        <h2>Announcement Management</h2>
        <p className="config-subtitle" style={{ color: "#5b6882" }}>
          Create, publish and manage system announcements visible to all library
          users.
        </p>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <button
          className="btn-primary"
          onClick={openCreate}
          style={{ padding: "12px 24px", fontSize: "14px" }}
        >
          + New Announcement
        </button>
      </div>

      <div className="search-section">
        <form className="search-form" onSubmit={handleSearch}>
          <select
            className="search-select"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="search-select"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>

          <input
            className="search-input"
            placeholder="Search by title"
            value={filterKeyword}
            onChange={(e) => {
              setFilterKeyword(e.target.value);
              setPage(1);
            }}
          />

          <button className="search-btn" type="submit">
            Apply Filters
          </button>
          <button className="btn-secondary" type="button" onClick={handleReset}>
            Reset
          </button>
        </form>
      </div>

      <div className="table-section">
        <h3>Announcements</h3>
        {loading ? (
          <div className="loading">Loading announcements...</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Published At</th>
                  <th>Created At</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#1a202c" }}>
                        {item.title}
                      </div>
                    </td>
                    <td>
                      <span className="audit-action-badge">
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${item.status === "published" ? "success" : "info"}`}
                      >
                        {item.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td style={{ color: "#718096", fontSize: "13px" }}>
                      {formatTime(item.publishedAt)}
                    </td>
                    <td style={{ color: "#718096", fontSize: "13px" }}>
                      {formatTime(item.createdAt)}
                    </td>
                    <td>
                      <div
                        className="action-buttons-cell"
                        style={{ justifyContent: "flex-end" }}
                      >
                        <button
                          className="btn-sm btn-edit"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        {item.status === "draft" ? (
                          <button
                            className="btn-sm"
                            style={{ background: "#48bb78" }}
                            onClick={() => handlePublish(item)}
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            className="btn-sm"
                            style={{ background: "#ed8936" }}
                            onClick={() => handleUnpublish(item)}
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          className="btn-sm btn-delete"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {announcements.length === 0 && (
              <div className="no-data">No announcements found.</div>
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

      <AnnouncementFormModal
        key={`${formMode}-${editTarget?.id || "new"}-${formOpen ? "open" : "closed"}`}
        open={formOpen}
        mode={formMode}
        announcement={editTarget}
        loading={submitting}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmModal
        open={!!deleteTarget}
        message={`Are you sure you want to delete announcement "${deleteTarget?.title}"? This action cannot be undone.`}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default AnnouncementManagement;
