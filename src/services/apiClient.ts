import axios from "axios";

// Usa VITE_API_URL si existe, si no, por defecto localhost (solo para dev)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

console.log("API URL en este build:", API_URL);

export const api = axios.create({
  baseURL: API_URL,
});
