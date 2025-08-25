import React from "react";
import { useJobContext } from "./Context";

type TSelectProps = {
  className?: string;
};

export const Select: React.FC<TSelectProps> = (props) => {
  const { action, setAction } = useJobContext();

  return (
    <select
      className={props.className}
      value={action}
      onChange={(e) => setAction(e.target.value)}
      style={{
        display: "block",
        padding: "0.75rem 1rem",
        border: "1px solid #ddd",
        borderRadius: "8px",
        width: "100%",
        fontSize: "1rem",
        marginBottom: "1rem",
        boxSizing: "border-box",
      }}
    >
      <option value="send">Send to Queue</option>
      <option value="retry">Retry in Queue</option>
    </select>
  );
};
