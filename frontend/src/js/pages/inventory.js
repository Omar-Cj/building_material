import { authFetch, handleLogout } from "../_utils.js";
handleLogout();

const API = "/api/inventory/materials/";
const tableBody = document.querySelector("#materialsTable tbody");
const form = document.getElementById("materialForm");
const modalEl = document.getElementById("materialModal");
const modal = new bootstrap.Modal(modalEl);

async function loadMaterials() {
  const data = await authFetch(API);
  tableBody.innerHTML = data
    .map(
      (m) => `
    <tr>
      <td>${m.name}</td>
      <td>${m.category}</td>
      <td>${m.unit}</td>
      <td>${m.quantity_in_stock}</td>
      <td>${m.reorder_level}</td>
      <td>${m.price_per_unit}</td>
      <td>${m.supplier}</td>
      <td>
        <button class="btn btn-sm btn-primary edit" data-id="${m.id}">✎</button>
        <button class="btn btn-sm btn-danger del" data-id="${m.id}">🗑</button>
      </td>
    </tr>
  `
    )
    .join("");
}

tableBody.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (e.target.classList.contains("edit")) return editMaterial(id);
  if (e.target.classList.contains("del")) deleteMaterial(id);
});

document
  .getElementById("materialModal")
  .addEventListener("show.bs.modal", () => {
    form.reset();
    form.materialId.value = "";
  });

async function editMaterial(id) {
  const m = await authFetch(`${API}${id}/`);
  form.materialId.value = id;
  form.mName.value = m.name;
  form.mCategory.value = m.category;
  form.mUnit.value = m.unit;
  form.mStock.value = m.quantity_in_stock;
  form.mReorder.value = m.reorder_level;
  form.mPrice.value = m.price_per_unit;
  form.mSupplier.value = m.supplier;
  modal.show();
}

async function deleteMaterial(id) {
  if (!confirm("Delete this material?")) return;
  await authFetch(`${API}${id}/`, { method: "DELETE" });
  loadMaterials();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = form.materialId.value;
  const payload = {
    name: form.mName.value,
    category: form.mCategory.value,
    unit: form.mUnit.value,
    quantity_in_stock: +form.mStock.value,
    reorder_level: +form.mReorder.value,
    price_per_unit: +form.mPrice.value,
    supplier: +form.mSupplier.value,
  };
  const opts = {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
  const url = id ? `${API}${id}/` : API;
  await authFetch(url, opts);
  modal.hide();
  loadMaterials();
});

loadMaterials();
