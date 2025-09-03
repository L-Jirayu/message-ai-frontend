import React, { useEffect, useMemo, useRef, useState } from "react";
import { JobProvider, useJobContext } from "./Context";
import { Button } from "./compound/button";
import { Box } from "./compound/box";
import { Textbox } from "./compound/textbox";
import { Namebox } from "./compound/namebox";
import { Select } from "./compound/select";
import "./css/style.css";

const InterfaceRoot: React.FC<{ children: React.ReactNode }> = (props) => {
  return <JobProvider>{props.children}</JobProvider>;
};

type TInterfaceContentProps = { children?: React.ReactNode };
const InterfaceContent: React.FC<TInterfaceContentProps> = (props) => {
  return <div className="container">{props.children}</div>;
};

// ---------------- Chat-like Job List ----------------
const BOTTOM_THRESHOLD = 60; // px

const InterfaceJobList: React.FC = () => {
  const { jobs, fetchJobs, hasMore, loadMore } = useJobContext();

  const listRef = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);           // ติดตามท้ายลิสต์ไหม
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const wasLoadingOlderRef = useRef(false);

  // หน้าแรก
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // เมื่อ jobs เปลี่ยน:
  // - ถ้าเพิ่ง "prepend" (โหลดของเก่า): รักษาตำแหน่ง viewport เดิม
  // - ถ้ายัง follow → เลื่อนลงล่างเสมอ (ไม่ว่าเพิ่มแถวใหม่หรือแถวเดิมถูกอัปเดต)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    if (wasLoadingOlderRef.current) {
      const oldScrollHeight = (el as any).__prevScrollHeight ?? el.scrollHeight;
      const delta = el.scrollHeight - oldScrollHeight;
      el.scrollTop = el.scrollTop + delta; // คงตำแหน่งเดิม
      wasLoadingOlderRef.current = false;
      (el as any).__prevScrollHeight = undefined;
      return;
    }

    if (follow) {
      el.scrollTop = el.scrollHeight; // auto-follow
    }
  }, [jobs, follow]);

  // เช็คการเลื่อนเพื่อเปิด/ปิด follow + โหลดของเก่าเมื่อเลื่อนใกล้บน
  const onScroll = async () => {
    const el = listRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < BOTTOM_THRESHOLD;

    if (!nearBottom && follow) setFollow(false);
    if (nearBottom && !follow) setFollow(true);

    if (el.scrollTop < 40 && hasMore && !isLoadingOlder) {
      try {
        setIsLoadingOlder(true);
        (el as any).__prevScrollHeight = el.scrollHeight;
        wasLoadingOlderRef.current = true;
        await loadMore();
      } finally {
        setIsLoadingOlder(false);
      }
    }
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollow(true);
  };

  // เรียง “เก่าสุดบน → ใหม่สุดล่าง” ด้วย createdAt (คงตำแหน่ง ไม่กระโดดตอน updated)
  const orderedJobs = useMemo(() => {
    return jobs.slice().sort((a, b) => {
      const ax = a.createdAt ?? "";
      const bx = b.createdAt ?? "";
      if (ax && bx) return ax.localeCompare(bx);
      return a._id.localeCompare(b._id);
    });
  }, [jobs]);

  return (
    <div className="chat-window">
      {hasMore && (
        <div className="chat-topbar">
          <Button
            label={isLoadingOlder ? "กำลังโหลด..." : "โหลดข้อความเก่า"}
            type="button"
            onClick={async () => {
              const el = listRef.current;
              if (!el) return;
              try {
                setIsLoadingOlder(true);
                (el as any).__prevScrollHeight = el.scrollHeight;
                wasLoadingOlderRef.current = true;
                await loadMore();
              } finally {
                setIsLoadingOlder(false);
              }
            }}
            disabled={isLoadingOlder}
          />
        </div>
      )}

      <div ref={listRef} className="chat-scroll" onScroll={onScroll}>
        {jobs.length === 0 ? (
          <p className="chat-empty">ยังไม่มีงานในระบบ</p>
        ) : (
          orderedJobs.map((job) => (
            <div key={job._id} className="chat-bubble">
              <div className="chat-meta">
                <strong className="chat-name">{job.name ?? "-"}</strong>
                {job.updatedAt && <span className="chat-time">{job.updatedAt}</span>}
              </div>
              {job.message && <div className="chat-text">{job.message}</div>}
              <div className="chat-status">status: {job.status}</div>
            </div>
          ))
        )}
      </div>

      {!follow && (
        <button className="chat-jump" onClick={scrollToBottom}>
          ไปข้อความล่าสุด
        </button>
      )}
    </div>
  );
};

// ---------------- Preset: Job Action ----------------
const InterfaceJobAction: React.FC = () => {
  const { statusMsg, handleSubmit } = useJobContext();

  return (
    <Box>
      <div style={{ marginBottom: "1rem" }}>
        <Namebox placeholder="ใส่ชื่อ" />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <Textbox placeholder="ใส่ข้อความ payload" />
      </div>
      <Button label="Submit" type="button" onClick={handleSubmit} />
      <p className="text-muted" style={{ marginTop: "1rem", fontWeight: "bold" }}>
        {statusMsg}
      </p>
    </Box>
  );
};

export const Interface = Object.assign(InterfaceRoot, {
  Content: InterfaceContent,
  JobList: InterfaceJobList,
  JobAction: InterfaceJobAction,
  Button,
  Textbox,
  Namebox,
  Box,
  Select,
});
