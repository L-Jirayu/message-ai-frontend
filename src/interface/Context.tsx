// src/interface/Context.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export type TJob = {
  _id: string;
  status: string;
  message?: string;
};

type TJobContext = {
  jobs: TJob[];
  text: string;
  action: string;
  statusMsg: string;
  setText: (value: string) => void;
  setAction: (value: string) => void;
  handleSubmit: () => void;
  confirmJob: (id: string) => void;
  retryJob: (id: string) => void;
  fetchJobs: () => void;
};

const API_URL = "http://localhost:3000";
const JobContext = createContext<TJobContext | null>(null);

type TJobProviderProps = { children: ReactNode };

export const JobProvider: React.FC<TJobProviderProps> = ({ children }) => {
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [text, setText] = useState("");
  const [action, setAction] = useState("send");
  const [statusMsg, setStatusMsg] = useState("สถานะ: ");

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/jobs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error("Fetch jobs error", err);
    }
  }, []);

  const confirmJob = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/worker/confirm/${id}`, { method: "PATCH", credentials: "include" });
      await fetchJobs();
    } catch (err) {
      console.error("Confirm job error", err);
    }
  }, [fetchJobs]);

  const retryJob = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/worker/retry/${id}`, { method: "PATCH", credentials: "include" });
      await fetchJobs();
    } catch (err) {
      console.error("Retry job error", err);
    }
  }, [fetchJobs]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      setStatusMsg("สถานะ: กรุณาใส่ข้อความก่อนส่ง");
      return;
    }

    try {
      if (action === "retry") {
        await retryJob(text); // 👈 ใช้ text เป็น job id
        setStatusMsg(`สถานะ: Retry job id=${text}`);
        setText("");
        return;
      }

      let endpoint = "";
      switch (action) {
        case "send":   endpoint = `${API_URL}/jobs/ingest`; break;
        case "pickup": endpoint = `${API_URL}/jobs/pickup`; break;
        case "reply":  endpoint = `${API_URL}/jobs/reply`; break;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error("Submit failed");

      setStatusMsg(`สถานะ: Action=${action} | Message="${text}"`);
      setText("");
      await fetchJobs();
    } catch (err) {
      console.error("Submit error", err);
      setStatusMsg("สถานะ: error ตอนส่งงาน");
    }
  }, [action, text, fetchJobs, retryJob]);


  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);
  
  const value: TJobContext = {
    jobs, text, action, statusMsg,
    setText, setAction, handleSubmit,
    confirmJob, retryJob, fetchJobs
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};

export function useJobContext() {
  const context = useContext(JobContext);
  if (!context) throw new Error("useJobContext must be used within JobProvider");
  return context;
}
