import Chart from "chart.js/auto";
import apiClient from "../apiClient";

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
