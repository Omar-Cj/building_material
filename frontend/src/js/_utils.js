// src/js/_utils.js
export function handleLogout() {
  const token = localStorage.getItem('token');
  if (!token) return location.replace('index.html');
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    location.replace('index.html');
  });
}

export async function authFetch(url, opts={}) {
  const token = localStorage.getItem('token');
  const headers = opts.headers || {};
  headers['Authorization'] = `JWT ${token}`;
  opts.headers = headers;
  const res = await fetch(url, opts);
  if (res.status === 401) {
    localStorage.removeItem('token');
    location.replace('index.html');
  }
  return res.json();
}
