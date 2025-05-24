import apiClient from "./apiClient.js";

const form = document.getElementById("loginForm");
const err = document.getElementById("errorMsg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.classList.add("d-none");
  const email = form.email.value;
  const password = form.password.value;

  try {
    const res = await apiClient.post("/auth/token/", {
      email,
      password,
    });
    
    console.log("Full login response:", res);
    
    // Try to access tokens from different possible locations
    const access = res.access || res.data?.access;
    const refresh = res.refresh || res.data?.refresh;
    
    if (!access) {
      throw new Error("No access token received from server");
    }
    
    console.log("Login successful, tokens:", { access, refresh });
    localStorage.setItem("token", access);
    
    // Also store refresh token if available
    if (refresh) {
      localStorage.setItem("refreshToken", refresh);
    }
    
    window.location.href = "dashboard.html";
  } catch (e) {
    console.error("Login error:", e);
    err.textContent = e.message;
    err.classList.remove("d-none");
  }
});