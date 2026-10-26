"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { GRADE_LEVELS } from "@/lib/grades";
import ConfirmDialog from "@/components/ConfirmDialog";

interface StudentRow {
  id: string;
  full_name: string;
  student_number: string | null;
  grade_level: string;
  code_created_at: string;
  parent_emails: string[];
}

export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; total: number; codes: { full_name: string; grade_level: string; code: string }[] } | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ full_name: "", student_number: "", grade_level: "G7" });
  const [saving, setSaving] = useState(false);
  const [resetModal, setResetModal] = useState<{
    student: StudentRow;
    step: "confirm" | "result";
    code: string | null;
    loading: boolean;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    student: StudentRow;
    loading: boolean;
  } | null>(null);

  const load = async () => {
    try {
      const sRes = await fetch("/api/admin/students");
      if (sRes.status === 401) {
        router.push("/admin/login");
        return;
      }
      const sData = await sRes.json();
      setStudents(sData.students ?? []);
    } catch {
      toast.error("Could not load data.");
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

  const createStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not create student.");
      } else {
        toast.success(`Student created. Code: ${data.code} (show once)`);
        setForm({ full_name: "", student_number: "", grade_level: "G7" });
        setShowForm(false);
        load();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const openReset = (student: StudentRow) => {
    setResetModal({ student, step: "confirm", code: null, loading: false });
  };

  const confirmReset = async () => {
    if (!resetModal) return;
    setResetModal({ ...resetModal, loading: true });
    try {
      const res = await fetch(`/api/admin/students/${resetModal.student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_code" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reset code.");
        setResetModal(null);
      } else {
        setResetModal({ ...resetModal, step: "result", code: data.code, loading: false });
      }
    } catch {
      toast.error("Network error.");
      setResetModal(null);
    }
  };

  const closeReset = () => setResetModal(null);

  const openDelete = (student: StudentRow) => {
    setDeleteModal({ student, loading: false });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteModal({ ...deleteModal, loading: true });
    try {
      const res = await fetch(`/api/admin/students/${deleteModal.student.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete.");
      } else {
        toast.success("Student archived.");
        load();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleteModal(null);
    }
  };

  const closeDelete = () => setDeleteModal(null);

  const inputClasses =
    "w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all";

  const filteredStudents = students.filter((s) => {
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

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/students/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed.");
      } else {
        setUploadResult(data);
        toast.success(`Uploaded ${data.created} of ${data.total} students.`);
        load();
      }
    } catch {
      toast.error("Network error during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <main className="space-y-6">
        <h1 className="text-xl font-bold">Manage Students</h1>


        {uploadResult && (
          <div className="bg-card border border-border rounded-xl p-4 card-elevated">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                Uploaded {uploadResult.created} of {uploadResult.total} students
              </h3>
              <button
                onClick={() => {
                  const text = uploadResult.codes.map((c) => `${c.full_name}\t${c.grade_level}\t${c.code}`).join("\n");
                  navigator.clipboard.writeText(text);
                }}
                className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-background transition-colors"
              >
                Copy codes
              </button>
            </div>
            <p className="text-xs text-foreground/60 mb-3">
              Save these codes now — they are shown only once. Each line: Name, Grade, Code.
            </p>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1 pr-3 font-medium text-foreground/60">Name</th>
                    <th className="py-1 pr-3 font-medium text-foreground/60">Grade</th>
                    <th className="py-1 font-medium text-foreground/60">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.codes.map((c, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 pr-3">{c.full_name}</td>
                      <td className="py-1 pr-3">{c.grade_level}</td>
                      <td className="py-1 font-mono font-bold text-primary">{c.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h2 className="text-lg font-semibold sm:mr-auto">
            Students ({filteredStudents.length}{filteredStudents.length !== students.length ? ` of ${students.length}` : ""})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, number, grade..."
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-secondary w-48"
            />
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="">All grades</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <label className="px-4 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-background transition-colors cursor-pointer">
              {uploading ? "Uploading..." : "Upload list"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.docx"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>

            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              + New
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={createStudent} className="bg-card border border-border rounded-xl p-6 space-y-4 card-elevated">
            <h3 className="text-base font-semibold">New Student</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Full name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className={inputClasses}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Student number</label>
                <input
                  type="text"
                  value={form.student_number}
                  onChange={(e) => setForm({ ...form, student_number: e.target.value })}
                  className={inputClasses}
                  placeholder="S001 (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Grade level *</label>
                <select
                  value={form.grade_level}
                  onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                  className={inputClasses}
                >
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Student"}
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

        {loading ? (
          <p className="text-foreground/60">Loading...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-foreground/60">
            {students.length === 0 ? "No students yet." : "No students match your filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((s) => (
              <div
                key={s.id}
                className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-elevated"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.full_name}</div>
                  <div className="text-sm text-foreground/60 mt-0.5">
                    {s.grade_level}
                    {s.student_number ? ` · ${s.student_number}` : ""}
                  </div>
                  {s.parent_emails.length > 0 && (
                    <div className="text-xs text-foreground/50 mt-1">
                      Parents: {s.parent_emails.join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openReset(s)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background transition-colors"
                  >
                    Reset code
                  </button>
                  <button
                    onClick={() => openDelete(s)}
                    className="px-3 py-1.5 text-sm border border-secondary/40 text-secondary rounded-lg hover:bg-secondary/10 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/admin/archives" className="inline-flex items-center min-h-11 text-sm text-secondary hover:opacity-80 underline underline-offset-4">
            View archived students →
          </Link>
        </div>

      </main>

      {/* Reset code modal */}
      {resetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeReset}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {resetModal.step === "confirm" ? (
              <>
                <h3 className="text-lg font-bold mb-2">Reset student code?</h3>
                <p className="text-sm text-foreground/70 mb-1">
                  Generate a new code for <strong>{resetModal.student.full_name}</strong> ({resetModal.student.grade_level}).
                </p>
                <p className="text-sm text-secondary mb-5">
                  The old code will stop working immediately.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={closeReset}
                    disabled={resetModal.loading}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmReset}
                    disabled={resetModal.loading}
                    className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {resetModal.loading && (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                    )}
                    {resetModal.loading ? "Generating..." : "Generate new code"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-2">New code generated</h3>
                <p className="text-sm text-foreground/70 mb-3">
                  Hand this code to the family. It is shown only once.
                </p>
                <div className="bg-background border border-border rounded-lg p-4 flex items-center justify-between gap-3 mb-4">
                  <span className="font-mono text-2xl font-bold text-primary tracking-widest">
                    {resetModal.code}
                  </span>
                  <button
                    onClick={() => {
                      if (resetModal.code) navigator.clipboard.writeText(resetModal.code);
                    }}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-card transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-secondary mb-4">
                  The previous code no longer works.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={closeReset}
                    className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteModal}
        title="Archive student?"
        confirmLabel="Archive student"
        loadingLabel="Archiving..."
        loading={deleteModal?.loading ?? false}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      >
        <p className="text-sm text-foreground/70 mb-1">
          Archive <strong>{deleteModal?.student.full_name}</strong> ({deleteModal?.student.grade_level}).
        </p>
        <p className="text-sm text-secondary mb-5">
          The student will be hidden from active lists and parents will no longer see their grade-level events. You can restore them later.
        </p>
      </ConfirmDialog>
    </div>
  );
}
