import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BlogApp } from "./BlogApp.jsx";
import "./Styles.css";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BlogApp />
  </StrictMode>,
);
