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
  createdAt?: string | null; // 👈 ใช้เรียงให้ตำแหน่งคงที่
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
  hasMore: boolean;
  loadMore: () => void;
};

// ====== Shapes จาก API ======
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

// Messenger mode: ขอ API แบบ "desc" (ใหม่ก่อน)
const ORDER: "asc" | "desc" = "desc";
const PAGE_SIZE = 100;

const JobContext = createContext<TJobContext | null>(null);

type TJobProviderProps = { children: ReactNode };

// ====== helpers ======
function pickId(row: TJobRow): string {
  if (typeof row._id === "object" && row._id && "$oid" in row._id) return (row._id as TMongoId).$oid;
  if (typeof row._id === "string") return row._id;
  if (typeof row.id === "string") return row.id;
  return "";
}

// ดึงเวลาสร้างจาก ObjectId (4 ไบต์แรกคือ timestamp วินาที)
function oidTime(id: string | undefined): string | null {
  if (!id || id.length < 8) return null;
  const sec = parseInt(id.substring(0, 8), 16);
  if (Number.isNaN(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

function rowToJob(j: TJobRow): TJob {
  const _id = pickId(j);
  return {
    _id,
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
    createdAt: oidTime(_id), // 👈 ใช้เรียงแชทแบบคงที่
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

  // เติม "ของเก่า" ด้านบน (prepend) และกันซ้ำ
  const mergePrepend = useCallback((prev: TJob[], olderChunk: TJob[]) => {
    const seen = new Set(prev.map((j) => j._id));
    const uniques = olderChunk.filter((j) => !seen.has(j._id));
    return [...uniques, ...prev];
  }, []);

  // เติม "ของใหม่/Realtime" ด้านล่าง (append) และกันซ้ำ
  const mergeAppend = useCallback((prev: TJob[], newerChunk: TJob[]) => {
    const seen = new Set(prev.map((j) => j._id));
    const uniques = newerChunk.filter((j) => !seen.has(j._id));
    return [...prev, ...uniques];
  }, []);

  // ดึงหน้า (หน้าแรก / ของเก่า)
  const fetchPage = useCallback(
    async (opts?: { cursor?: string | null; mode?: "initial" | "older" }) => {
      const cursor = opts?.cursor ?? null;
      const mode = opts?.mode ?? "initial";

      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), order: ORDER });
      if (cursor) qs.set("cursor", cursor);

      const res = await fetch(`${API_URL}/jobs?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);

      const json: TJobsApi = await res.json();

      const rows: TJobRow[] = Array.isArray(json) ? json : json.data ?? [];
      const meta: TMeta = Array.isArray(json) ? null : json.meta ?? null;

      // API ส่ง desc (ใหม่ก่อน) → กลับเป็น asc เพื่อ “ใหม่สุดอยู่ล่าง”
      const chunkAsc = rows.map(rowToJob).reverse();

      setJobs((prev) => (mode === "older" ? mergePrepend(prev, chunkAsc) : chunkAsc));
      setNextCursor(meta?.nextCursor ?? null);
      setHasMore(Boolean(meta?.hasMore));
    },
    [mergePrepend]
  );

  // หน้าแรก
  const fetchJobs = useCallback(async () => {
    try {
      await fetchPage({ mode: "initial", cursor: null });
    } catch (err) {
      console.error("Fetch jobs error", err);
    }
  }, [fetchPage]);

  // โหลดของเก่า (เติมด้านบน)
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    try {
      await fetchPage({ mode: "older", cursor: nextCursor });
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
        pollTimer = window.setInterval(() => fetchJobs(), 3000);
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

    // Realtime: อัปเดตถ้ามีอยู่แล้ว, ถ้าใหม่ → append ท้าย (ใหม่สุดล่าง)
    socket.on("jobStatusUpdate", (dataLike: TJobRow) => {
      const data = rowToJob(dataLike);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j._id === data._id);
        if (idx >= 0) {
          const clone = prev.slice();
          clone[idx] = { ...clone[idx], ...data };
          return clone;
        }
        return mergeAppend(prev, [data]);
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
  }, [fetchJobs, mergeAppend]);

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
