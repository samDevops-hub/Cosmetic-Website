/**
 * Lumière Beauty — frontend (API-backed)
 * Run: npm install && npm start → http://localhost:3000
 */

const API = "/api";
const TOKEN_KEY = "lumiere_token";
const CART_KEY = "lumiere_cart";

// --- API client ---
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// --- State ---
let categories = [];
let products = [];
let cart = loadCart();
let currentUser = null;

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  year: $("#year"),
  categoryGrid: $("#categoryGrid"),
  categoryFilter: $("#categoryFilter"),
  productGrid: $("#productGrid"),
  emptyProducts: $("#emptyProducts"),
  searchInput: $("#searchInput"),
  sortFilter: $("#sortFilter"),
  cartCount: $("#cartCount"),
  cartItems: $("#cartItems"),
  cartSubtotal: $("#cartSubtotal"),
  checkoutBtn: $("#checkoutBtn"),
  cartDrawer: $("#cartDrawer"),
  authModal: $("#authModal"),
  checkoutModal: $("#checkoutModal"),
  authUserPanel: $("#authUserPanel"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  logoutBtn: $("#logoutBtn"),
  checkoutTotal: $("#checkoutTotal"),
  toastContainer: $("#toastContainer"),
};

// --- Init ---
async function init() {
  els.year.textContent = new Date().getFullYear();
  bindEvents();

  try {
    await loadCatalog();
    await restoreSession();
    populateCategoryFilter();
    renderCategories();
    renderProducts();
    updateCartUI();
    updateAuthUI();
  } catch (err) {
    console.error(err);
    toast("Could not reach the server. Run: npm install && npm start", "error");
    els.productGrid.innerHTML =
      '<p class="empty-state">Start the backend with <code>npm start</code>, then refresh.</p>';
  }
}

async function loadCatalog() {
  const [cats, prods] = await Promise.all([
    api("/categories"),
    api("/products"),
  ]);
  categories = cats;
  products = prods;
}

async function restoreSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    const { user } = await api("/auth/me");
    currentUser = user;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    currentUser = null;
  }
}

function bindEvents() {
  $("#menuToggle").addEventListener("click", toggleMobileNav);
  $("#searchToggle").addEventListener("click", () => {
    const bar = $("#searchBar");
    const open = bar.hidden;
    bar.hidden = !open;
    if (open) els.searchInput.focus();
  });
  $("#cartToggle").addEventListener("click", () => openDrawer(true));
  $("#cartClose").addEventListener("click", () => openDrawer(false));
  $("#cartOverlay").addEventListener("click", () => openDrawer(false));
  $("#authToggle").addEventListener("click", openAuth);
  $("#footerAuth").addEventListener("click", (e) => { e.preventDefault(); openAuth(); });
  $("#authClose").addEventListener("click", () => els.authModal.close());
  $("#checkoutClose").addEventListener("click", closeCheckout);
  $("#checkoutBtn").addEventListener("click", startCheckout);
  $("#continueShopping").addEventListener("click", () => { closeCheckout(); openDrawer(false); });

  els.searchInput.addEventListener("input", () => renderProducts());
  els.categoryFilter.addEventListener("change", () => renderProducts());
  els.sortFilter.addEventListener("change", () => renderProducts());

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab)));
  els.loginForm.addEventListener("submit", handleLogin);
  els.registerForm.addEventListener("submit", handleRegister);
  els.logoutBtn.addEventListener("click", handleLogout);

  $$('input[name="payment"]').forEach((r) => r.addEventListener("change", togglePaymentFields));
  $$("[data-next]").forEach((btn) => btn.addEventListener("click", () => goCheckoutStep(Number(btn.dataset.next))));
  $$("[data-prev]").forEach((btn) => btn.addEventListener("click", () => goCheckoutStep(Number(btn.dataset.prev))));
  $("#placeOrderBtn").addEventListener("click", placeOrder);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      openDrawer(false);
      els.authModal.close();
      closeCheckout();
    }
  });
}

// --- Cart (client-side) ---
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

function getProduct(id) {
  return products.find((p) => p.id === id);
}

function addToCart(productId) {
  const p = getProduct(productId);
  if (!p || p.stock <= 0) {
    toast("This item is out of stock.", "error");
    return;
  }
  const existing = cart.find((i) => i.productId === productId);
  const qty = existing ? existing.qty + 1 : 1;
  if (qty > p.stock) {
    toast(`Only ${p.stock} left in stock.`, "error");
    return;
  }
  if (existing) existing.qty = qty;
  else cart.push({ productId, qty: 1 });
  saveCart();
  toast("Added to your bag");
  openDrawer(true);
}

function updateQty(productId, delta) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;
  const p = getProduct(productId);
  const stock = p?.stock ?? 0;
  const next = item.qty + delta;
  if (next <= 0) cart = cart.filter((i) => i.productId !== productId);
  else if (next > stock) toast(`Only ${stock} available.`, "error");
  else item.qty = next;
  saveCart();
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.productId !== productId);
  saveCart();
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    const p = getProduct(item.productId);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function formatPrice(amount) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function updateCartUI() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  els.cartCount.textContent = count;
  els.cartCount.hidden = count === 0;
  els.cartSubtotal.textContent = formatPrice(getCartTotal());
  els.checkoutBtn.disabled = cart.length === 0;

  if (cart.length === 0) {
    els.cartItems.innerHTML = '<p class="cart-empty">Your bag is empty.<br><a href="#shop">Browse products</a></p>';
    return;
  }

  els.cartItems.innerHTML = cart.map((item) => {
    const p = getProduct(item.productId);
    if (!p) return "";
    return `
      <article class="cart-item">
        <img class="cart-item__img" src="${p.image}" alt="">
        <div class="cart-item__info">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="price">${formatPrice(p.price * item.qty)}</span>
          <div class="cart-item__qty">
            <button type="button" aria-label="Decrease" data-action="dec" data-id="${p.id}">−</button>
            <span>${item.qty}</span>
            <button type="button" aria-label="Increase" data-action="inc" data-id="${p.id}">+</button>
          </div>
          <button type="button" class="cart-item__remove" data-action="remove" data-id="${p.id}">Remove</button>
        </div>
      </article>`;
  }).join("");

  els.cartItems.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === "inc") updateQty(id, 1);
      else if (btn.dataset.action === "dec") updateQty(id, -1);
      else removeFromCart(id);
    });
  });
}

function openDrawer(open) {
  els.cartDrawer.classList.toggle("open", open);
  els.cartDrawer.setAttribute("aria-hidden", !open);
  document.body.style.overflow = open ? "hidden" : "";
}

// --- Auth ---
function updateAuthUI() {
  const loggedIn = !!currentUser;
  $("#authModalTitle").textContent = loggedIn ? "My account" : "Welcome back";
  els.loginForm.hidden = loggedIn;
  els.registerForm.hidden = true;
  els.authUserPanel.hidden = !loggedIn;
  els.logoutBtn.hidden = !loggedIn;
  $$(".tabs").forEach((t) => { t.hidden = loggedIn; });

  if (loggedIn) {
    els.authUserPanel.innerHTML = `
      <strong>${escapeHtml(currentUser.name)}</strong><br>
      ${escapeHtml(currentUser.email)}<br>
      ${escapeHtml(currentUser.phone || "")}`;
  }
}

function switchAuthTab(tab) {
  $$(".tab").forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active);
  });
  els.loginForm.hidden = tab !== "login";
  els.registerForm.hidden = tab !== "register";
  $("#authModalTitle").textContent = tab === "login" ? "Welcome back" : "Create account";
}

function openAuth() {
  updateAuthUI();
  els.authModal.showModal();
}

async function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { user, token } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: fd.get("email").trim(),
        password: fd.get("password"),
      }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    currentUser = user;
    e.target.reset();
    updateAuthUI();
    els.authModal.close();
    toast(`Welcome back, ${user.name.split(" ")[0]}!`);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { user, token } = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name").trim(),
        email: fd.get("email").trim(),
        phone: fd.get("phone").trim(),
        password: fd.get("password"),
      }),
    });
    localStorage.setItem(TOKEN_KEY, token);
    currentUser = user;
    e.target.reset();
    updateAuthUI();
    els.authModal.close();
    toast("Account created successfully!");
  } catch (err) {
    toast(err.message, "error");
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  updateAuthUI();
  els.authModal.close();
  toast("Signed out.");
}

// --- Catalog ---
function populateCategoryFilter() {
  els.categoryFilter.innerHTML = '<option value="all">All categories</option>';
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    els.categoryFilter.appendChild(opt);
  });
}

function renderCategories() {
  els.categoryGrid.innerHTML = categories.map((c) => `
    <button type="button" class="category-card" data-category="${c.id}">
      <img src="${c.image}" alt="${escapeHtml(c.name)}">
      <div class="category-card__overlay">
        <h3>${escapeHtml(c.name)}</h3>
        <span>Shop collection →</span>
      </div>
    </button>`).join("");

  els.categoryGrid.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", () => {
      els.categoryFilter.value = card.dataset.category;
      renderProducts();
      document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function getFilteredProducts() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const sort = els.sortFilter.value;

  let list = [...products];

  if (category !== "all") list = list.filter((p) => p.category === category);
  if (query) {
    list = list.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.category.includes(query)
    );
  }

  switch (sort) {
    case "price-asc": list.sort((a, b) => a.price - b.price); break;
    case "price-desc": list.sort((a, b) => b.price - a.price); break;
    case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
  }

  return list;
}

function stockBadge(stock) {
  if (stock === 0) return '<span class="product-card__badge product-card__badge--out">Out of stock</span>';
  if (stock <= 5) return '<span class="product-card__badge product-card__badge--low">Low stock</span>';
  if (stock <= 10) return '<span class="product-card__badge">Popular</span>';
  return "";
}

function renderProducts() {
  const list = getFilteredProducts();
  els.emptyProducts.hidden = list.length > 0;

  els.productGrid.innerHTML = list.map((p) => {
    const out = p.stock === 0;
    return `
      <article class="product-card" role="listitem">
        <div class="product-card__image">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
          ${stockBadge(p.stock)}
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${p.category}</span>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="product-card__brand">${escapeHtml(p.brand)}</p>
          <div class="product-card__footer">
            <div>
              <div class="product-card__price">${formatPrice(p.price)}</div>
              <div class="product-card__stock">${out ? "Unavailable" : `${p.stock} in stock`}</div>
            </div>
            <button type="button" class="btn btn--primary btn--sm" data-add="${p.id}" ${out ? "disabled" : ""}>
              ${out ? "Sold out" : "Add to bag"}
            </button>
          </div>
        </div>
      </article>`;
  }).join("");

  els.productGrid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
}

// --- Checkout ---
function startCheckout() {
  if (cart.length === 0) return;
  openDrawer(false);
  els.checkoutTotal.textContent = formatPrice(getCartTotal());
  resetCheckoutForm();
  if (currentUser) {
    const form = $("#checkoutForm");
    form.elements.customerName.value = currentUser.name || "";
    form.elements.customerEmail.value = currentUser.email || "";
    form.elements.customerPhone.value = currentUser.phone || "";
  }
  els.checkoutModal.showModal();
  goCheckoutStep(1);
}

function closeCheckout() {
  els.checkoutModal.close();
  resetCheckoutForm();
}

function resetCheckoutForm() {
  $("#checkoutForm").reset();
  togglePaymentFields();
  $$(".checkout-panel").forEach((p) => {
    p.hidden = p.dataset.panel !== "1";
  });
  $$(".checkout-steps .step").forEach((s) => {
    s.classList.toggle("active", s.dataset.step === "1");
  });
}

function goCheckoutStep(step) {
  if (step === 2) {
    const form = $("#checkoutForm");
    if (!form.elements.customerName.value || !form.elements.customerEmail.value ||
        !form.elements.customerPhone.value || !form.elements.customerAddress.value) {
      toast("Please fill in all delivery details.", "error");
      return;
    }
  }
  $$(".checkout-panel").forEach((p) => {
    p.hidden = p.dataset.panel !== String(step);
  });
  $$(".checkout-steps .step").forEach((s) => {
    s.classList.toggle("active", Number(s.dataset.step) <= step);
  });
}

function togglePaymentFields() {
  const method = document.querySelector('input[name="payment"]:checked')?.value;
  $("#mpesaFields").hidden = method !== "mpesa";
  $("#cardFields").hidden = method !== "card";
}

async function placeOrder() {
  const form = $("#checkoutForm");
  const paymentMethod = form.payment.value;

  if (paymentMethod === "mpesa") {
    const phone = form.mpesaPhone.value.replace(/\D/g, "");
    if (phone.length < 9) {
      toast("Enter a valid M-Pesa number.", "error");
      return;
    }
  } else {
    const card = form.cardNumber.value.replace(/\s/g, "");
    if (card.length < 15) {
      toast("Enter a valid card number.", "error");
      return;
    }
  }

  const btn = $("#placeOrderBtn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const payload = {
      items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
      paymentMethod,
      customer: {
        name: form.elements.customerName.value,
        email: form.elements.customerEmail.value,
        phone: form.elements.customerPhone.value,
        address: form.elements.customerAddress.value,
      },
      mpesaPhone: form.mpesaPhone?.value,
      cardNumber: form.cardNumber?.value,
      expiry: form.expiry?.value,
      cvv: form.cvv?.value,
    };

    const { order, payment } = await api("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    cart = [];
    saveCart();
    products = await api("/products");
    renderProducts();

    $("#orderId").textContent = order.id;
    $("#orderSummary").textContent = payment.message + ` Total: ${formatPrice(order.total)}`;

    goCheckoutStep(3);
    toast("Order placed successfully!");
  } catch (err) {
    toast(err.message, "error");
    if (err.message.includes("stock")) {
      products = await api("/products").catch(() => products);
      renderProducts();
      updateCartUI();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Place order";
  }
}

// --- Utils ---
function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast${type ? ` toast--${type}` : ""}`;
  el.textContent = message;
  els.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function toggleMobileNav() {
  const nav = $("#mainNav");
  const btn = $("#menuToggle");
  const open = nav.classList.toggle("open");
  btn.setAttribute("aria-expanded", open);
}

document.addEventListener("DOMContentLoaded", init);
