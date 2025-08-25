//box.tsx
import React from "react";
import type { ReactNode } from "react";

type TBoxProps = { children: ReactNode; className?: string };

export const Box: React.FC<TBoxProps> = (props) => {
  return (
    <div
      className={props.className}
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: "1rem",
        marginBottom: "2rem",
      }}
    >
      {props.children}
    </div>
  );
};
