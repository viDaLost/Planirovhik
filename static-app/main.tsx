import { createRoot } from "react-dom/client";
import { PlannerApp } from "@/app/components/PlannerApp";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Planirov root element is missing");
}

createRoot(root).render(<PlannerApp />);
