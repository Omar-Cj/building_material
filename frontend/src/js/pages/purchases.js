// src/js/purchases.js
import { authFetch, handleLogout } from "../_utils.js";
handleLogout();
const API = "/api/purchases/orders/";
const supplierSel = document.getElementById("poSupplier");
const tbody = document.querySelector("#poItems tbody");
const form = document.getElementById("poForm");

// load suppliers & materials
let materials = [];
Promise.all([
  authFetch("/api/suppliers/").then((d) =>
    d.forEach(
      (s) =>
        (supplierSel.innerHTML += `<option value="${s.id}">${s.name}</option>`)
    )
  ),
  authFetch("/api/inventory/materials/").then((d) => (materials = d)),
]).then(() => addRow());

// add/remove row
document.getElementById("addRow").addEventListener("click", (e) => {
  e.preventDefault();
  addRow();
});
function addRow() {
  const idx = tbody.children.length;
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>
      <select class="form-select item-material" data-idx="${idx}">
        ${materials
          .map((m) => `<option value="${m.id}">${m.name}</option>`)
          .join("")}
      </select>
    </td>
    <td><input type="number" class="form-control item-qty" data-idx="${idx}" required></td>
    <td><input type="number" step="0.01" class="form-control item-price" data-idx="${idx}" required></td>
    <td><button class="btn btn-sm btn-danger remove" data-idx="${idx}">×</button></td>
  `;
  tbody.append(row);
}

// handle remove
tbody.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove")) {
    e.target.closest("tr").remove();
  }
});

// submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const items = Array.from(tbody.querySelectorAll("tr")).map((r) => {
    return {
      material: +r.querySelector(".item-material").value,
      quantity: +r.querySelector(".item-qty").value,
      price: +r.querySelector(".item-price").value,
    };
  });
  const payload = {
    supplier: +supplierSel.value,
    items,
  };
  await authFetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  alert("PO Created");
  form.reset();
  tbody.innerHTML = "";
  addRow();
});
