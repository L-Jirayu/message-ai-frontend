import React, { useEffect } from "react";
import { JobProvider, useJobContext } from "./Context";
import { Button } from "./compound/button";
import { Box } from "./compound/box";
import { Textbox } from "./compound/textbox";
import { Namebox } from "./compound/ืnamebox";
import { Select } from "./compound/select";
import "./css/style.css";

const InterfaceRoot: React.FC<{ children: React.ReactNode }> = (props) => {
  return <JobProvider>{props.children}</JobProvider>;
};

// ---------------- Container ----------------
type TInterfaceContentProps = { children?: React.ReactNode };

const InterfaceContent: React.FC<TInterfaceContentProps> = (props) => {
  return <div className="container">{props.children}</div>;
};

// ---------------- Preset: Job List ----------------
const InterfaceJobList: React.FC = () => {
  const { jobs, fetchJobs } = useJobContext();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  if (jobs.length === 0) {
    return <p style={{ color: "#6b7280" }}>ยังไม่มีงานในระบบ</p>;
  }

  return (
    <>
      {jobs.map((job) => (
        <Box key={job._id}>
          <p>
            <strong>Name:</strong> {job.name}
          </p>

          {job.message && (
            <p>
              <strong>Message:</strong> {job.message}
            </p>
          )}

          <p>
            <strong>Status:</strong>{" "}
            <span
              style={{
                color:
                  job.status === "success"
                    ? "#4ade80"
                    : job.status === "failed"
                    ? "#f87171"
                    : job.status === "processing"
                    ? "#b45309" // สีเข้มขึ้น
                    : "#1f2937",
              }}
            >
              {job.status}
            </span>
          </p>

          {job.status === "processing" }
        </Box>
      ))}
    </>
  );
};

// ---------------- Preset: Job Action ----------------
const InterfaceJobAction: React.FC = () => {
  const { statusMsg, handleSubmit } = useJobContext();

  return (
    <Box>
      {/* ช่องกรอกชื่อ */}
      <div style={{ marginBottom: "1rem" }}>
        <Namebox placeholder="ใส่ชื่อ" />
      </div>

      {/* ช่องกรอกข้อความ (message) */}
      <div style={{ marginBottom: "1rem" }}>
        <Textbox placeholder="ใส่ข้อความ payload" />
      </div>

      {/* ให้ปุ่มเป็น type="button" และเรียก handleSubmit */}
      <Button label="Submit" type="button" onClick={handleSubmit} />

      <p className="text-muted" style={{ marginTop: "1rem", fontWeight: "bold" }}>
        {statusMsg}
      </p>
    </Box>
  );
};

// ---------------- Compound Object ----------------
export const Interface = Object.assign(InterfaceRoot, {
  Content: InterfaceContent,
  JobList: InterfaceJobList,
  JobAction: InterfaceJobAction,
  Button: Button,
  Textbox: Textbox,
  Namebox: Namebox,
  Box: Box,
  Select: Select,
});
