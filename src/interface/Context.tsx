// src/interface/Context.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { io, Socket } from "socket.io-client";

export type TJob = {
  _id: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  name?: string | null;
  message?: string | null;
  resultSummary?: string | null;
  category?: string | null;
  tone?: string | null;
  priority?: string | null;
  language?: string | null;
  error?: string | null;
  updatedAt?: string | null;
};

type TJobContext = {
  jobs: TJob[];
  text: string;
  name: string;
  action: "send" | "pickup" | "reply" | "retry";
  statusMsg: string;
  setText: (value: string) => void;
  setName: (value: string) => void;
  setAction: (value: "send" | "pickup" | "reply" | "retry") => void;
  handleSubmit: () => void;
  confirmJob: (id: string) => void;
  retryJob: (id: string) => void;
  fetchJobs: () => void;
  // pagination
  hasMore: boolean;
  loadMore: () => void;
};

// ====== Shapes ที่มาจาก API (ไม่มี any) ======
type TMongoId = { $oid: string };

type TJobRow = {
  _id?: string | TMongoId;
  id?: string;
  name?: string | null;
  message?: string | null;
  status?: string | null;
  resultSummary?: string | null;
  category?: string | null;
  tone?: string | null;
  priority?: string | null;
  urgency?: string | null;
  language?: string | null;
  error?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

type TMeta = {
  limit?: number;
  order?: "asc" | "desc";
  hasMore?: boolean;
  nextCursor?: string | null;
} | null;

type TJobsApi =
  | TJobRow[]
  | {
      data?: TJobRow[];
      meta?: TMeta;
    };

// ====== ENV / URL ======
const API_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3000";
const SOCKET_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SOCKET_URL?.replace(/\/+$/, "") ??
  "http://localhost:3000";

// เก่าสุดอยู่บน ใหม่ลงล่าง
const ORDER: "asc" | "desc" = "asc";
const PAGE_SIZE = 100;

const JobContext = createContext<TJobContext | null>(null);

type TJobProviderProps = { children: ReactNode };

// ====== helper: แปลง row -> TJob ======
function pickId(row: TJobRow): string {
  if (typeof row._id === "object" && row._id && "$oid" in row._id) return (row._id as TMongoId).$oid;
  if (typeof row._id === "string") return row._id;
  if (typeof row.id === "string") return row.id;
  return "";
}

function rowToJob(j: TJobRow): TJob {
  return {
    _id: pickId(j),
    name: j.name ?? null,
    message: j.message ?? null,
    status: (j.status ?? "unknown") as TJob["status"],
    resultSummary: j.resultSummary ?? null,
    category: j.category ?? null,
    tone: j.tone ?? null,
    priority: j.priority ?? j.urgency ?? null,
    language: j.language ?? null,
    error: j.error ?? null,
    updatedAt: j.updatedAt ?? j.updated_at ?? null,
  };
}

export const JobProvider: React.FC<TJobProviderProps> = ({ children }) => {
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [text, setText] = useState("");
  const [action, setAction] = useState<"send" | "pickup" | "reply" | "retry">("send");
  const [statusMsg, setStatusMsg] = useState("สถานะ: ");
  const [name, setName] = useState("");

  // pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // รวมแบบ append ท้าย (กันซ้ำด้วย _id)
  const mergeAppend = useCallback((prev: TJob[], chunk: TJob[]) => {
    const seen = new Set(prev.map((j) => j._id));
    const appended = chunk.filter((j) => !seen.has(j._id));
    return [...prev, ...appended];
  }, []);

  // ดึงหน้า (หน้าแรก / หน้าถัดไป)
  const fetchPage = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean }) => {
      const cursor = opts?.cursor ?? null;
      const append = opts?.append ?? false;

      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), order: ORDER });
      if (cursor) qs.set("cursor", cursor);

      const res = await fetch(`${API_URL}/jobs?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);

      const json: TJobsApi = await res.json();

      const rows: TJobRow[] = Array.isArray(json) ? json : json.data ?? [];
      const meta: TMeta = Array.isArray(json) ? null : json.meta ?? null;

      const chunk = rows.map(rowToJob);
      setJobs((prev) => (append ? mergeAppend(prev, chunk) : chunk));

      setNextCursor(meta?.nextCursor ?? null);
      setHasMore(Boolean(meta?.hasMore));
    },
    [mergeAppend]
  );

  // หน้าแรก
  const fetchJobs = useCallback(async () => {
    try {
      await fetchPage({ append: false, cursor: null });
    } catch (err) {
      console.error("Fetch jobs error", err);
    }
  }, [fetchPage]);

  // หน้าถัดไป (ใช้ตอนกด “โหลดเพิ่ม” ฝั่ง Laravel Blade)
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    try {
      await fetchPage({ append: true, cursor: nextCursor });
    } catch (err) {
      console.error("Load more error", err);
    }
  }, [fetchPage, hasMore, nextCursor]);

  const confirmJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/worker/confirm/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Confirm failed");
    } catch (err) {
      console.error("Confirm job error", err);
    }
  }, []);

  const retryJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/worker/retry/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Retry failed");
    } catch (err) {
      console.error("Retry job error", err);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      setStatusMsg("สถานะ: กรุณาใส่ข้อความก่อนส่ง");
      return;
    }
    try {
      if (action === "retry") {
        await retryJob(text.trim());
        setStatusMsg(`สถานะ: Retry job id=${text.trim()}`);
        setText("");
        setName("");
        return;
      }

      let endpoint = "";
      switch (action) {
        case "send":
          endpoint = `${API_URL}/jobs/ingest`;
          break;
        case "pickup":
          endpoint = `${API_URL}/jobs/pickup`;
          break;
        case "reply":
          endpoint = `${API_URL}/jobs/reply`;
          break;
      }

      const payload: Record<string, unknown> = { message: text.trim() };
      if (name.trim()) payload.name = name.trim();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        setStatusMsg("สถานะ: โดนจำกัดความถี่ (429) รอสักครู่แล้วลองใหม่");
        return;
      }
      if (!res.ok) throw new Error("Submit failed");

      setStatusMsg(`สถานะ: Action=${action} | Message="${text.trim()}"`);
      setText("");
      setName("");
    } catch (err) {
      console.error("Submit error", err);
      setStatusMsg("สถานะ: error ตอนส่งงาน");
    }
  }, [action, text, name, retryJob]);

  useEffect(() => {
    // โหลดหน้าแรก
    fetchJobs();

    // ตั้งค่า Socket.IO
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });

    let socketConnected = false;
    let pollTimer: number | null = null;

    const startPolling = () => {
      if (pollTimer == null) {
        pollTimer = window.setInterval(() => fetchPage({ append: false, cursor: null }), 3000);
      }
    };
    const stopPolling = () => {
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    socket.on("connect", () => {
      socketConnected = true;
      stopPolling();
    });

    socket.on("disconnect", () => {
      socketConnected = false;
      startPolling();
    });

    socket.on("connect_error", () => {
      socketConnected = false;
      startPolling();
    });

    // อัปเดต realtime: ถ้ามีอยู่แล้วอัปเดต, ถ้าใหม่ให้ต่อท้าย (เพราะ ORDER = asc)
    socket.on("jobStatusUpdate", (dataLike: TJobRow) => {
      const data = rowToJob(dataLike);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j._id === data._id);
        if (idx >= 0) {
          const clone = prev.slice();
          clone[idx] = { ...clone[idx], ...data };
          return clone;
        }
        return [...prev, data]; // append ท้าย (ใหม่ลงล่าง)
      });
    });

    socket.on("jobDeleted", (idLike: string | TJobRow) => {
      const id = typeof idLike === "string" ? idLike : pickId(idLike);
      setJobs((prev) => prev.filter((j) => j._id !== id));
    });

    const t = window.setTimeout(() => {
      if (!socketConnected) startPolling();
    }, 800);

    return () => {
      window.clearTimeout(t);
      socket.removeAllListeners();
      socket.close();
      stopPolling();
    };
  }, [fetchJobs, fetchPage]);

  const value: TJobContext = {
    jobs,
    text,
    name,
    action,
    statusMsg,
    setText,
    setName,
    setAction,
    handleSubmit,
    confirmJob,
    retryJob,
    fetchJobs,
    hasMore,
    loadMore,
  };

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
};

export function useJobContext() {
  const context = useContext(JobContext);
  if (!context) throw new Error("useJobContext must be used within JobProvider");
  return context;
}
