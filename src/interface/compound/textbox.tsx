import React from "react";
import { useJobContext } from "../Context";

type TTextboxProps = { placeholder?: string };

export const Textbox: React.FC<TTextboxProps> = (props) => {
  const { text, setText, action } = useJobContext();

  const placeholder =
    props.placeholder ??
    (action === "retry" ? "Input id for retry in queue" : "Input the message");
    
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
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
