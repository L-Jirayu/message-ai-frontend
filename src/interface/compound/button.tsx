import React from "react";
import { useJobContext } from "../Context";

type TButtonProps = {
  label: string;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
};

export const Button: React.FC<TButtonProps> = (props) => {
  const { handleSubmit } = useJobContext();

  const handleClick = () => {
    if (props.type === "submit") {
      handleSubmit();
    } else if (props.onClick) {
      props.onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={props.className}
      style={{
        backgroundColor: "#6c9ef8",
        color: "white",
        border: "none",
        borderRadius: "12px",
        padding: "0.75rem 1.25rem",
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "1rem",
        transition: "0.2s",
        display: "block",
        marginTop: "0.75rem",
      }}
    >
      {props.label}
    </button>
  );
};
