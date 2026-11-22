import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { startDemo } from "./demo.js";

const root = document.querySelector("#app");
const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

if (!configured) {
  root.innerHTML = '<section class="auth-card"><span class="brand-mark">AN</span><h1>AnLaundry CRM</h1><p>Chưa cấu hình kết nối Supabase.</p></section>';
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let currentSession = null;
  let currentProfile = null;
  let currentPage = "overview";
  let branchCache = [];

  init();

  let passwordRecoveryActive = false;

  async function init() {
    // Subscribe before getSession() so the PASSWORD_RECOVERY event is not missed.
    supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(async () => {
        if (event === "PASSWORD_RECOVERY") {
          passwordRecoveryActive = true;
          showUpdatePassword();
          return;
        }
        if (passwordRecoveryActive) return;
        if (session) await showDashboard(session);
        else if (!document.querySelector("#login-form") &&
                 !document.querySelector("#forgot-form") &&
                 !document.querySelector("#recovery-form")) {
          showLogin();
        }
      }, 0);
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) return showLogin(error.message);
    if (!passwordRecoveryActive) {
      if (data.session) await showDashboard(data.session);
      else showLogin();
    }

    // Expired/invalid email links are returned as error fragments in the URL.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = params.get("error_code");
    if (errorCode) {
      const description = params.get("error_description") || "Liên kết xác thực không còn hợp lệ.";
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      if (errorCode === "otp_expired") {
        showLogin("Liên kết đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu email khôi phục mới.");
      } else {
        showLogin(decodeURIComponent(description.replace(/\\+/g, " ")));
      }
    }
  }

  function authRedirectUrl() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
  }

  function showLogin(message = "") {
    currentSession = null;
    currentProfile = null;
    root.innerHTML = `
      <form class="auth-card" id="login-form">
        <span class="brand-mark">AN</span>
        <h1>AnLaundry CRM</h1>
        <p>Đăng nhập vào hệ thống quản trị</p>
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="username" required>
        <label for="password">Mật khẩu</label>
        <input id="password" type="password" autocomplete="current-password" required>
        <p class="error" id="error" role="alert">${escapeHtml(message)}</p>
        <button class="btn" type="submit">Đăng nhập</button>
        <button class="btn btn-outline demo-entry" id="enter-demo" type="button">Trải nghiệm bản demo</button>
        <p class="demo-caption">Dữ liệu minh họa riêng, không ghi vào Supabase.</p>
        <button class="link-button" id="forgot-password" type="button">Quên mật khẩu?</button>
      </form>`;

    document.querySelector("#login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      const errorBox = document.querySelector("#error");
      button.disabled = true;
      button.textContent = "Đang đăng nhập…";
      errorBox.textContent = "";

      const { error } = await supabase.auth.signInWithPassword({
        email: document.querySelector("#email").value.trim(),
        password: document.querySelector("#password").value
      });

      if (error) {
        errorBox.textContent = error.message;
        button.disabled = false;
        button.textContent = "Đăng nhập";
      }
    });

    document.querySelector("#forgot-password").addEventListener("click", showForgotPassword);
    document.querySelector("#enter-demo").addEventListener("click", () => startDemo(root, showLogin));
  }

  function showForgotPassword(message = "", success = false) {
    root.innerHTML = `
      <form class="auth-card" id="forgot-form">
        <span class="brand-mark">AN</span>
        <h1>Khôi phục mật khẩu</h1>
        <p>Nhập email tài khoản. AnLaundry sẽ gửi liên kết đặt lại mật khẩu.</p>
        <label for="recovery-email">Email</label>
        <input id="recovery-email" type="email" autocomplete="email" required>
        <p class="${success ? "success-message" : "error"}" id="recovery-message" role="status">${escapeHtml(message)}</p>
        <button class="btn" type="submit">Gửi liên kết khôi phục</button>
        <button class="link-button" id="back-to-login" type="button">Quay lại đăng nhập</button>
      </form>`;

    document.querySelector("#back-to-login").addEventListener("click", () => showLogin());
    document.querySelector("#forgot-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.querySelector("#recovery-email").value.trim().toLowerCase();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const messageBox = document.querySelector("#recovery-message");
      button.disabled = true;
      button.textContent = "Đang gửi…";
      messageBox.textContent = "";
      messageBox.className = "error";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectUrl()
      });

      if (error) {
        messageBox.textContent = error.message;
        button.disabled = false;
        button.textContent = "Gửi liên kết khôi phục";
        return;
      }

      messageBox.className = "success-message";
      messageBox.textContent = "Nếu email tồn tại trong hệ thống, liên kết khôi phục sẽ được gửi đến hộp thư của bạn.";
      button.disabled = false;
      button.textContent = "Gửi lại liên kết";
    });
  }

  function showUpdatePassword(message = "") {
    root.innerHTML = `
      <form class="auth-card" id="recovery-form">
        <span class="brand-mark">AN</span>
        <h1>Đặt mật khẩu mới</h1>
        <p>Chọn mật khẩu mới để tiếp tục sử dụng AnLaundry CRM.</p>
        <label for="new-password">Mật khẩu mới</label>
        <input id="new-password" type="password" autocomplete="new-password" minlength="8" required>
        <label for="confirm-password">Nhập lại mật khẩu</label>
        <input id="confirm-password" type="password" autocomplete="new-password" minlength="8" required>
        <p class="error" id="recovery-error" role="alert">${escapeHtml(message)}</p>
        <button class="btn" type="submit">Cập nhật mật khẩu</button>
      </form>`;

    document.querySelector("#recovery-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = document.querySelector("#new-password").value;
      const confirmation = document.querySelector("#confirm-password").value;
      const errorBox = document.querySelector("#recovery-error");
      const button = event.currentTarget.querySelector('button[type="submit"]');

      if (password.length < 8) {
        errorBox.textContent = "Mật khẩu cần có ít nhất 8 ký tự.";
        return;
      }
      if (password !== confirmation) {
        errorBox.textContent = "Hai mật khẩu chưa trùng khớp.";
        return;
      }

      button.disabled = true;
      button.textContent = "Đang cập nhật…";
      errorBox.textContent = "";

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        errorBox.textContent = error.message;
        button.disabled = false;
        button.textContent = "Cập nhật mật khẩu";
        return;
      }

      passwordRecoveryActive = false;
      await supabase.auth.signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
      showLogin("Mật khẩu đã được cập nhật. Vui lòng đăng nhập bằng mật khẩu mới.");
    });
  }

  async function showDashboard(session) {
    currentSession = session;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,full_name,role,is_active,phone")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile || !profile.is_active) {
      await supabase.auth.signOut();
      showLogin(error?.message || "Tài khoản chưa được kích hoạt hoặc chưa có hồ sơ nhân sự.");
      return;
    }

    currentProfile = profile;
    currentPage = "overview";
    renderShell();
    await renderPage();
  }

  function renderShell() {
    const name = currentProfile.full_name || currentSession.user.email || "Nhân viên";
    const isManager = ["owner", "manager"].includes(currentProfile.role);

    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-mark brand-mark-small">AN</span>
          <span class="brand-name">AnLaundry <small>CRM</small></span>
        </div>
        <div class="topbar-user">
          <span class="user-meta"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(roleLabel(currentProfile.role))}</small></span>
          <button class="btn btn-outline" id="logout" type="button">Đăng xuất</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <nav class="sidebar-nav" aria-label="Điều hướng chính">
            <button class="nav-item active" data-page="overview" type="button"><span>▦</span>Tổng quan</button>
            <button class="nav-item" data-page="orders" type="button"><span>▤</span>Đơn hàng</button>
            <button class="nav-item" data-page="customers" type="button"><span>♙</span>Khách hàng</button>
            <button class="nav-item" data-page="payments" type="button"><span>◇</span>Thanh toán</button>
            <button class="nav-item" data-page="reports" type="button"><span>▥</span>Báo cáo</button>
            ${isManager ? '<button class="nav-item" data-page="staff" type="button"><span>♧</span>Nhân sự</button>' : ""}
          </nav>
          <div class="sidebar-footer">
            <span class="status-dot"></span>
            <span>Đã kết nối Supabase</span>
          </div>
        </aside>
        <section class="content" id="page-content" aria-live="polite"></section>
      </div>`;

    document.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", async () => {
        currentPage = button.dataset.page;
        document.querySelectorAll("[data-page]").forEach(item =>
          item.classList.toggle("active", item.dataset.page === currentPage)
        );
        await renderPage();
      });
    });

    document.querySelector("#logout").addEventListener("click", async () => {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) alert(logoutError.message);
    });
  }

  async function renderPage() {
    const content = document.querySelector("#page-content");
    if (!content) return;

    if (currentPage === "staff") {
      if (!["owner", "manager"].includes(currentProfile.role)) {
        content.innerHTML = '<div class="panel"><h2>Không có quyền truy cập</h2><p>Tài khoản của bạn không được phép xem danh sách nhân sự.</p></div>';
        return;
      }
      await renderStaffPage(content);
      return;
    }

    const titles = {
      overview: ["Tổng quan", "Tổng quan hoạt động AnLaundry."],
      orders: ["Đơn hàng", "Phân hệ quản lý đơn hàng sẽ được triển khai ở giai đoạn tiếp theo."],
      customers: ["Khách hàng", "Hồ sơ khách hàng dùng chung toàn hệ thống sẽ được triển khai ở giai đoạn tiếp theo."],
      payments: ["Thanh toán", "Quản lý tiền mặt và chuyển khoản sẽ được triển khai ở giai đoạn tiếp theo."],
      reports: ["Báo cáo", "Báo cáo hợp nhất và báo cáo theo chi nhánh sẽ được triển khai ở giai đoạn tiếp theo."]
    };
    const [title, description] = titles[currentPage] || titles.overview;
    content.innerHTML = `
      <div class="page-heading">
        <div><p class="eyebrow">ANLAUNDRY MANAGEMENT</p><h1>${title}</h1><p>${description}</p></div>
      </div>
      <div class="stats">
        <article class="stat"><span>Doanh thu tháng</span><strong>—</strong><small>Đang chờ phân hệ thanh toán</small></article>
        <article class="stat"><span>Đơn hàng</span><strong>—</strong><small>Đang chờ phân hệ đơn hàng</small></article>
        <article class="stat"><span>Khối lượng giặt</span><strong>— kg</strong><small>Đang chờ phân hệ đơn hàng</small></article>
        <article class="stat"><span>Khách hàng</span><strong>—</strong><small>Đang chờ phân hệ khách hàng</small></article>
      </div>
      <div class="panel">
        <div class="panel-heading"><h2>Thông tin tài khoản</h2><span class="role-pill">${escapeHtml(roleLabel(currentProfile.role))}</span></div>
        <p>Xin chào <strong>${escapeHtml(currentProfile.full_name || currentSession.user.email)}</strong>. Tài khoản đang hoạt động và đã xác thực với Supabase.</p>
        <div class="notice">Phân hệ nhân sự đang được triển khai. Các số liệu kinh doanh sẽ được kết nối khi hoàn thiện đơn hàng, thanh toán và báo cáo.</div>
      </div>`;
  }

  async function renderStaffPage(content) {
    content.innerHTML = '<div class="panel"><p>Đang tải danh sách nhân sự…</p></div>';

    const [profilesResult, assignmentsResult, branchesResult] = await Promise.all([
      supabase.from("profiles")
        .select("id,full_name,role,is_active,phone,created_at")
        .order("created_at", { ascending: true }),
      supabase.from("staff_branch_assignments")
        .select("user_id,branch_id,assignment_type,is_primary,valid_from,valid_until"),
      supabase.from("branches")
        .select("id,code,name,is_active")
        .order("code", { ascending: true })
    ]);

    const firstError = profilesResult.error || assignmentsResult.error || branchesResult.error;
    if (firstError) {
      content.innerHTML = `
        <div class="page-heading"><div><p class="eyebrow">HUMAN RESOURCES</p><h1>Quản lý nhân sự</h1></div></div>
        <div class="notice notice-error">Không tải được dữ liệu nhân sự: ${escapeHtml(firstError.message)}</div>`;
      return;
    }

    const profiles = profilesResult.data || [];
    const assignments = assignmentsResult.data || [];
    branchCache = branchesResult.data || [];
    const branchesById = new Map(branchCache.map(branch => [branch.id, branch]));

    const rows = profiles.map(profile => {
      const assigned = assignments
        .filter(item => item.user_id === profile.id)
        .map(item => ({ ...item, branch: branchesById.get(item.branch_id) }))
        .filter(item => item.branch);
      const primary = assigned.find(item => item.is_primary && assignmentActive(item)) ||
        assigned.find(assignmentActive) || assigned[0];
      return { ...profile, assignments: assigned, primary };
    });

    const activeCount = rows.filter(row => row.is_active).length;
    const managerCount = rows.filter(row => row.role === "manager" && row.is_active).length;
    const staffCount = rows.filter(row => row.role === "staff" && row.is_active).length;

    content.innerHTML = `
      <div class="page-heading staff-heading">
        <div><p class="eyebrow">HUMAN RESOURCES</p><h1>Quản lý nhân sự</h1><p>Quản lý tài khoản, vai trò và chi nhánh làm việc của nhân viên.</p></div>
        <button class="btn" id="show-add-employee" type="button">＋ Thêm nhân viên</button>
      </div>
      <div class="stats staff-stats">
        <article class="stat"><span>Nhân sự hoạt động</span><strong>${activeCount}</strong></article>
        <article class="stat"><span>Manager</span><strong>${managerCount}</strong></article>
        <article class="stat"><span>Staff</span><strong>${staffCount}</strong></article>
        <article class="stat"><span>Chi nhánh</span><strong>${branchCache.length}</strong></article>
      </div>
      <section class="panel" id="employee-form-panel" hidden></section>
      <section class="panel">
        <div class="panel-heading staff-list-heading"><div><h2>Danh sách nhân viên</h2><p class="panel-subtitle">Dữ liệu trực tiếp từ Supabase</p></div><input class="search-input" id="staff-search" type="search" placeholder="Tìm tên, email hoặc số điện thoại"></div>
        <div class="table-wrap">
          <table class="staff-table">
            <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Chi nhánh chính</th><th>Trạng thái</th></tr></thead>
            <tbody id="staff-table-body"></tbody>
          </table>
        </div>
        <p class="table-footnote">Owner xem toàn hệ thống. Manager chỉ xem nhân sự trong phạm vi chi nhánh được phân công.</p>
      </section>`;

    const body = document.querySelector("#staff-table-body");
    const renderRows = (query = "") => {
      const q = query.trim().toLocaleLowerCase("vi");
      const filtered = rows.filter(row => {
        const branchName = row.primary?.branch?.name || "";
        return [row.full_name, row.phone, row.role, branchName]
          .some(value => String(value || "").toLocaleLowerCase("vi").includes(q));
      });

      body.innerHTML = filtered.length ? filtered.map(row => `
        <tr>
          <td><div class="employee-name">${escapeHtml(row.full_name || "Chưa có tên")}</div><div class="employee-sub">${escapeHtml(row.phone || "Chưa có số điện thoại")}</div></td>
          <td><span class="role-pill">${escapeHtml(roleLabel(row.role))}</span></td>
          <td>${row.primary ? `<strong>${escapeHtml(row.primary.branch.code)}</strong><div class="employee-sub">${escapeHtml(row.primary.branch.name)}</div>` : '<span class="muted">Chưa phân công</span>'}</td>
          <td><span class="state-pill ${row.is_active ? "state-active" : "state-inactive"}">${row.is_active ? "Đang hoạt động" : "Đã tạm khóa"}</span></td>
        </tr>`).join("") : '<tr><td colspan="4" class="empty-state">Không tìm thấy nhân viên phù hợp.</td></tr>';
    };

    renderRows();
    document.querySelector("#staff-search").addEventListener("input", event => renderRows(event.target.value));
    document.querySelector("#show-add-employee").addEventListener("click", () => renderAddEmployeeForm(rows));
  }

  function renderAddEmployeeForm(existingRows) {
    const panel = document.querySelector("#employee-form-panel");
    const canCreateManager = currentProfile.role === "owner";
    const branchOptions = branchCache
      .filter(branch => branch.is_active)
      .map(branch => `<option value="${escapeHtml(branch.id)}">${escapeHtml(branch.code)} — ${escapeHtml(branch.name)}</option>`)
      .join("");

    if (!branchOptions) {
      panel.hidden = false;
      panel.innerHTML = '<h2>Chưa có chi nhánh khả dụng</h2><p>Hãy tạo và kích hoạt chi nhánh trước khi phân công nhân viên.</p>';
      return;
    }

    panel.hidden = false;
    panel.innerHTML = `
      <div class="panel-heading"><div><h2>Thêm nhân viên</h2><p class="panel-subtitle">Tài khoản sẽ nhận email mời thiết lập đăng nhập.</p></div><button class="icon-button" id="close-employee-form" type="button" aria-label="Đóng">×</button></div>
      <form id="employee-form" class="employee-form">
        <div class="form-grid">
          <div><label for="employee-name">Họ và tên *</label><input id="employee-name" name="full_name" required maxlength="120" placeholder="Nguyễn Văn A"></div>
          <div><label for="employee-email">Email đăng nhập *</label><input id="employee-email" name="email" type="email" required maxlength="254" placeholder="nhanvien@email.com"></div>
          <div><label for="employee-phone">Số điện thoại liên hệ</label><input id="employee-phone" name="phone" type="tel" maxlength="20" placeholder="09xxxxxxxx"></div>
          <div><label for="employee-role">Vai trò *</label><select id="employee-role" name="role">${canCreateManager ? '<option value="staff">Staff</option><option value="manager">Manager</option>' : '<option value="staff">Staff</option>'}</select></div>
          <div class="form-full"><label for="employee-branch">Chi nhánh chính *</label><select id="employee-branch" name="branch_id" required>${branchOptions}</select></div>
        </div>
        <div class="notice">Supabase sẽ gửi email mời đăng nhập. Không nhập hoặc lưu mật khẩu nhân viên trong CRM.</div>
        <p class="error" id="employee-form-error" role="alert"></p>
        <div class="form-actions"><button class="btn btn-outline" id="cancel-employee" type="button">Hủy</button><button class="btn" type="submit">Tạo tài khoản & phân công</button></div>
      </form>`;

    document.querySelector("#close-employee-form").addEventListener("click", () => { panel.hidden = true; });
    document.querySelector("#cancel-employee").addEventListener("click", () => { panel.hidden = true; });
    document.querySelector("#employee-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorBox = document.querySelector("#employee-form-error");
      const values = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      submit.textContent = "Đang tạo tài khoản…";
      errorBox.textContent = "";

      const { data, error } = await supabase.functions.invoke("admin-create-employee", {
        body: {
          full_name: values.full_name.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          role: values.role,
          branch_id: values.branch_id
        }
      });

      if (error || data?.error) {
        errorBox.textContent = data?.error || error.message || "Không thể tạo nhân viên.";
        submit.disabled = false;
        submit.textContent = "Tạo tài khoản & phân công";
        return;
      }

      panel.innerHTML = `
        <div class="success-state">
          <div class="success-icon">✓</div>
          <h2>Đã tạo lời mời nhân viên</h2>
          <p>${escapeHtml(values.full_name)} đã được thêm vào danh sách và phân công chi nhánh. Hệ thống đã yêu cầu Supabase gửi email mời đăng nhập.</p>
          <button class="btn" id="close-success" type="button">Hoàn tất</button>
        </div>`;
      document.querySelector("#close-success").addEventListener("click", async () => {
        await renderStaffPage(document.querySelector("#page-content"));
      });
    });
  }

  function assignmentActive(item) {
    const now = Date.now();
    const from = item.valid_from ? new Date(item.valid_from).getTime() : 0;
    const until = item.valid_until ? new Date(item.valid_until).getTime() : Infinity;
    return from <= now && until > now;
  }

  function roleLabel(role) {
    return ({ owner: "Owner", manager: "Manager", staff: "Staff" })[role] || "Chưa phân quyền";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }
}
