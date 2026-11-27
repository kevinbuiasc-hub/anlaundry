const STAFF_DEMO_KEY = "anlaundry.crm.staff-demo.v1";

const staffMoney = value => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0
}).format(Number(value || 0));
const staffEsc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const staffToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const normalizeStaffPhone = value => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) digits = "0" + digits.slice(2);
  return digits;
};

function staffSeed() {
  return {
    staff: { id: "NV-DEMO-A", name: "Nhân viên A", branchId: "CN01" },
    branch: { id: "CN01", code: "CN01", name: "AnLaundry - Hiệp Bình" },
    customers: [
      { id: "KH0001", name: "Nguyễn Minh Anh", phone: "0901234567" },
      { id: "KH0002", name: "Trần Hoàng Nam", phone: "0912345678" },
      { id: "KH0003", name: "Lê Thu Hà", phone: "0987654321" }
    ],
    orders: [
      {
        id: "AL-261126-001", customerId: "KH0001", service: "Giặt + sấy",
        itemType: "", description: "", quantity: 3, unit: "kg", unitPrice: 15000, total: 45000,
        dueDate: "2026-11-27", status: "Đang xử lý", paid: false,
        method: "cash", note: "Nhận tại quầy", receivedAt: "2026-11-26"
      },
      {
        id: "AL-261126-002", customerId: "KH0002", service: "Giặt + sấy + gấp",
        itemType: "", description: "", quantity: 4, unit: "kg", unitPrice: 17000, total: 68000,
        dueDate: "2026-11-27", status: "Đã nhận đồ", paid: true,
        method: "bank_transfer", invoiceId: "HD-261126-002",
        note: "", receivedAt: "2026-11-26"
      }
    ]
  };
}

export function startStaffDemo(root, exitToLogin) {
  let data;
  try { data = JSON.parse(localStorage.getItem(STAFF_DEMO_KEY)) || staffSeed(); }
  catch { data = staffSeed(); }

  const branch = data.branch || { id: "CN01", code: "CN01", name: "AnLaundry - Hiệp Bình" };
  const staff = data.staff || { id: "NV-DEMO-A", name: "Nhân viên A", branchId: branch.id };
  let page = "overview";
  let toast = "";
  let editingOrderId = "";
  let editingCustomerId = "";

  const save = () => localStorage.setItem(STAFF_DEMO_KEY, JSON.stringify(data));
  const customerById = id => data.customers.find(item => item.id === id);
  const serviceDefinitions = {
    "Giặt + sấy": { unit: "kg", price: 15000 },
    "Giặt + sấy + gấp": { unit: "kg", price: 17000 },
    "Giặt nhanh": { unit: "kg", price: 20000 }
  };
  const teddyPrices = {
    "Dưới 20cm": 20000, "20–50cm": 35000, "51–80cm": 60000,
    "81–100cm": 90000, "101–150cm": 150000, "Trên 150cm": 200000
  };
  const blanketPrices = {
    "Chăn mỏng đơn": 45000, "Chăn mỏng đôi": 60000, "Mền bông đơn": 65000,
    "Mền bông đôi": 85000, "Mền dày cỡ lớn": 115000
  };
  const teddySizes = Object.keys(teddyPrices);
  const blanketTypes = [
    ...Object.keys(blanketPrices),
    "Chăn lông/lông vũ – báo giá",
    "Topper/quá khổ – báo giá"
  ];
  const servicePrice = (service, itemType, manualPrice) => {
    if (serviceDefinitions[service]) return serviceDefinitions[service].price;
    if (service === "Giặt gấu bông") return teddyPrices[itemType] || 0;
    if (service === "Giặt chăn/mền") return blanketPrices[itemType] || Number(manualPrice || 0);
    if (service === "Dịch vụ khác") return Number(manualPrice || 0);
    return 0;
  };
  const serviceUnit = service => serviceDefinitions[service]?.unit || "món";
  const isManualService = (service, itemType) =>
    service === "Dịch vụ khác" ||
    (service === "Giặt chăn/mền" && /báo giá/.test(itemType || ""));
  const orderAmount = order => Number(order.total || 0);
  const paidOrders = () => data.orders.filter(order => order.paid);

  function nav(id, icon, label) {
    return '<button class="nav-item ' + (page === id ? "active" : "") +
      '" data-staff-page="' + id + '" type="button"><span>' + icon + "</span>" + label + "</button>";
  }

  function shell() {
    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-brand"><span class="brand-mark brand-mark-small">AN</span>
          <span class="brand-name">AnLaundry <small>CRM</small></span><span class="demo-tag">NHÂN VIÊN</span></div>
        <div class="topbar-user"><span class="branch-switch-label">Chi nhánh</span>
          <strong class="role-pill">${staffEsc(branch.name)}</strong>
          <span class="user-meta"><strong>${staffEsc(staff.name)}</strong><small>Nhân viên</small></span>
          <button class="btn btn-outline" id="exit-staff-demo" type="button">Thoát demo</button></div>
      </header>
      <div class="layout"><aside class="sidebar"><div class="sidebar-section-label">VẬN HÀNH</div>
        <nav class="sidebar-nav">${nav("overview", "▦", "Tổng quan")}${nav("orders", "▤", "Đơn giặt")}
          ${nav("customers", "♙", "Khách hàng")}${nav("invoices", "◇", "Hóa đơn")}</nav>
        <div class="sidebar-footer"><span class="status-dot"></span><span>Chế độ demo · Dữ liệu trên trình duyệt</span></div>
      </aside><section class="content" id="staff-demo-content" aria-live="polite"></section></div>`;

    document.querySelector("#exit-staff-demo").addEventListener("click", () => {
      root.innerHTML = "";
      exitToLogin("Bạn đã thoát chế độ demo nhân viên.");
    });
    document.querySelectorAll("[data-staff-page]").forEach(button => {
      button.addEventListener("click", () => { page = button.dataset.staffPage; render(); });
    });
  }

  function heading(title, description, action) {
    return '<div class="page-heading"><div><p class="eyebrow">ANLAUNDRY · NHÂN VIÊN</p><h1>' +
      title + '</h1><p>' + description + '</p></div>' + (action || "") + "</div>";
  }
  function stat(label, value, detail) {
    return '<article class="stat"><span>' + label + '</span><strong>' + value +
      '</strong><small>' + detail + "</small></article>";
  }
  function panel(title, subtitle, body) {
    return '<section class="panel"><div class="panel-heading"><div><h2>' + title +
      '</h2><p class="panel-subtitle">' + subtitle + "</p></div></div>" + body + "</section>";
  }
  function table(headers, rows, emptyText) {
    return '<div class="table-wrap"><table class="staff-table"><thead><tr>' +
      headers.map(value => "<th>" + value + "</th>").join("") +
      '</tr></thead><tbody>' + (rows || '<tr><td class="empty-state" colspan="' +
      headers.length + '">' + (emptyText || "Chưa có dữ liệu") +
      "</td></tr>") + "</tbody></table></div>";
  }

  function render() {
    shell();
    const content = document.querySelector("#staff-demo-content");
    if (page === "overview") renderOverview(content);
    else if (page === "customers") renderCustomers(content);
    else if (page === "orders") renderOrders(content);
    else renderInvoices(content);
    if (toast) {
      const element = document.createElement("div");
      element.className = "toast";
      element.textContent = toast;
      content.prepend(element);
      toast = "";
    }
  }

  function renderOverview(content) {
    const month = staffToday().slice(0, 7);
    const thisMonth = data.orders.filter(order => (order.receivedAt || "").slice(0, 7) === month);
    const open = data.orders.filter(order => order.status !== "Đã trả đồ");
    const recent = [...data.orders].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5);
    content.innerHTML = heading("Tổng quan", "Theo dõi hoạt động tiếp nhận và xử lý đơn tại " + staffEsc(branch.name) + ".") +
      '<div class="stats">' + stat("Đơn hàng tháng", thisMonth.length, "Theo ngày tiếp nhận") +
      stat("Đang xử lý", open.length, "Đơn chưa trả khách") +
      stat("Đã trả đồ", data.orders.filter(order => order.status === "Đã trả đồ").length, "Đơn đã giao khách") +
      stat("Khách hàng", data.customers.length, "Danh sách khách hàng") + "</div>" +
      '<div class="demo-banner"><strong>Chi nhánh cố định</strong><span>Phiếu nhận đồ luôn được ghi nhận tại ' +
      staffEsc(branch.name) + ". Nhân viên không thể đổi chi nhánh.</span></div>" +
      panel("Đơn gần đây", "Các đơn mới nhất tại chi nhánh đang đăng nhập",
        table(["Mã đơn", "Khách hàng", "Dịch vụ", "Thành tiền", "Trạng thái"],
          recent.map(order => {
            const customer = customerById(order.customerId);
            return "<tr><td><strong>" + staffEsc(order.id) + "</strong></td><td>" +
              staffEsc(customer?.name || "Khách hàng") + '<div class="employee-sub">' +
              staffEsc(customer?.phone || "") + "</div></td><td>" + staffEsc(order.service) +
              "</td><td>" + staffMoney(orderAmount(order)) + '</td><td><span class="state-pill">' +
              staffEsc(order.status) + "</span></td></tr>";
          }).join("")));
  }

  function renderCustomers(content) {
    const rows = data.customers.map(customer => {
      const linked = data.orders.filter(order => order.customerId === customer.id).length;
      return '<tr><td><strong>' + staffEsc(customer.name) + '</strong><div class="employee-sub">' +
        staffEsc(customer.id) + "</div></td><td>" + staffEsc(customer.phone) +
        "</td><td>" + linked + '</td><td><button class="text-action" data-edit-customer="' +
        customer.id + '">Sửa</button> <button class="text-action danger-text" data-delete-customer="' +
        customer.id + '">Xóa</button></td></tr>';
    }).join("");
    content.innerHTML = heading("Khách hàng", "Tra cứu và cập nhật thông tin khách hàng.",
      '<button class="btn" id="add-customer">＋ Thêm khách hàng</button>') +
      '<div class="stats">' + stat("Tổng khách hàng", data.customers.length, "Trong dữ liệu demo") +
      stat("Khách có đơn", new Set(data.orders.map(order => order.customerId)).size, "Có lịch sử giao dịch") +
      "</div><div id='customer-form-host'></div>" +
      panel("Danh sách khách hàng", "Nhân viên được thêm, sửa và xóa hồ sơ khách hàng.",
        table(["Khách hàng", "Số điện thoại", "Số đơn", "Thao tác"], rows));
    document.querySelector("#add-customer").addEventListener("click", () => customerForm());
    document.querySelectorAll("[data-edit-customer]").forEach(button =>
      button.addEventListener("click", () => customerForm(data.customers.find(item => item.id === button.dataset.editCustomer))));
    document.querySelectorAll("[data-delete-customer]").forEach(button =>
      button.addEventListener("click", () => {
        const customer = customerById(button.dataset.deleteCustomer);
        if (data.orders.some(order => order.customerId === customer.id)) {
          alert("Không thể xóa khách hàng đã có đơn giặt. Hãy giữ hồ sơ để bảo toàn lịch sử đơn hàng.");
          return;
        }
        if (confirm("Xóa khách hàng " + customer.name + "?")) {
          data.customers = data.customers.filter(item => item.id !== customer.id);
          save(); toast = "Đã xóa khách hàng."; render();
        }
      }));
  }

  function customerForm(customer) {
    editingCustomerId = customer?.id || "";
    const host = document.querySelector("#customer-form-host");
    host.innerHTML = `
      <section class="panel form-panel">
        <div class="panel-heading"><h2>${customer ? "Cập nhật khách hàng" : "Thêm khách hàng"}</h2>
          <button class="icon-button" id="close-customer">×</button></div>
        <form id="customer-form" class="form-grid">
          <div><label>Họ tên *</label><input name="name" required value="${staffEsc(customer?.name || "")}"></div>
          <div><label>Số điện thoại *</label><input name="phone" type="tel" inputmode="numeric" required value="${staffEsc(customer?.phone || "")}"></div>
          <div class="form-full form-actions"><button class="btn btn-outline" type="button" id="cancel-customer">Hủy</button>
            <button class="btn" type="submit">Lưu khách hàng</button></div>
        </form></section>`;
    const close = () => { editingCustomerId = ""; host.innerHTML = ""; };
    document.querySelector("#close-customer").addEventListener("click", close);
    document.querySelector("#cancel-customer").addEventListener("click", close);
    document.querySelector("#customer-form").addEventListener("submit", event => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      const normalized = normalizeStaffPhone(form.phone);
      if (!/^0\d{9}$/.test(normalized)) return alert("Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.");
      const duplicate = data.customers.find(item => item.phone === normalized && item.id !== editingCustomerId);
      if (duplicate) return alert("Số điện thoại đã thuộc về khách hàng " + duplicate.name + ".");
      if (editingCustomerId) {
        const existing = customerById(editingCustomerId);
        existing.name = form.name.trim(); existing.phone = normalized;
      } else {
        data.customers.push({ id: "KH" + String(Date.now()).slice(-6), name: form.name.trim(), phone: normalized });
      }
      save(); toast = "Đã lưu thông tin khách hàng."; render();
    });
  }

  function renderOrders(content) {
    const rows = [...data.orders].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(order => {
      const customer = customerById(order.customerId);
      return '<tr><td><strong>' + staffEsc(order.id) + '</strong><div class="employee-sub">' +
        staffEsc(order.note || "") + "</div></td><td>" + staffEsc(customer?.name || "Khách hàng") +
        '<div class="employee-sub">' + staffEsc(customer?.phone || "") + "</div></td><td>" +
        staffEsc(order.service) + (order.itemType ? '<div class="employee-sub">' + staffEsc(order.itemType) + "</div>" : "") +
        "</td><td>" + staffMoney(orderAmount(order)) + "</td><td><span class='state-pill'>" +
        staffEsc(order.status) + "</span></td><td>" + (order.paid ? "Đã thanh toán" : "Chưa thanh toán") +
        '</td><td><button class="text-action" data-edit-order="' + order.id + '">Chỉnh sửa</button></td></tr>';
    }).join("");
    content.innerHTML = heading("Đơn giặt", "Tạo và cập nhật đơn hàng tại " + staffEsc(branch.name) + ".",
      '<button class="btn" id="new-order">＋ Tạo phiếu nhận đồ</button>') +
      '<div class="stats">' + stat("Tổng đơn", data.orders.length, "Trong dữ liệu demo") +
      stat("Đang xử lý", data.orders.filter(order => ["Đã nhận đồ", "Đang xử lý"].includes(order.status)).length, "Cần theo dõi") +
      stat("Đã trả đồ", data.orders.filter(order => order.status === "Đã trả đồ").length, "Đã giao khách") +
      stat("Chưa thanh toán", data.orders.filter(order => !order.paid).length, "Cần thu tiền") +
      "</div><div id='order-form-host'></div>" +
      panel("Danh sách đơn giặt", "Nhân viên được tạo và chỉnh sửa đơn. Không có quyền xóa đơn hàng.",
        table(["Mã đơn", "Khách hàng", "Dịch vụ", "Thành tiền", "Trạng thái xử lý", "Thanh toán", "Thao tác"], rows));
    document.querySelector("#new-order").addEventListener("click", () => orderForm());
    document.querySelectorAll("[data-edit-order]").forEach(button =>
      button.addEventListener("click", () => orderForm(data.orders.find(order => order.id === button.dataset.editOrder))));
  }

  function orderForm(existing) {
    editingOrderId = existing?.id || "";
    const host = document.querySelector("#order-form-host");
    const existingCustomer = existing ? customerById(existing.customerId) : null;
    const currentService = existing?.service || "Giặt + sấy";
    const currentType = existing?.itemType || (currentService === "Giặt gấu bông" ? "20–50cm" :
      currentService === "Giặt chăn/mền" ? "Chăn mỏng đơn" : "");
    const statusOptions = ["Đã nhận đồ", "Đang xử lý", "Chờ khách nhận", "Đã trả đồ"];
    const serviceOptions = ["Giặt + sấy", "Giặt + sấy + gấp", "Giặt nhanh", "Giặt gấu bông", "Giặt chăn/mền", "Dịch vụ khác"];
    const paidLocked = Boolean(existing?.paid);

    host.innerHTML = `
      <section class="panel form-panel">
        <div class="panel-heading"><div><h2>${existing ? "Chỉnh sửa phiếu nhận đồ" : "Tạo phiếu nhận đồ giặt ủi"}</h2>
          <p class="panel-subtitle">Chi nhánh tiếp nhận được gán cố định theo tài khoản nhân viên.</p></div>
          <button class="icon-button" id="close-order">×</button></div>
        <form id="staff-order-form" class="form-grid">
          <div class="form-full"><label for="customer-phone">Số điện thoại khách hàng *</label>
            <input id="customer-phone" type="tel" inputmode="numeric" autocomplete="off" maxlength="14"
              placeholder="Nhập số điện thoại khách hàng" value="${staffEsc(existingCustomer?.phone || "")}" required ${paidLocked ? "disabled" : ""}>
            <div class="employee-sub">Nhập số điện thoại để tự động nhận diện khách hàng.</div></div>
          <div class="form-full"><label>Tên khách hàng</label>
            <input id="customer-name-display" class="readonly-field" type="text" readonly
              placeholder="Tên khách hàng tự động hiển thị" value="${staffEsc(existingCustomer?.name || "")}">
            <input id="customer-id" type="hidden" value="${staffEsc(existing?.customerId || "")}">
            <div id="customer-lookup-message" class="employee-sub" aria-live="polite">${existingCustomer ? "Đã tìm thấy khách hàng · " + staffEsc(existingCustomer.id) : ""}</div>
            <button class="btn btn-outline btn-small" id="show-inline-customer" type="button" hidden>＋ Thêm khách hàng mới</button>
            <div id="inline-customer-panel" class="inline-customer-panel" hidden>
              <label for="inline-customer-name">Tên khách hàng mới *</label>
              <input id="inline-customer-name" type="text" placeholder="Nhập họ tên khách hàng">
              <div class="form-actions"><button class="btn btn-outline btn-small" id="cancel-inline-customer" type="button">Hủy</button>
                <button class="btn btn-small" id="save-inline-customer" type="button">Lưu khách hàng</button></div>
            </div></div>
          <div><label for="service-type">Dịch vụ giặt *</label>
            <select id="service-type" name="service" required ${paidLocked ? "disabled" : ""}>
              ${serviceOptions.map(value => '<option value="' + value + '"' + (value === currentService ? " selected" : "") + ">" + value + "</option>").join("")}
            </select></div>
          <div id="item-type-wrap"><label for="item-type">Loại món / kích thước</label><select id="item-type" name="itemType" ${paidLocked ? "disabled" : ""}></select></div>
          <div id="service-description-wrap" hidden><label for="service-description">Mô tả dịch vụ</label>
            <input id="service-description" name="description" placeholder="Nhập tên dịch vụ khác" value="${staffEsc(existing?.description || "")}" ${paidLocked ? "readonly" : ""}></div>
          <div><label for="order-quantity">Số Kg / SL *</label>
            <input id="order-quantity" name="quantity" type="number" min="0.1" step="0.1" value="${staffEsc(existing?.quantity ?? 1)}" required ${paidLocked ? "readonly" : ""}></div>
          <div><label for="order-unit-price">Đơn giá (đ) *</label>
            <input id="order-unit-price" class="readonly-field" name="unitPrice" type="number" min="0"
              value="${staffEsc(existing?.unitPrice ?? 15000)}" readonly></div>
          <div class="form-full"><div class="notice" id="order-total-preview"></div></div>
          <div><label for="due-date">Hẹn trả đồ *</label>
            <input id="due-date" name="dueDate" type="date" min="${staffToday()}" value="${staffEsc(existing?.dueDate || staffToday())}" required></div>
          <div><label for="order-status">Trạng thái xử lý</label>
            <select id="order-status" name="status">${statusOptions.map(value => '<option' + (value === (existing?.status || "Đã nhận đồ") ? " selected" : "") + ">" + value + "</option>").join("")}</select></div>
          <div><label>Chi nhánh tiếp nhận *</label>
            <input class="readonly-field" type="text" value="${staffEsc(branch.name)}" readonly>
            <div class="employee-sub">Tự động theo tài khoản · Không thể thay đổi</div></div>
          <div><label for="payment-status">Trạng thái thanh toán</label>
            <select id="payment-status" name="paid" ${paidLocked ? "disabled" : ""}>
              <option value="false" ${!existing?.paid ? "selected" : ""}>Chưa thanh toán</option>
              <option value="true" ${existing?.paid ? "selected" : ""}>Đã thanh toán</option></select>
            ${paidLocked ? '<div class="employee-sub">Đơn đã thanh toán; cần quản lý xử lý điều chỉnh.</div>' : ""}</div>
          <div><label for="payment-method">Hình thức thanh toán *</label>
            <select id="payment-method" name="method" ${paidLocked ? "disabled" : ""}>
              <option value="cash" ${(existing?.method || "cash") === "cash" ? "selected" : ""}>Tiền mặt</option>
              <option value="bank_transfer" ${existing?.method === "bank_transfer" ? "selected" : ""}>Chuyển khoản</option></select></div>
          <div class="form-full"><label for="order-note">Ghi chú tình trạng đồ (vết bẩn, chất liệu, giao nhận)</label>
            <input id="order-note" name="note" value="${staffEsc(existing?.note || "")}"
              placeholder="VD: Áo sơ mi trắng cổ hơi ố, giặt riêng đồ màu..."></div>
          <div class="form-full form-actions"><button class="btn btn-outline" type="button" id="cancel-order">Hủy</button>
            <button class="btn" type="submit">${existing ? "Lưu thay đổi" : "Lưu phiếu giặt"}</button></div>
        </form></section>`;

    const phoneInput = document.querySelector("#customer-phone");
    const customerName = document.querySelector("#customer-name-display");
    const customerIdInput = document.querySelector("#customer-id");
    const lookupMessage = document.querySelector("#customer-lookup-message");
    const addCustomerButton = document.querySelector("#show-inline-customer");
    const inlinePanel = document.querySelector("#inline-customer-panel");
    const serviceSelect = document.querySelector("#service-type");
    const itemWrap = document.querySelector("#item-type-wrap");
    const itemSelect = document.querySelector("#item-type");
    const descriptionWrap = document.querySelector("#service-description-wrap");
    const unitPriceInput = document.querySelector("#order-unit-price");
    const quantityInput = document.querySelector("#order-quantity");
    const preview = document.querySelector("#order-total-preview");
    const form = document.querySelector("#staff-order-form");
    let previouslyManual = isManualService(currentService, currentType);

    function lookupCustomer() {
      const phone = normalizeStaffPhone(phoneInput.value);
      const found = data.customers.find(item => item.phone === phone);
      customerIdInput.value = found?.id || "";
      customerName.value = found?.name || "";
      lookupMessage.textContent = found ? "Đã tìm thấy khách hàng · " + found.id :
        (phone.length === 10 ? "Chưa có khách hàng này trong hệ thống." : "Nhập đủ 10 chữ số để tìm khách hàng.");
      addCustomerButton.hidden = !(phone.length === 10 && !found);
      inlinePanel.hidden = true;
    }

    function updateItemChoices() {
      const service = serviceSelect.value;
      const choices = service === "Giặt gấu bông" ? teddySizes :
        service === "Giặt chăn/mền" ? blanketTypes : [];
      itemWrap.hidden = !choices.length;
      itemSelect.innerHTML = choices.map(value => '<option value="' + staffEsc(value) + '">' +
        staffEsc(value) + "</option>").join("");
      if (choices.includes(currentType)) itemSelect.value = currentType;
      descriptionWrap.hidden = service !== "Dịch vụ khác";
      updatePrice();
    }

    function updatePrice() {
      const service = serviceSelect.value;
      const manual = isManualService(service, itemSelect.value);
      unitPriceInput.readOnly = paidLocked || !manual;
      unitPriceInput.classList.toggle("readonly-field", paidLocked || !manual);
      if (!manual) unitPriceInput.value = servicePrice(service, itemSelect.value, 0);
      else if (!previouslyManual) unitPriceInput.value = "";
      previouslyManual = manual;
      const descriptionInput = document.querySelector("#service-description");
      const quantity = Number(quantityInput.value || 0);
      const price = Number(unitPriceInput.value || 0);
      preview.textContent = "Đơn giá: " + staffMoney(price) + " / " +
        serviceUnit(service) + " · Thành tiền: " + staffMoney(quantity * price);
      if (descriptionInput) descriptionInput.required = service === "Dịch vụ khác";
    }

    function saveInlineCustomer() {
      const phone = normalizeStaffPhone(phoneInput.value);
      const nameInput = document.querySelector("#inline-customer-name");
      const name = nameInput.value.trim();
      if (!/^0\d{9}$/.test(phone)) return alert("Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.");
      if (!name) return alert("Vui lòng nhập tên khách hàng.");
      const duplicate = data.customers.find(item => item.phone === phone);
      if (duplicate) {
        customerIdInput.value = duplicate.id; customerName.value = duplicate.name;
        lookupMessage.textContent = "Đã tìm thấy khách hàng · " + duplicate.id;
      } else {
        const created = { id: "KH" + String(Date.now()).slice(-6), name, phone };
        data.customers.push(created); save();
        customerIdInput.value = created.id; customerName.value = created.name;
        lookupMessage.textContent = "Đã thêm khách hàng mới · " + created.id;
      }
      addCustomerButton.hidden = true;
      inlinePanel.hidden = true;
    }

    phoneInput.addEventListener("input", lookupCustomer);
    addCustomerButton.addEventListener("click", () => {
      inlinePanel.hidden = false;
      document.querySelector("#inline-customer-name").focus();
    });
    document.querySelector("#cancel-inline-customer").addEventListener("click", () => { inlinePanel.hidden = true; });
    document.querySelector("#save-inline-customer").addEventListener("click", saveInlineCustomer);
    serviceSelect.addEventListener("change", updateItemChoices);
    itemSelect.addEventListener("change", updatePrice);
    quantityInput.addEventListener("input", updatePrice);
    unitPriceInput.addEventListener("input", updatePrice);
    if (phoneInput.value) lookupCustomer();
    updateItemChoices();
    if (existing?.itemType) itemSelect.value = existing.itemType;
    updatePrice();

    const close = () => { editingOrderId = ""; host.innerHTML = ""; };
    document.querySelector("#close-order").addEventListener("click", close);
    document.querySelector("#cancel-order").addEventListener("click", close);

    form.addEventListener("submit", event => {
      event.preventDefault();
      const selectedCustomer = customerIdInput.value;
      if (!selectedCustomer) return alert("Vui lòng nhập số điện thoại khách hàng đã tồn tại hoặc thêm khách hàng mới.");
      const service = serviceSelect.value;
      const itemType = itemWrap.hidden ? "" : itemSelect.value;
      const description = document.querySelector("#service-description")?.value.trim() || "";
      const quantity = Number(quantityInput.value);
      const unitPrice = Number(unitPriceInput.value);
      if (!(quantity > 0) || !(unitPrice > 0)) return alert("Vui lòng kiểm tra số lượng và đơn giá.");
      if (isManualService(service, itemType) && !unitPrice) return alert("Vui lòng nhập đơn giá đã báo khách.");
      if (service === "Dịch vụ khác" && !description) return alert("Vui lòng nhập mô tả dịch vụ khác.");
      const formData = Object.fromEntries(new FormData(form).entries());
      const record = {
        customerId: selectedCustomer, service, itemType, description, quantity,
        unit: serviceUnit(service), unitPrice, total: quantity * unitPrice,
        dueDate: formData.dueDate, status: formData.status,
        paid: paidLocked ? true : formData.paid === "true",
        method: paidLocked ? existing.method : formData.method,
        note: formData.note.trim(), receivedAt: existing?.receivedAt || staffToday(),
        branchId: staff.branchId
      };
      if (editingOrderId) {
        const current = data.orders.find(order => order.id === editingOrderId);
        if (!current) return alert("Không tìm thấy đơn hàng cần chỉnh sửa.");
        Object.assign(current, record);
        if (current.paid && !current.invoiceId) current.invoiceId = newInvoiceId();
        if (!current.paid) current.invoiceId = "";
        toast = "Đã cập nhật đơn hàng " + current.id + ".";
      } else {
        record.id = newOrderId();
        record.invoiceId = record.paid ? newInvoiceId() : "";
        data.orders.unshift(record);
        toast = "Đã tạo phiếu nhận đồ " + record.id + ".";
      }
      save();
      editingOrderId = "";
      render();
    });
  }

  function newOrderId() {
    const day = staffToday().replaceAll("-", "").slice(2);
    return "AL-" + day + "-" + String(data.orders.length + 1).padStart(3, "0");
  }
  function newInvoiceId() {
    const day = staffToday().replaceAll("-", "").slice(2);
    return "HD-" + day + "-" + String(data.orders.filter(order => order.invoiceId).length + 1).padStart(3, "0");
  }

  function renderInvoices(content) {
    const rows = paidOrders().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map(order => {
      const customer = customerById(order.customerId);
      return '<tr><td><strong>' + staffEsc(order.invoiceId || "—") + "</strong></td><td>" +
        staffEsc(order.id) + "</td><td>" + staffEsc(customer?.name || "Khách hàng") +
        "</td><td>" + staffMoney(order.total) + "</td><td>" +
        (order.method === "cash" ? "Tiền mặt" : "Chuyển khoản") +
        '</td><td><button class="text-action" data-view-invoice="' + staffEsc(order.id) + '">Xem hóa đơn</button></td></tr>';
    }).join("");
    content.innerHTML = heading("Hóa đơn", "Tra cứu hóa đơn của các đơn đã thanh toán tại chi nhánh.") +
      '<div class="stats">' + stat("Hóa đơn đã ghi nhận", paidOrders().length, "Theo đơn đã thanh toán") +
      stat("Tổng tiền", staffMoney(paidOrders().reduce((sum, order) => sum + order.total, 0)), "Tổng giá trị hóa đơn") +
      "</div><div id='invoice-detail-host'></div>" +
      panel("Danh sách hóa đơn", "Hóa đơn được ghi nhận khi đơn hàng chuyển sang trạng thái đã thanh toán.",
        table(["Mã hóa đơn", "Mã đơn", "Khách hàng", "Tổng tiền", "Hình thức", "Thao tác"], rows));
    document.querySelectorAll("[data-view-invoice]").forEach(button =>
      button.addEventListener("click", () => invoiceDetail(button.dataset.viewInvoice)));
  }

  function invoiceDetail(orderId) {
    const order = data.orders.find(item => item.id === orderId);
    if (!order) return;
    const customer = customerById(order.customerId);
    const host = document.querySelector("#invoice-detail-host");
    host.innerHTML = `
      <section class="panel invoice-paper">
        <div class="panel-heading"><div><h2>ANLAUNDRY</h2><p class="panel-subtitle">HÓA ĐƠN THANH TOÁN</p></div>
          <span class="role-pill">${staffEsc(branch.name)}</span></div>
        <div class="notice"><strong>${staffEsc(order.invoiceId)}</strong> · Ngày nhận ${staffEsc(order.receivedAt)}</div>
        <p><strong>Khách hàng:</strong> ${staffEsc(customer?.name || "Khách hàng")}</p>
        <p><strong>Số điện thoại:</strong> ${staffEsc(customer?.phone || "")}</p>
        <p><strong>Mã đơn:</strong> ${staffEsc(order.id)}</p>
        <p><strong>Dịch vụ:</strong> ${staffEsc(order.service)} ${staffEsc(order.itemType || order.description || "")}</p>
        <p><strong>Số lượng:</strong> ${order.quantity} ${staffEsc(order.unit)}</p>
        <p><strong>Đơn giá:</strong> ${staffMoney(order.unitPrice)}</p>
        <div class="panel-heading"><strong>Tổng thanh toán</strong><strong>${staffMoney(order.total)}</strong></div>
        <p><strong>Thanh toán:</strong> ${order.method === "cash" ? "Tiền mặt" : "Chuyển khoản"} · Đã thanh toán</p>
        <div class="form-actions"><button class="btn btn-outline" id="close-invoice" type="button">Đóng</button>
          <button class="btn" id="print-invoice" type="button">In hóa đơn</button></div>
      </section>`;
    document.querySelector("#close-invoice").addEventListener("click", () => { host.innerHTML = ""; });
    document.querySelector("#print-invoice").addEventListener("click", () => window.print());
  }

  render();
}
