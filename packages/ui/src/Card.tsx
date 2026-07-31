import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "", title }) => {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      {title && <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>}
      {children}
    </div>
  );
};
