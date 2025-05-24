import Chart from "chart.js/auto";
import apiClient from "./apiClient";
import "../css/sidebar.scss";
import "../css/nav.scss";

const token = localStorage.getItem("token");
if (!token) location.replace("index.html");

document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("token");
  location.replace("index.html");
};

// 1. Inventory value
apiClient.get("/dashboard/inventory-value/").then((data) => {
  document.getElementById("inventoryValue").textContent =
    new Intl.NumberFormat().format(data.total_inventory_value);
});

// 2. Top-selling materials chart
apiClient.get("/dashboard/top-selling-materials/?limit=5").then((data) => {
  new Chart(document.getElementById("topSellingChart"), {
    type: "bar",
    data: {
      labels: data.map((d) => d.material__name),
      datasets: [
        {
          label: "Qty Sold",
          data: data.map((d) => d.total_sold),
        },
      ],
    },
    options: { responsive: true },
  });
});

// 3. Monthly summary chart
apiClient
  .get(`/dashboard/monthly-summary/?year=${new Date().getFullYear()}`)
  .then(({ labels, sales, purchases, expenses }) => {
    new Chart(document.getElementById("monthlySummaryChart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Sales", data: sales },
          { label: "Purchases", data: purchases },
          { label: "Expenses", data: expenses },
        ],
      },
      options: { responsive: true },
    });
  });

document.body.innerHTML =
  `
  <div class="navbar">
    <div class="brand">Building Material</div>
    <ul class="links">
      <li class="link-item"><a href="dashboard.html">Dashboard</a></li>
      <li class="link-item"><a href="inventory.html">Inventory</a></li>
      <li class="link-item"><a href="sales.html">Sales</a></li>
      <li class="link-item"><a href="purchases.html">Purchases</a></li>
      <li class="link-item"><a href="expenses.html">Expenses</a></li>
      <li class="link-item"><a href="reports.html">Reports</a></li>
      <li class="link-item"><a href="suppliers.html">Suppliers</a></li>
      <li class="link-item"><a href="customers.html">Customers</a></li>
    </ul>
  </div>
` + document.body.innerHTML;
