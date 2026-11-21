import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const root = document.querySelector("#app");
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");

if (!configured) {
  root.innerHTML = '<section class="auth-card"><span class="brand-mark">AN</span><h1>AnLaundry CRM</h1><p>Giao diện CRM đã được khởi tạo. Cần kết nối dự án Supabase để bật đăng nhập và dữ liệu.</p><div class="notice">Bước tiếp theo: tạo Supabase project, chạy file <strong>schema.sql</strong>, sau đó cập nhật <strong>config.js</strong> bằng Project URL và publishable/anon key.</div></section>';
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  render();

  async function render() {
    const { data: { session } } = await supabase.auth.getSession();
    session ? showDashboard(session) : showLogin();
    supabase.auth.onAuthStateChange((_event, nextSession) => nextSession ? showDashboard(nextSession) : showLogin());
  }

  function showLogin(message = "") {
    root.innerHTML = `<form class="auth-card" id="login-form"><span class="brand-mark">AN</span><h1>AnLaundry CRM</h1><p>Đăng nhập để quản lý cửa hàng</p><label for="email">Email</label><input id="email" type="email" autocomplete="username" required><label for="password">Mật khẩu</label><input id="password" type="password" autocomplete="current-password" required><p class="error" id="error">${message}</p><button class="btn" type="submit">Đăng nhập</button></form>`;
    document.querySelector("#login-form").addEventListener("submit", async e => {
      e.preventDefault();
      const button = e.currentTarget.querySelector("button");
      button.disabled = true; button.textContent = "Đang đăng nhập…";
      const { error } = await supabase.auth.signInWithPassword({email:document.querySelector("#email").value,password:document.querySelector("#password").value});
      if (error) { document.querySelector("#error").textContent = error.message; button.disabled = false; button.textContent = "Đăng nhập"; }
    });
  }

  async function showDashboard(session) {
    const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id",session.user.id).maybeSingle();
    const name = profile?.full_name || session.user.email;
    root.innerHTML = `<header class="topbar"><span class="brand-name">AnLaundry <small>CRM</small></span><span><small>${escapeHtml(name)}</small> &nbsp; <button class="btn" id="logout">Đăng xuất</button></span></header><div class="layout"><aside class="sidebar"><div class="nav-item active">Tổng quan</div><div class="nav-item">Đơn hàng</div><div class="nav-item">Khách hàng</div><div class="nav-item">Thanh toán</div><div class="nav-item">Báo cáo</div><div class="nav-item">Nhân sự</div></aside><section class="content"><div class="page-heading"><div><h1>Tổng quan</h1><p>Xin chào, ${escapeHtml(name)}. Đây là không gian quản lý AnLaundry.</p></div></div><div class="stats"><article class="stat"><span>Doanh thu tháng</span><strong>—</strong></article><article class="stat"><span>Đơn hàng</span><strong>—</strong></article><article class="stat"><span>Khối lượng giặt</span><strong>— kg</strong></article><article class="stat"><span>Khách hàng</span><strong>—</strong></article></div><div class="panel"><h2>Trạng thái triển khai</h2><div class="notice">Đăng nhập Supabase đã kết nối. Các thẻ số liệu sẽ hiển thị dữ liệu thật sau khi hoàn tất phân hệ đơn hàng, thanh toán và báo cáo.</div><p>Vai trò tài khoản: <strong>${escapeHtml(profile?.role || "chưa được cấp vai trò")}</strong></p></div></section></div>`;
    document.querySelector("#logout").addEventListener("click", async () => { await supabase.auth.signOut(); });
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
}