const API_BASE_URL = "https://dd2e-154-115-237-128.ngrok-free.app/api";

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
      let errorMessage = "API request failed";
      try {
        const error = await response.json();
        errorMessage = error.message || error.detail || `HTTP ${response.status}: ${response.statusText}`;
      } catch (parseError) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Handle different content types
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else if (options.responseType === 'blob') {
      return { data: await response.blob() };
    } else {
      return response.text();
    }
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