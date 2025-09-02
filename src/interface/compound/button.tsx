import React from "react";
import { useJobContext } from "../Context";

type TButtonProps = {
  label: string;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
  disabled?: boolean; // 👈 เพิ่ม disabled
};

export const Button: React.FC<TButtonProps> = (props) => {
  const { handleSubmit } = useJobContext();

  const handleClick = () => {
    if (props.disabled) return; // 👈 ถ้า disabled กดไม่ทำงาน
    if (props.type === "submit") {
      handleSubmit();
    } else if (props.onClick) {
      props.onClick();
    }
  };

  return (
    <button
      type={props.type ?? "button"}
      onClick={handleClick}
      disabled={props.disabled} // 👈 ส่งให้ปุ่มจริง
      className={props.className}
      style={{
        backgroundColor: props.disabled ? "#9ca3af" : "#6c9ef8", // 👈 สีเทาถ้า disabled
        color: "white",
        border: "none",
        borderRadius: "12px",
        padding: "0.75rem 1.25rem",
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontWeight: 500,
        fontSize: "1rem",
        transition: "0.2s",
        display: "block",
        marginTop: "0.75rem",
        opacity: props.disabled ? 0.6 : 1, // 👈 ทำให้ดูจางลง
      }}
    >
      {props.label}
    </button>
  );
};
