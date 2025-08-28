// src/interface/compound/namebox.tsx
import React from "react";
import { useJobContext } from "../Context";

type TNameboxProps = { placeholder?: string };

export const Namebox: React.FC<TNameboxProps> = (props) => {
  const { name, setName } = useJobContext();

  return (
    <input
      type="text"
      placeholder={props.placeholder ?? "ใส่ชื่อ"}
      value={name}
      onChange={(e) => setName(e.target.value)}
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
    />
  );
};
