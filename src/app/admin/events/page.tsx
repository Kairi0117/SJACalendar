"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GRADE_LEVELS } from "@/lib/grades";
import ConfirmDialog from "@/components/ConfirmDialog";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  all_grades: boolean;
  grade_levels: string[];
}

const emptyForm = {
  title: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  location: "",
  all_grades: false,
  grade_levels: [] as string[],
};

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ event: EventRow; loading: boolean } | null>(null);
  const [notifyModal, setNotifyModal] = useState<{
    event: EventRow;
    recipients: number;
    alreadyNotified: number;
    sending: boolean;
  } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      toast.error("Could not load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (e: EventRow) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description ?? "",
      event_date: e.event_date,
      start_time: e.start_time ?? "",
      end_time: e.end_time ?? "",
      location: e.location ?? "",
      all_grades: e.all_grades,
      grade_levels: e.grade_levels ?? [],
    });
    setShowForm(true);
  };

  const toggleGrade = (g: string) => {
    setForm((f) => ({
      ...f,
      grade_levels: f.grade_levels.includes(g)
        ? f.grade_levels.filter((x) => x !== g)
        : [...f.grade_levels, g],
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save event.");
      } else {
        toast.success(editingId ? "Event updated." : "Event created.");
        setShowForm(false);
        load();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (event: EventRow) => {
    setDeleteModal({ event, loading: false });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteModal({ ...deleteModal, loading: true });
    try {
      const res = await fetch(`/api/admin/events/${deleteModal.event.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete event.");
      } else {
        toast.success("Event deleted.");
        load();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleteModal(null);
    }
  };

  const openNotify = async (event: EventRow) => {
    // Count first so the dialog can show how many parents will be emailed.
    try {
      const res = await fetch(`/api/admin/events/${event.id}/notify`);
      const data = await res.json();
      setNotifyModal({
        event,
        recipients: data?.total ?? 0,
        alreadyNotified: data?.alreadyNotified ?? 0,
        sending: false,
      });
    } catch {
      setNotifyModal({ event, recipients: 0, alreadyNotified: 0, sending: false });
    }
  };

  const confirmNotify = async () => {
    if (!notifyModal) return;
    setNotifyModal({ ...notifyModal, sending: true });
    try {
      const res = await fetch(`/api/admin/events/${notifyModal.event.id}/notify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not send notifications.");
      } else if (data.total === 0) {
        toast.info("No parents matched this event.");
      } else if (data.sent === 0) {
        toast.error(
          `Matched ${data.total} parent${data.total === 1 ? "" : "s"} but no email was sent. Check the notification log.`
        );
      } else {
        toast.success(`Notified ${data.sent} parent${data.sent === 1 ? "" : "s"}.`);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setNotifyModal(null);
    }
  };

  const inputClasses =
    "w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all";

  return (
    <div>
      <main className="space-y-6">
        <h1 className="text-xl font-bold">Manage Events</h1>


        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Events ({events.length})</h2>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Event
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={save} className="bg-card border border-border rounded-xl p-6 space-y-4 card-elevated">
            <h3 className="text-base font-semibold">
              {editingId ? "Edit Event" : "New Event"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClasses}
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Date *</label>
                <input
                  type="date"
                  required
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. School Hall"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Start time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className={inputClasses}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputClasses}
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-3">
                <input
                  type="checkbox"
                  checked={form.all_grades}
                  onChange={(e) => setForm({ ...form, all_grades: e.target.checked })}
                  className="w-4 h-4 accent-secondary"
                />
                School-wide event (all grades)
              </label>

              {!form.all_grades && (
                <div>
                  <div className="text-sm font-medium mb-2">Grade levels</div>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_LEVELS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGrade(g)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          form.grade_levels.includes(g)
                            ? "bg-secondary text-white border-secondary"
                            : "bg-background border-border text-foreground/70 hover:text-foreground"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update Event" : "Create Event"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <p className="text-foreground/60">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-foreground/60">No events yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div
                key={e.id}
                className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-elevated"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{e.title}</div>
                  <div className="text-sm text-foreground/60 mt-0.5">
                    {new Date(e.event_date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}
                    {e.location ? ` · ${e.location}` : ""}
                  </div>
                  <div className="text-xs text-foreground/50 mt-1">
                    {e.all_grades ? "All grades" : e.grade_levels.join(", ") || "—"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(e)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openNotify(e)}
                    className="px-3 py-1.5 text-sm border border-primary/40 text-primary rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    Notify
                  </button>
                  <button
                    onClick={() => openDelete(e)}
                    className="px-3 py-1.5 text-sm border border-secondary/40 text-secondary rounded-lg hover:bg-secondary/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={!!deleteModal}
        title="Delete event?"
        confirmLabel="Delete event"
        loadingLabel="Deleting..."
        loading={deleteModal?.loading ?? false}
        onConfirm={confirmDelete}
        onClose={() => setDeleteModal(null)}
      >
        <p className="text-sm text-foreground/70 mb-1">
          Delete <strong>{deleteModal?.event.title}</strong> from the calendar.
        </p>
        <p className="text-sm text-secondary mb-5">
          Parents will stop seeing this event immediately. This cannot be undone.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!notifyModal}
        title="Notify parents?"
        confirmLabel="Send notification"
        loadingLabel="Sending..."
        loading={notifyModal?.sending ?? false}
        onConfirm={confirmNotify}
        onClose={() => setNotifyModal(null)}
      >
        <p className="text-sm text-foreground/70 mb-1">
          Email <strong>{notifyModal?.event.title}</strong> to{" "}
          <strong>{notifyModal?.recipients ?? 0}</strong>{" "}
          parent{(notifyModal?.recipients ?? 0) === 1 ? "" : "s"}.
        </p>
        <p className="text-sm text-secondary mb-5">
          {notifyModal?.event.all_grades
            ? "School-wide event: every parent with a linked child will receive it."
            : `Only parents with a child in ${notifyModal?.event.grade_levels.join(", ") || "those grades"}.`}{" "}
          Parents with no linked children are skipped.
          {(notifyModal?.alreadyNotified ?? 0) > 0 &&
            ` ${notifyModal?.alreadyNotified} of them ${
              notifyModal?.alreadyNotified === 1 ? "has" : "have"
            } already been emailed about this event and will receive it again.`}
        </p>
      </ConfirmDialog>
    </div>
  );
}
