const API_BASE_URL = "http://127.0.0.1:8000/api";

const getToken = () => {
  const token = localStorage.getItem("token");
  console.log("Token retrieved:", token);
  return token;
};

const apiClient = {
  async request(endpoint, options = {}) {
    
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    const token = getToken();
    
    if (!isAuthEndpoint && !token) {
      throw new Error("No authentication token found");
    }

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Only add Authorization header if token exists
    if (token) {
      headers.Authorization = `JWT ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "API request failed");
    }

    return response.json();
  },

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  },

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  },
};

export default apiClient;