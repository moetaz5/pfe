// src/components/ui/button.js
import React from 'react';

const Button = ({ children, className, variant, size, ...props }) => {
  const baseStyles = "py-2 px-4 rounded-md font-medium transition-all";

  // Styles pour les variantes (par exemple, 'ghost' ou 'outline')
  const variantStyles = variant === "ghost"
    ? "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-100"
    : "bg-blue-500 text-white hover:bg-blue-600";

  // Styles pour la taille (par exemple, 'lg' ou 'sm')
  const sizeStyles = size === "lg"
    ? "text-lg py-3 px-6"
    : "text-sm py-2 px-4";

  return (
    <button className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`} {...props}>
      {children}
    </button>
  );
};

export { Button };
