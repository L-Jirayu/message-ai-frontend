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
};

// ✅ รองรับ .env (Vite) และ fallback เป็น localhost
const API_URL =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";

const JobContext = createContext<TJobContext | null>(null);

type TJobProviderProps = { children: ReactNode };

export const JobProvider: React.FC<TJobProviderProps> = ({ children }) => {
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [text, setText] = useState("");
  const [action, setAction] = useState<"send" | "pickup" | "reply" | "retry">("send");
  const [statusMsg, setStatusMsg] = useState("สถานะ: ");
  const [name, setName] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/jobs?limit=100&order=asc`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);

      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []); // ← รองรับทั้งเก่า/ใหม่

      // (ถ้าต้องการ normalize ให้ชัวร์)
      const mapped = rows.map((j: any) => ({
        _id: j._id?.$oid ?? j._id ?? j.id,
        name: j.name ?? null,
        message: j.message ?? null,
        status: j.status ?? 'unknown',
        resultSummary: j.resultSummary ?? null,
        category: j.category ?? null,
        tone: j.tone ?? null,
        priority: j.priority ?? j.urgency ?? null,
        language: j.language ?? null,
        error: j.error ?? null,
        updatedAt: j.updatedAt ?? j.updated_at ?? null,
      }));

      setJobs(mapped);
    } catch (err) {
      console.error("Fetch jobs error", err);
    }
  }, []);

  const confirmJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/worker/confirm/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Confirm failed");
      // ❌ ไม่ต้อง fetchJobs — รอ socket update
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
      // ❌ ไม่ต้อง fetchJobs — รอ socket update
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
        // ใช้ text เป็น jobId
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
      // ❌ ไม่ต้อง fetchJobs — รอ socket update
    } catch (err) {
      console.error("Submit error", err);
      setStatusMsg("สถานะ: error ตอนส่งงาน");
    }
  }, [action, text, name, retryJob]);

  useEffect(() => {
    // โหลดครั้งแรกให้มีรายการก่อน (กันหน้าโล่งถ้า socket มาช้า)
    fetchJobs();

    // ตั้งค่า Socket.IO
    const socket: Socket = io(SOCKET_URL, {
      // ถ้า Gateway ใช้ค่า default path '/socket.io' — ไม่ต้องตั้งค่า path ก็ได้
      transports: ["websocket"], // ✅ บังคับ WS ล้วน ลด preflight/ปัญหา CORS
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });

    let socketConnected = false;
    let pollTimer: number | null = null;

    const startPolling = () => {
      if (pollTimer == null) {
        pollTimer = window.setInterval(fetchJobs, 3000);
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
      console.log("✅ Connected to WebSocket:", SOCKET_URL);
      // ต่อได้แล้วไม่ต้อง polling
      console.log("🚀 Transport:", socket.io.engine.transport.name);
      stopPolling();
    });

    socket.on("disconnect", (reason) => {
      socketConnected = false;
      console.log("⚠️ WebSocket disconnected:", reason, "→ fallback to polling");
      startPolling();
    });

    socket.on("connect_error", (err) => {
      socketConnected = false;
      console.warn("⚠️ WebSocket connect_error:", err.message, "→ fallback to polling");
      startPolling();
    });

    socket.on("jobStatusUpdate", (data: TJob) => {
      setJobs((prev) => {
        const exists = prev.find((j) => j._id === data._id);
        return exists
          ? prev.map((j) => (j._id === data._id ? { ...j, ...data } : j))
          : [...prev, data];
      });
    });

    socket.on("jobDeleted", (id: string) => {
      setJobs((prev) => prev.filter((j) => j._id !== id));
    });

    // ถ้าตอน mount ต่อไม่ได้ ให้เริ่ม polling เลย
    setTimeout(() => {
      if (!socketConnected) startPolling();
    }, 800);

    return () => {
      socket.removeAllListeners();
      socket.close();
      stopPolling();
    };
  }, [fetchJobs]);

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
  };

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
};

export function useJobContext() {
  const context = useContext(JobContext);
  if (!context) throw new Error("useJobContext must be used within JobProvider");
  return context;
}
