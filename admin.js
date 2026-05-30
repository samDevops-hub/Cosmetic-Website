/**
 * Lumière Beauty — Admin panel
 */

const API = "/api/admin";
const TOKEN_KEY = "lumiere_admin_token";

let admin = null;
let categories = [];
let selectedOrderId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function formatPrice(n) {
  return `KES ${Number(n).toLocaleString("en-KE")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast${type ? ` toast--${type}` : ""}`;
  el.textContent = msg;
  $("#toastContainer").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function statusBadge(status) {
  return `<span class="badge badge--${status}">${status}</span>`;
}

// --- Auth ---
function showApp(loggedIn) {
  const login = $("#loginScreen");
  const app = $("#adminApp");
  if (!login || !app) return;

  if (loggedIn) {
    login.setAttribute("hidden", "");
    login.classList.add("is-hidden");
    login.setAttribute("aria-hidden", "true");
    app.removeAttribute("hidden");
    app.classList.add("is-active");
    app.setAttribute("aria-hidden", "false");
  } else {
    login.removeAttribute("hidden");
    login.classList.remove("is-hidden");
    login.setAttribute("aria-hidden", "false");
    app.setAttribute("hidden", "");
    app.classList.remove("is-active");
    app.setAttribute("aria-hidden", "true");
  }
}

async function init() {
  bindEvents();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    showApp(false);
    return;
  }
  try {
    const { admin: a } = await api("/me");
    admin = a;
    $("#adminName").textContent = a.name;
    showApp(true);
    showView("dashboard");
    loadCategories().catch((err) => toast(err.message, "error"));
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    showApp(false);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { admin: a, token } = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        email: fd.get("email").trim(),
        password: fd.get("password"),
      }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    admin = a;
    $("#adminName").textContent = a.name;
    showApp(true);
    showView("dashboard");
    e.target.reset();
    toast(`Welcome back, ${a.name.split(" ")[0]}!`);

    loadCategories().catch((err) => toast(err.message, "error"));
  } catch (err) {
    toast(err.message, "error");
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  admin = null;
  showApp(false);
  toast("Signed out.");
}

// --- Navigation ---
const viewTitles = {
  dashboard: "Dashboard",
  products: "Products",
  orders: "Orders",
  customers: "Customers",
};

function showView(name) {
  $$(".sidebar__link").forEach((l) => l.classList.toggle("active", l.dataset.view === name));
  $$(".view").forEach((v) => { v.hidden = true; });

  const panel = $(`#view-${name}`);
  if (!panel) {
    console.error("Admin view not found:", name);
    return;
  }
  panel.hidden = false;

  $("#viewTitle").textContent = viewTitles[name];
  $("#addProductBtn").hidden = name !== "products";

  if (name === "dashboard") loadDashboard();
  else if (name === "products") loadProducts();
  else if (name === "orders") loadOrders();
  else if (name === "customers") loadCustomers();
}

// --- Dashboard ---
async function loadDashboard() {
  $("#statsGrid").innerHTML = '<p class="loading-msg">Loading dashboard…</p>';
  $("#recentOrdersTable").innerHTML = "";

  try {
    const stats = await api("/stats");
    $("#statsGrid").innerHTML = `
      <div class="stat-card">
        <div class="stat-card__label">Total revenue</div>
        <div class="stat-card__value">${formatPrice(stats.revenue)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Orders today</div>
        <div class="stat-card__value">${stats.ordersToday}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Revenue today</div>
        <div class="stat-card__value">${formatPrice(stats.revenueToday)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Total orders</div>
        <div class="stat-card__value">${stats.orders}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Products</div>
        <div class="stat-card__value">${stats.products}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Low stock (≤5)</div>
        <div class="stat-card__value ${stats.lowStock > 0 ? "stat-card__value--warn" : ""}">${stats.lowStock}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Customers</div>
        <div class="stat-card__value">${stats.users}</div>
      </div>`;

    if (!stats.recentOrders.length) {
      $("#recentOrdersTable").innerHTML = "<p>No orders yet.</p>";
      return;
    }

    $("#recentOrdersTable").innerHTML = `
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${stats.recentOrders.map((o) => `
            <tr>
              <td><button type="button" class="btn btn--ghost btn--sm" data-order="${o.id}">${o.id}</button></td>
              <td>${escapeHtml(o.customer_name)}</td>
              <td>${formatPrice(o.total)}</td>
              <td>${statusBadge(o.payment_status)}</td>
              <td>${formatDate(o.created_at)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    $("#recentOrdersTable [data-order]").forEach((btn) => {
      btn.addEventListener("click", () => openOrder(btn.dataset.order));
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Products ---
async function loadCategories() {
  categories = await api("/categories");
  const sel = $("#productCategory");
  sel.innerHTML = categories.map((c) =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join("");
}

async function loadProducts() {
  try {
    const products = await api("/products");
    if (!products.length) {
      $("#productsTable").innerHTML = "<p>No products. Add your first product.</p>";
      return;
    }

    $("#productsTable").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Product</th><th>Brand</th><th>Category</th><th>Price</th>
            <th>Stock</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${products.map((p) => `
            <tr>
              <td>
                <strong>${escapeHtml(p.name)}</strong>
                ${p.featured ? '<span class="badge badge--paid">Featured</span>' : ""}
              </td>
              <td>${escapeHtml(p.brand)}</td>
              <td>${escapeHtml(p.category)}</td>
              <td>${formatPrice(p.price)}</td>
              <td>
                ${p.stock <= 5 ? `<span class="badge badge--low">${p.stock}</span>` : p.stock}
              </td>
              <td class="table-actions">
                <button type="button" class="btn btn--ghost btn--sm" data-edit="${p.id}">Edit</button>
                <button type="button" class="btn btn--ghost btn--sm" data-stock="${p.id}">Stock</button>
                <button type="button" class="btn btn--danger btn--sm" data-delete="${p.id}">Delete</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    $("#productsTable [data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => editProduct(btn.dataset.edit, products));
    });
    $("#productsTable [data-stock]").forEach((btn) => {
      btn.addEventListener("click", () => quickStock(btn.dataset.stock, products));
    });
    $("#productsTable [data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteProduct(btn.dataset.delete));
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

function openProductModal(product = null) {
  const form = $("#productForm");
  form.reset();
  $("#productId").value = product?.id || "";
  $("#productModalTitle").textContent = product ? "Edit product" : "Add product";

  if (product) {
    form.elements.name.value = product.name;
    form.elements.brand.value = product.brand;
    form.elements.category.value = product.category;
    form.elements.price.value = product.price;
    form.elements.stock.value = product.stock;
    form.elements.image.value = product.image;
    form.elements.featured.checked = product.featured;
  }

  $("#productModal").showModal();
}

async function editProduct(id, products) {
  const p = products.find((x) => x.id === id);
  if (p) openProductModal(p);
}

async function quickStock(id, products) {
  const p = products.find((x) => x.id === id);
  const val = prompt(`Set stock for "${p?.name}":`, p?.stock ?? 0);
  if (val === null) return;
  const stock = parseInt(val, 10);
  if (isNaN(stock) || stock < 0) {
    toast("Enter a valid number.", "error");
    return;
  }
  try {
    await api(`/products/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ stock }),
    });
    toast("Stock updated.");
    loadProducts();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const form = e.target;
  const id = $("#productId").value;
  const body = {
    name: form.elements.name.value,
    brand: form.elements.brand.value,
    category: form.elements.category.value,
    price: Number(form.elements.price.value),
    stock: Number(form.elements.stock.value),
    image: form.elements.image.value,
    featured: form.elements.featured.checked,
  };

  try {
    if (id) {
      await api(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) });
      toast("Product updated.");
    } else {
      await api("/products", { method: "POST", body: JSON.stringify(body) });
      toast("Product created.");
    }
    $("#productModal").close();
    loadProducts();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try {
    await api(`/products/${id}`, { method: "DELETE" });
    toast("Product deleted.");
    loadProducts();
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Orders ---
async function loadOrders() {
  const status = $("#orderStatusFilter").value;
  const qs = status ? `?status=${status}` : "";
  try {
    const orders = await api(`/orders${qs}`);
    if (!orders.length) {
      $("#ordersTable").innerHTML = "<p>No orders found.</p>";
      return;
    }

    $("#ordersTable").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Order ID</th><th>Customer</th><th>Total</th>
            <th>Payment</th><th>Status</th><th>Date</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>${o.id}</td>
              <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email)}</small></td>
              <td>${formatPrice(o.total)}</td>
              <td>${o.payment_method}</td>
              <td>${statusBadge(o.payment_status)}</td>
              <td>${formatDate(o.created_at)}</td>
              <td><button type="button" class="btn btn--ghost btn--sm" data-order="${o.id}">View</button></td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    $("#ordersTable [data-order]").forEach((btn) => {
      btn.addEventListener("click", () => openOrder(btn.dataset.order));
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

async function openOrder(id) {
  selectedOrderId = id;
  try {
    const order = await api(`/orders/${id}`);

    $("#orderDetail").innerHTML = `
      <p><strong>Order:</strong> ${order.id}</p>
      <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(order.customer_email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone)}</p>
      <p><strong>Address:</strong> ${escapeHtml(order.customer_address)}</p>
      <p><strong>Total:</strong> ${formatPrice(order.total)}</p>
      <p><strong>Payment:</strong> ${order.payment_method} ${order.payment_ref ? `(${escapeHtml(order.payment_ref)})` : ""}</p>
      <p><strong>Items:</strong></p>
      <ul>
        ${(order.items || []).map((i) =>
          `<li>${escapeHtml(i.name)} × ${i.qty} — ${formatPrice(i.unit_price * i.qty)}</li>`
        ).join("")}
      </ul>`;

    $("#orderStatusSelect").value = order.payment_status;
    $("#orderModal").showModal();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function saveOrderStatus() {
  if (!selectedOrderId) return;
  try {
    await api(`/orders/${selectedOrderId}`, {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus: $("#orderStatusSelect").value }),
    });
    toast("Order status updated.");
    $("#orderModal").close();
    loadOrders();
    if (!$("#view-dashboard").hidden) loadDashboard();
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Customers ---
async function loadCustomers() {
  try {
    const users = await api("/users");
    if (!users.length) {
      $("#customersTable").innerHTML = "<p>No registered customers yet.</p>";
      return;
    }

    $("#customersTable").innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.phone || "—")}</td>
              <td>${formatDate(u.created_at)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    toast(err.message, "error");
  }
}

// --- Events ---
function bindEvents() {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#logoutBtn").addEventListener("click", handleLogout);

  $$(".sidebar__link").forEach((link) => {
    link.addEventListener("click", () => showView(link.dataset.view));
  });

  $("#addProductBtn").addEventListener("click", () => openProductModal());
  $("#productForm").addEventListener("submit", saveProduct);
  $("#productModalClose").addEventListener("click", () => $("#productModal").close());
  $("#productCancel").addEventListener("click", () => $("#productModal").close());
  $("#orderModalClose").addEventListener("click", () => $("#orderModal").close());
  $("#saveOrderStatus").addEventListener("click", saveOrderStatus);
  $("#orderStatusFilter").addEventListener("change", loadOrders);
}

document.addEventListener("DOMContentLoaded", init);
