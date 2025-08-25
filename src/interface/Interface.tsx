import React, { useEffect } from "react";
import { JobProvider, useJobContext } from "./Context";
import { Button } from "./button";
import { Box } from "./box";
import { Textbox } from "./textbox";
import { Select } from "./select";
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
  const { jobs, confirmJob, fetchJobs } = useJobContext();

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
            <strong>ID:</strong> {job._id}
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

          {job.status === "processing" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <Button label="Confirm" onClick={() => confirmJob(job._id)} />
            </div>
          )}
        </Box>
      ))}
    </>
  );
};

// ---------------- Preset: Job Action ----------------
const InterfaceJobAction: React.FC = () => {
  const { statusMsg } = useJobContext();

  return (
    <Box>
      <h2>Job Action</h2>

      <div style={{ marginBottom: "1rem" }}>
        <Textbox placeholder="ใส่ข้อความ payload" />
      </div>
      
      <Button label="Submit" type="submit" />
      <p
        className="text-muted"
        style={{ marginTop: "1rem", fontWeight: "bold" }}
      >
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
  Box: Box,
  Select: Select,
});
