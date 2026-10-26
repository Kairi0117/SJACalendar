"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, Trash2, Search } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface StudentRow {
  id: string;
  full_name: string;
  student_number: string | null;
  grade_level: string;
  archived_at: string | null;
  parent_emails: string[];
}

export default function AdminArchivesPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ student: StudentRow; loading: boolean } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/students?archived=true");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setStudents(data.students ?? []);
    } catch {
      toast.error("Could not load archived students.");
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

  const restore = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Could not restore.");
      else {
        toast.success("Student restored.");
        load();
      }
    } catch {
      toast.error("Network error.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteModal({ ...deleteModal, loading: true });
    try {
      const res = await fetch(`/api/admin/students/${deleteModal.student.id}?permanent=true`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete permanently.");
      } else {
        toast.success("Student permanently deleted.");
        load();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleteModal(null);
    }
  };

  const filtered = students.filter((s) => {
    if (gradeFilter && s.grade_level !== gradeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.student_number ?? "").toLowerCase().includes(q) ||
        s.grade_level.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Archives</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Archived students. Restore them to make them active again, or delete permanently.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived students..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="">All grades</option>
          {["Kinder", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-foreground/60">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-foreground/60">{students.length === 0 ? "No archived students." : "No matches."}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-elevated"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.full_name}</div>
                <div className="text-sm text-foreground/60 mt-0.5">
                  {s.grade_level}
                  {s.student_number ? ` · ${s.student_number}` : ""}
                  {s.archived_at ? ` · archived ${new Date(s.archived_at).toLocaleDateString()}` : ""}
                </div>
                {s.parent_emails.length > 0 && (
                  <div className="text-xs text-foreground/50 mt-1">
                    Parents: {s.parent_emails.join(", ")}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => restore(s.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background transition-colors"
                >
                  <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
                  Restore
                </button>
                <button
                  onClick={() => setDeleteModal({ student: s, loading: false })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-secondary/40 text-secondary rounded-lg hover:bg-secondary/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Delete permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteModal}
        title="Delete permanently?"
        confirmLabel="Delete permanently"
        loadingLabel="Deleting..."
        loading={deleteModal?.loading ?? false}
        onConfirm={confirmDelete}
        onClose={() => setDeleteModal(null)}
      >
        <p className="text-sm text-foreground/70 mb-1">
          Permanently delete <strong>{deleteModal?.student.full_name}</strong>.
        </p>
        <p className="text-sm text-secondary mb-5">
          This cannot be undone. All linked parent connections will be removed.
        </p>
      </ConfirmDialog>
    </div>
  );
}
