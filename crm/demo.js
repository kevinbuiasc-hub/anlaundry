const STORAGE_KEY = "anlaundry.crm.demo.v1";
const today = "2026-11-22";
const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const kg = value => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value || 0));
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const uid = prefix => prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

function seed() {
  return {
    activeBranch: "ALL",
    branches: [
      { id:"CN01", code:"CN01", name:"AnLaundry - Hiệp Bình", address:"Hiệp Bình, TP. Thủ Đức", active:true },
      { id:"CN02", code:"CN02", name:"AnLaundry - Hòa Hưng", address:"Hòa Hưng, Quận 10", active:true }
    ],
    services: [
      { id:"S01", code:"WASH_DRY", name:"Giặt sấy thường", unit:"kg", prices:{CN01:15000,CN02:16000}, active:true },
      { id:"S02", code:"BLANKET", name:"Giặt chăn mền", unit:"cái", prices:{CN01:60000,CN02:65000}, active:true },
      { id:"S03", code:"TEDDY", name:"Giặt gấu bông", unit:"cái", prices:{CN01:50000,CN02:55000}, active:true }
    ],
    customers: [
      {id:"KH0001",name:"Nguyễn Minh Anh",phone:"0901234567",email:"minhanh@gmail.com",created:"2026-10-02",note:"Ưu đãi khách thân thiết"},
      {id:"KH0002",name:"Trần Hoàng Nam",phone:"0912345678",email:"",created:"2026-10-15",note:""},
      {id:"KH0003",name:"Lê Thu Hà",phone:"0987654321",email:"thuha@gmail.com",created:"2026-11-01",note:"Nhận tin qua Zalo"},
      {id:"KH0004",name:"Phạm Quốc Bảo",phone:"0933332211",email:"",created:"2026-11-10",note:""}
    ],
    staff: [
      {id:"NV001",name:"Bùi Ngọc Khương",email:"kevinbuiasc@gmail.com",phone:"",role:"owner",branch:"CN01",active:true},
      {id:"NV002",name:"Mỹ Hương",email:"buingockhuong89@gmail.com",phone:"0839649049",role:"staff",branch:"CN02",active:true},
      {id:"NV003",name:"Nguyễn Thanh Tâm",email:"tam.staff@email.com",phone:"0908001122",role:"manager",branch:"CN01",active:true}
    ],
    orders: [
      {id:"AL-261122-001",customerId:"KH0001",branch:"CN01",date:"2026-11-22",items:[{serviceId:"S01",qty:4.5,price:15000}],status:"completed",note:"Giao tại quầy",createdBy:"Bùi Ngọc Khương"},
      {id:"AL-261122-002",customerId:"KH0002",branch:"CN02",date:"2026-11-22",items:[{serviceId:"S01",qty:6,price:16000},{serviceId:"S02",qty:1,price:65000}],status:"washing",note:"Khách nhận lúc 18:00",createdBy:"Mỹ Hương"},
      {id:"AL-261121-003",customerId:"KH0003",branch:"CN01",date:"2026-11-21",items:[{serviceId:"S01",qty:3,price:15000}],status:"ready",note:"",createdBy:"Bùi Ngọc Khương"},
      {id:"AL-261120-004",customerId:"KH0004",branch:"CN02",date:"2026-11-20",items:[{serviceId:"S03",qty:1,price:55000}],status:"completed",note:"",createdBy:"Mỹ Hương"}
    ],
    payments: [
      {id:"TT001",orderId:"AL-261122-001",amount:67500,method:"cash",date:"2026-11-22",status:"paid"},
      {id:"TT002",orderId:"AL-261120-004",amount:55000,method:"transfer",date:"2026-11-20",status:"paid"}
    ],
    branchRequests: [
      {id:"YC001",staffId:"NV002",from:"CN02",to:"CN01",date:"2026-11-23",reason:"Hỗ trợ ca sáng",status:"pending"}
    ]
  };
}

export function startDemo(root, exitToLogin) {
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed(); }
  catch { state = seed(); }
  let page = "overview";
  let notice = "";
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const branchName = id => state.branches.find(b=>b.id===id)?.name || id;
  const customer = id => state.customers.find(c=>c.id===id);
  const service = id => state.services.find(s=>s.id===id);
  const orderTotal = order => order.items.reduce((sum,item)=>sum+Number(item.qty)*Number(item.price),0);
  const paidFor = orderId => state.payments.filter(p=>p.orderId===orderId && p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const visibleOrders = () => state.orders.filter(o=>state.activeBranch==="ALL"||o.branch===state.activeBranch);
  const visiblePayments = () => state.payments.filter(p=>state.activeBranch==="ALL"||state.orders.find(o=>o.id===p.orderId)?.branch===state.activeBranch);
  const isToday = date => date===today;
  const statusLabel = s => ({received:"Đã tiếp nhận",washing:"Đang xử lý",ready:"Chờ khách nhận",completed:"Hoàn tất",cancelled:"Đã hủy"})[s]||s;
  const roleLabel = r => ({owner:"Owner",manager:"Manager",staff:"Staff"})[r]||r;

  function shell() {
    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-brand"><span class="brand-mark brand-mark-small">AN</span><span class="brand-name">AnLaundry <small>CRM</small></span><span class="demo-tag">DEMO</span></div>
        <div class="topbar-user"><label class="branch-switch-label" for="demo-branch">Chi nhánh</label><select id="demo-branch" class="branch-switch"><option value="ALL">Toàn hệ thống</option>${state.branches.map(b=>`<option value="${esc(b.id)}">${esc(b.code)} · ${esc(b.name)}</option>`).join("")}</select><span class="user-meta"><strong>Owner Demo</strong><small>Quản trị hệ thống</small></span><button class="btn btn-outline" id="exit-demo" type="button">Thoát demo</button></div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-section-label">VẬN HÀNH</div>
          <nav class="sidebar-nav">
            ${nav("overview","▦","Tổng quan")}
            ${nav("orders","▤","Đơn hàng")}
            ${nav("customers","♙","Khách hàng")}
            ${nav("payments","◇","Thanh toán")}
            ${nav("reports","▥","Báo cáo")}
          </nav>
          <div class="sidebar-section-label">QUẢN TRỊ</div>
          <nav class="sidebar-nav">
            ${nav("staff","♧","Nhân sự")}
            ${nav("branches","⌖","Chi nhánh")}
            ${nav("services","✳","Bảng giá dịch vụ")}
            ${nav("approvals","✓","Duyệt điều chuyển",state.branchRequests.filter(r=>r.status==="pending").length)}
          </nav>
          <div class="sidebar-footer"><span class="status-dot"></span><span>Chế độ mô phỏng · Dữ liệu trên trình duyệt</span></div>
        </aside>
        <section class="content" id="demo-content" aria-live="polite"></section>
      </div>`;
    document.querySelector("#demo-branch").value=state.activeBranch;
    document.querySelector("#demo-branch").addEventListener("change",e=>{state.activeBranch=e.target.value;save();render();});
    document.querySelector("#exit-demo").addEventListener("click",()=>{root.innerHTML="";exitToLogin("Bạn đã thoát chế độ demo.");});
    document.querySelectorAll("[data-demo-page]").forEach(b=>b.addEventListener("click",()=>{page=b.dataset.demoPage;render();}));
  }
  function nav(id,icon,label,count=0){return `<button class="nav-item ${page===id?"active":""}" data-demo-page="${id}" type="button"><span>${icon}</span>${label}${count?`<b class="nav-count">${count}</b>`:""}</button>`;}

  function render() {
    shell();
    const content=document.querySelector("#demo-content");
    const renderers={overview:overview,orders:orders,customers:customers,payments:payments,reports:reports,staff:staff,branches:branches,services:services,approvals:approvals};
    (renderers[page]||overview)(content);
    if(notice){const n=document.createElement("div");n.className="toast";n.textContent=notice;content.prepend(n);notice="";}
  }
  function heading(kicker,title,desc,action=""){return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;}
  function stat(label,value,sub){return `<article class="stat"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`;}
  function panel(title,sub,body){return `<section class="panel"><div class="panel-heading"><div><h2>${title}</h2><p class="panel-subtitle">${sub}</p></div></div>${body}</section>`;}
  function table(headers,rows,empty="Chưa có dữ liệu"){return `<div class="table-wrap"><table class="staff-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty-state">${empty}</td></tr>`}</tbody></table></div>`;}
  function overview(el){
    const orders=visibleOrders().filter(o=>o.date.slice(0,7)===today.slice(0,7)&&o.status!=="cancelled");
    const revenue=visiblePayments().filter(p=>p.status==="paid"&&p.date.slice(0,7)===today.slice(0,7)).reduce((s,p)=>s+p.amount,0);
    const kgTotal=orders.reduce((s,o)=>s+o.items.filter(i=>service(i.serviceId)?.unit==="kg").reduce((x,i)=>x+Number(i.qty),0),0);
    const due=visibleOrders().reduce((s,o)=>s+Math.max(0,orderTotal(o)-paidFor(o.id)),0);
    const recent=[...visibleOrders()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    el.innerHTML=heading("ANLAUNDRY MANAGEMENT","Tổng quan","Theo dõi tình hình kinh doanh và vận hành các chi nhánh.")+`
      <div class="stats">${stat("Doanh thu đã thu tháng",money(revenue),"Theo khoản thanh toán đã ghi nhận")}${stat("Đơn hàng trong tháng",orders.length,"Không tính đơn đã hủy")}${stat("Khối lượng giặt",kg(kgTotal)+" kg","Chỉ tính dịch vụ theo kg")}${stat("Còn phải thu",money(due),"Tổng số dư các đơn đang hiển thị")}</div>
      <div class="demo-banner"><strong>Đang ở chế độ Demo</strong><span>Thao tác được lưu trong bộ nhớ trình duyệt, không ghi vào Supabase. Dùng nút Đặt lại demo để khôi phục dữ liệu mẫu.</span><button class="btn btn-outline btn-small" id="reset-demo">Đặt lại demo</button></div>
      ${panel("Đơn hàng gần đây","Các đơn mới nhất trong phạm vi đang chọn",table(["Mã đơn","Khách hàng","Chi nhánh","Ngày","Thành tiền","Trạng thái"],recent.map(o=>`<tr><td><strong>${o.id}</strong></td><td>${esc(customer(o.customerId)?.name||"Khách lẻ")}</td><td>${esc(o.branch)}</td><td>${o.date}</td><td>${money(orderTotal(o))}</td><td>${statusPill(o.status)}</td></tr>`).join("")))}
      ${panel("Tóm tắt chi nhánh","Doanh thu thực thu trong tháng",`<div class="branch-summary">${state.branches.map(b=>{const sum=state.payments.filter(p=>p.status==="paid"&&p.date.slice(0,7)===today.slice(0,7)&&state.orders.find(o=>o.id===p.orderId)?.branch===b.id).reduce((s,p)=>s+p.amount,0);return `<div class="branch-summary-item"><div><strong>${b.code}</strong><small>${esc(b.name)}</small></div><b>${money(sum)}</b></div>`;}).join("")}</div>`)}`;
    document.querySelector("#reset-demo").addEventListener("click",()=>{if(confirm("Khôi phục toàn bộ dữ liệu demo ban đầu?")){state=seed();save();render();}});
  }
  function statusPill(s){return `<span class="state-pill state-${s}">${statusLabel(s)}</span>`;}
  function orders(el){
    const rows=visibleOrders().sort((a,b)=>b.date.localeCompare(a.date)).map(o=>`<tr><td><strong>${o.id}</strong><div class="employee-sub">${esc(o.note)}</div></td><td>${esc(customer(o.customerId)?.name||"Khách lẻ")}<div class="employee-sub">${esc(customer(o.customerId)?.phone||"")}</div></td><td>${o.branch}</td><td>${o.date}</td><td>${money(orderTotal(o))}</td><td>${statusPill(o.status)}</td><td><select class="table-select" data-order-status="${o.id}">${["received","washing","ready","completed","cancelled"].map(s=>`<option value="${s}" ${s===o.status?"selected":""}>${statusLabel(s)}</option>`).join("")}</select></td></tr>`).join("");
    el.innerHTML=heading("ORDER MANAGEMENT","Đơn hàng","Tạo đơn, theo dõi trạng thái và kiểm tra số tiền từng đơn.",'<button class="btn" id="new-order">＋ Tạo đơn hàng</button>')+`
      <div class="stats">${stat("Tổng đơn",visibleOrders().length,"Trong phạm vi chi nhánh")}${stat("Đang xử lý",visibleOrders().filter(o=>["received","washing"].includes(o.status)).length,"Cần theo dõi")}${stat("Chờ nhận",visibleOrders().filter(o=>o.status==="ready").length,"Đã hoàn tất xử lý")}${stat("Đã hoàn tất",visibleOrders().filter(o=>o.status==="completed").length,"Đơn đã giao")}</div>
      <div id="order-form-host"></div>${panel("Danh sách đơn hàng","Thay đổi trạng thái trực tiếp tại bảng",table(["Mã đơn","Khách hàng","Chi nhánh","Ngày nhận","Thành tiền","Trạng thái","Cập nhật"],rows))}`;
    document.querySelector("#new-order").addEventListener("click",()=>orderForm());
    document.querySelectorAll("[data-order-status]").forEach(s=>s.addEventListener("change",()=>{const o=state.orders.find(o=>o.id===s.dataset.orderStatus);o.status=s.value;save();notice="Đã cập nhật trạng thái đơn "+o.id;render();}));
  }
  function orderForm(){
    const host=document.querySelector("#order-form-host");
    const customerOpts=state.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${c.phone}</option>`).join("");
    const branch=state.activeBranch==="ALL"?state.branches[0]?.id:state.activeBranch;
    const serviceOpts=state.services.filter(s=>s.active).map(s=>`<option value="${s.id}">${esc(s.name)} (${s.unit})</option>`).join("");
    host.innerHTML=`<section class="panel form-panel"><div class="panel-heading"><div><h2>Tạo đơn mới</h2><p class="panel-subtitle">Giá được lấy theo chi nhánh và lưu cố định vào đơn.</p></div><button class="icon-button" id="close-order">×</button></div><form id="order-form" class="form-grid">
      <div><label>Khách hàng *</label><select name="customerId" required>${customerOpts}</select></div><div><label>Chi nhánh tiếp nhận *</label><select name="branch" id="order-branch">${state.branches.map(b=>`<option value="${b.id}" ${b.id===branch?"selected":""}>${b.code} · ${esc(b.name)}</option>`).join("")}</select></div>
      <div><label>Dịch vụ *</label><select name="serviceId" id="order-service">${serviceOpts}</select></div><div><label>Số lượng (kg/cái) *</label><input name="qty" type="number" min="0.1" step="0.1" value="1" required></div>
      <div><label>Ghi chú</label><input name="note" placeholder="Yêu cầu của khách"></div><div class="form-full"><div class="notice" id="order-price-preview"></div></div>
      <div class="form-full form-actions"><button class="btn btn-outline" type="button" id="cancel-order">Hủy</button><button class="btn" type="submit">Lưu đơn hàng</button></div></form></section>`;
    const updatePreview=()=>{const b=document.querySelector("#order-branch").value,s=service(document.querySelector("#order-service").value),q=Number(document.querySelector('[name="qty"]').value||0),p=s?.prices[b]||0;document.querySelector("#order-price-preview").textContent=`Đơn giá: ${money(p)} / ${s?.unit||""} · Thành tiền dự kiến: ${money(p*q)}`;};
    ["#order-branch","#order-service",'[name="qty"]'].forEach(sel=>document.querySelector(sel).addEventListener("input",updatePreview));updatePreview();
    document.querySelector("#close-order").addEventListener("click",()=>host.innerHTML="");document.querySelector("#cancel-order").addEventListener("click",()=>host.innerHTML="");
    document.querySelector("#order-form").addEventListener("submit",e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries()),s=service(v.serviceId),qty=Number(v.qty),price=s.prices[v.branch];const id=`AL-${today.slice(2).replaceAll("-","")}-${String(state.orders.length+1).padStart(3,"0")}`;state.orders.unshift({id,customerId:v.customerId,branch:v.branch,date:today,items:[{serviceId:s.id,qty,price}],status:"received",note:v.note,createdBy:"Owner Demo"});save();page="orders";notice="Đã tạo đơn "+id;render();});
  }
  function customers(el){
    const rows=state.customers.map(c=>{const orders=state.orders.filter(o=>o.customerId===c.id);const spend=orders.reduce((s,o)=>s+orderTotal(o),0);return `<tr><td><strong>${esc(c.name)}</strong><div class="employee-sub">${c.id}</div></td><td>${esc(c.phone)}</td><td>${esc(c.email||"—")}</td><td>${orders.length}</td><td>${money(spend)}</td><td><button class="text-action" data-edit-customer="${c.id}">Sửa</button></td></tr>`;}).join("");
    el.innerHTML=heading("CUSTOMER RELATIONSHIP","Khách hàng","Hồ sơ khách hàng dùng chung giữa các chi nhánh.",'<button class="btn" id="add-customer">＋ Thêm khách hàng</button>')+`
      <div class="stats">${stat("Tổng khách hàng",state.customers.length,"Hồ sơ toàn hệ thống")}${stat("Khách phát sinh đơn",new Set(state.orders.map(o=>o.customerId)).size,"Có lịch sử mua dịch vụ")}${stat("Tổng chi tiêu",money(state.orders.reduce((s,o)=>s+orderTotal(o),0)),"Theo tổng giá trị đơn")}${stat("Khách hàng mới",state.customers.filter(c=>c.created?.slice(0,7)===today.slice(0,7)).length,"Trong tháng hiện tại")}</div>
      <div id="customer-form-host"></div>${panel("Danh sách khách hàng","Tổng chi tiêu được tính từ giá trị đơn hàng",table(["Khách hàng","Điện thoại","Email","Số đơn","Tổng chi tiêu","Thao tác"],rows))}`;
    document.querySelector("#add-customer").addEventListener("click",()=>customerForm());
    document.querySelectorAll("[data-edit-customer]").forEach(b=>b.addEventListener("click",()=>customerForm(state.customers.find(c=>c.id===b.dataset.editCustomer))));
  }
  function customerForm(c=null){
    const host=document.querySelector("#customer-form-host");
    host.innerHTML=`<section class="panel form-panel"><div class="panel-heading"><h2>${c?"Cập nhật khách hàng":"Thêm khách hàng"}</h2><button class="icon-button" id="close-customer">×</button></div><form id="customer-form" class="form-grid">
      <div><label>Họ tên *</label><input name="name" required value="${esc(c?.name||"")}"></div><div><label>Số điện thoại *</label><input name="phone" required value="${esc(c?.phone||"")}"></div><div><label>Email</label><input name="email" type="email" value="${esc(c?.email||"")}"></div><div><label>Ghi chú</label><input name="note" value="${esc(c?.note||"")}"></div>
      <div class="form-full form-actions"><button class="btn btn-outline" type="button" id="cancel-customer">Hủy</button><button class="btn">Lưu khách hàng</button></div></form></section>`;
    document.querySelector("#close-customer").addEventListener("click",()=>host.innerHTML="");document.querySelector("#cancel-customer").addEventListener("click",()=>host.innerHTML="");
    document.querySelector("#customer-form").addEventListener("submit",e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries());if(c)Object.assign(c,v);else state.customers.push({id:uid("KH"),...v,created:today});save();notice="Đã lưu hồ sơ khách hàng";render();});
  }
  function payments(el){
    const rows=visiblePayments().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>{const o=state.orders.find(o=>o.id===p.orderId);return `<tr><td><strong>${p.id}</strong></td><td>${p.orderId}</td><td>${esc(customer(o?.customerId)?.name||"—")}</td><td>${p.date}</td><td>${p.method==="cash"?"Tiền mặt":"Chuyển khoản"}</td><td>${money(p.amount)}</td><td><span class="state-pill state-active">Đã thu</span></td></tr>`;}).join("");
    const paid=visiblePayments().filter(p=>p.status==="paid");
    el.innerHTML=heading("PAYMENTS","Thanh toán","Ghi nhận tiền mặt, chuyển khoản và theo dõi số tiền còn phải thu.",'<button class="btn" id="add-payment">＋ Ghi nhận thanh toán</button>')+`
      <div class="stats">${stat("Tổng thực thu",money(paid.reduce((s,p)=>s+p.amount,0)),"Theo chi nhánh đang chọn")}${stat("Tiền mặt",money(paid.filter(p=>p.method==="cash").reduce((s,p)=>s+p.amount,0)),"Đã thu")}${stat("Chuyển khoản",money(paid.filter(p=>p.method==="transfer").reduce((s,p)=>s+p.amount,0)),"Đã thu")}${stat("Đơn còn nợ",visibleOrders().filter(o=>orderTotal(o)>paidFor(o.id)).length,"Có số dư chưa thanh toán")}</div><div id="payment-form-host"></div>${panel("Lịch sử thanh toán","Một đơn có thể có nhiều lần thanh toán",table(["Mã thanh toán","Mã đơn","Khách hàng","Ngày","Phương thức","Số tiền","Trạng thái"],rows))}`;
    document.querySelector("#add-payment").addEventListener("click",paymentForm);
  }
  function paymentForm(){
    const host=document.querySelector("#payment-form-host");
    const dueOrders=visibleOrders().filter(o=>orderTotal(o)>paidFor(o.id));
    host.innerHTML=`<section class="panel form-panel"><div class="panel-heading"><h2>Ghi nhận thanh toán</h2><button class="icon-button" id="close-payment">×</button></div>${dueOrders.length?`<form id="payment-form" class="form-grid"><div class="form-full"><label>Đơn hàng *</label><select name="orderId">${dueOrders.map(o=>`<option value="${o.id}">${o.id} · ${esc(customer(o.customerId)?.name)} · Còn ${money(orderTotal(o)-paidFor(o.id))}</option>`).join("")}</select></div><div><label>Số tiền *</label><input name="amount" type="number" min="1" required></div><div><label>Phương thức *</label><select name="method"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select></div><div class="form-full form-actions"><button class="btn btn-outline" type="button" id="cancel-payment">Hủy</button><button class="btn">Lưu thanh toán</button></div></form>`:'<p>Không có đơn hàng còn phải thu trong phạm vi này.</p>'}</section>`;
    document.querySelector("#close-payment").addEventListener("click",()=>host.innerHTML="");document.querySelector("#cancel-payment")?.addEventListener("click",()=>host.innerHTML="");
    document.querySelector("#payment-form")?.addEventListener("submit",e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries()),o=state.orders.find(o=>o.id===v.orderId),amount=Number(v.amount);if(amount>orderTotal(o)-paidFor(o.id)){alert("Số tiền vượt quá số dư của đơn.");return;}state.payments.push({id:uid("TT"),orderId:v.orderId,amount,method:v.method,date:today,status:"paid"});save();notice="Đã ghi nhận thanh toán";render();});
  }
  function reports(el){
    const payments=visiblePayments().filter(p=>p.status==="paid"&&p.date.slice(0,7)===today.slice(0,7));
    const total=payments.reduce((s,p)=>s+p.amount,0);
    const byBranch=state.branches.map(b=>{const v=state.payments.filter(p=>p.status==="paid"&&p.date.slice(0,7)===today.slice(0,7)&&state.orders.find(o=>o.id===p.orderId)?.branch===b.id).reduce((s,p)=>s+p.amount,0);return `<tr><td><strong>${b.code}</strong><div class="employee-sub">${esc(b.name)}</div></td><td>${money(v)}</td><td>${total?kg(v/total*100)+"%":"0%"}</td></tr>`;}).join("");
    el.innerHTML=heading("BUSINESS REPORTS","Báo cáo kinh doanh","Tổng hợp thực thu theo tháng, chi nhánh và phương thức thanh toán.")+`
      <div class="report-filter"><label for="report-month">Tháng báo cáo</label><input id="report-month" type="month" value="${today.slice(0,7)}"><span class="muted">Bản demo đang có dữ liệu mẫu tháng 11/2026.</span></div>
      <div class="stats">${stat("Doanh thu thực thu",money(total),"Tháng đang chọn")}${stat("Tiền mặt",money(payments.filter(p=>p.method==="cash").reduce((s,p)=>s+p.amount,0)),"Thực thu")}${stat("Chuyển khoản",money(payments.filter(p=>p.method==="transfer").reduce((s,p)=>s+p.amount,0)),"Thực thu")}${stat("Số giao dịch",payments.length,"Giao dịch đã ghi nhận")}</div>
      ${panel("Doanh thu theo chi nhánh","So sánh giữa các điểm kinh doanh",table(["Chi nhánh","Thực thu","Tỷ trọng"],byBranch))}
      ${panel("Phân tích đơn hàng","Theo trạng thái hiện tại",table(["Trạng thái","Số đơn"],["received","washing","ready","completed","cancelled"].map(s=>`<tr><td>${statusLabel(s)}</td><td>${visibleOrders().filter(o=>o.status===s).length}</td></tr>`).join("")))}`;
    document.querySelector("#report-month").addEventListener("change",e=>{const month=e.target.value;const ps=visiblePayments().filter(p=>p.status==="paid"&&p.date.slice(0,7)===month);const sum=ps.reduce((s,p)=>s+p.amount,0);document.querySelectorAll(".stats .stat strong")[0].textContent=money(sum);document.querySelectorAll(".stats .stat strong")[1].textContent=money(ps.filter(p=>p.method==="cash").reduce((s,p)=>s+p.amount,0));document.querySelectorAll(".stats .stat strong")[2].textContent=money(ps.filter(p=>p.method==="transfer").reduce((s,p)=>s+p.amount,0));document.querySelectorAll(".stats .stat strong")[3].textContent=ps.length;});
  }
  function staff(el){
    const rows=state.staff.map(s=>`<tr><td><strong>${esc(s.name)}</strong><div class="employee-sub">${esc(s.email)} · ${esc(s.phone)}</div></td><td><span class="role-pill">${roleLabel(s.role)}</span></td><td>${esc(branchName(s.branch))}</td><td><span class="state-pill ${s.active?"state-active":"state-inactive"}">${s.active?"Đang hoạt động":"Tạm khóa"}</span></td><td><button class="text-action" data-staff-toggle="${s.id}">${s.active?"Tạm khóa":"Kích hoạt"}</button></td></tr>`).join("");
    el.innerHTML=heading("TEAM MANAGEMENT","Nhân sự","Theo dõi tài khoản, vai trò và chi nhánh chính của nhân viên.",'<button class="btn" id="add-demo-staff">＋ Thêm nhân viên demo</button>')+`
      <div class="stats">${stat("Tổng nhân sự",state.staff.length,"Toàn hệ thống")}${stat("Owner",state.staff.filter(s=>s.role==="owner").length,"Quản trị")}${stat("Manager",state.staff.filter(s=>s.role==="manager").length,"Quản lý chi nhánh")}${stat("Staff",state.staff.filter(s=>s.role==="staff").length,"Nhân viên vận hành")}</div>
      ${panel("Danh sách nhân sự","Thao tác tạm khóa/kích hoạt chỉ ảnh hưởng dữ liệu demo",table(["Nhân viên","Vai trò","Chi nhánh chính","Trạng thái","Thao tác"],rows))}
      ${panel("Điều chuyển chi nhánh","Nhân viên không tự đổi chi nhánh; yêu cầu cần Owner/Manager duyệt",'<p>Vào mục <strong>Duyệt điều chuyển</strong> để xử lý yêu cầu hỗ trợ chi nhánh.</p>')}`;
    document.querySelector("#add-demo-staff").addEventListener("click",()=>{const name=prompt("Tên nhân viên demo:");if(!name)return;const email=prompt("Email demo:");if(!email)return;state.staff.push({id:uid("NV"),name,email,phone:"",role:"staff",branch:state.activeBranch==="ALL"?"CN01":state.activeBranch,active:true});save();notice="Đã thêm nhân viên demo";render();});
    document.querySelectorAll("[data-staff-toggle]").forEach(b=>b.addEventListener("click",()=>{const s=state.staff.find(x=>x.id===b.dataset.staffToggle);s.active=!s.active;save();render();}));
  }
  function branches(el){
    const rows=state.branches.map(b=>`<tr><td><strong>${b.code}</strong></td><td>${esc(b.name)}</td><td>${esc(b.address)}</td><td><span class="state-pill state-active">${b.active?"Đang hoạt động":"Tạm ngưng"}</span></td><td>${state.staff.filter(s=>s.branch===b.id).length}</td></tr>`).join("");
    el.innerHTML=heading("BRANCH MANAGEMENT","Chi nhánh","Theo dõi hoạt động và dữ liệu theo từng cơ sở.",'<button class="btn" id="add-branch">＋ Thêm chi nhánh demo</button>')+`
      <div class="stats">${stat("Chi nhánh",state.branches.length,"Đã thiết lập")}${stat("Đơn hàng",state.orders.length,"Toàn hệ thống")}${stat("Khách hàng dùng chung",state.customers.length,"Một hồ sơ cho nhiều chi nhánh")}${stat("Yêu cầu chờ duyệt",state.branchRequests.filter(r=>r.status==="pending").length,"Điều chuyển nhân sự")}</div>
      ${panel("Danh sách chi nhánh","Dữ liệu demo CN01 và CN02",table(["Mã","Tên chi nhánh","Địa chỉ","Trạng thái","Nhân sự"],rows))}
      ${panel("Nguyên tắc vận hành","Các quy tắc kiến trúc đã chốt",'<ul class="feature-list"><li>Khách hàng dùng chung toàn hệ thống.</li><li>Nhân viên làm việc tại chi nhánh khác phải gửi yêu cầu và được duyệt.</li><li>Giá dịch vụ được thiết lập riêng cho từng chi nhánh.</li><li>Đơn hàng ghi nhận chi nhánh thực tế tiếp nhận.</li></ul>')}`;
    document.querySelector("#add-branch").addEventListener("click",()=>{const code=prompt("Mã chi nhánh, ví dụ CN03:");if(!code)return;if(state.branches.some(b=>b.code===code.toUpperCase())){alert("Mã chi nhánh đã tồn tại.");return;}const name=prompt("Tên chi nhánh:");if(!name)return;state.branches.push({id:code.toUpperCase(),code:code.toUpperCase(),name,address:"Chưa cập nhật",active:true});state.services.forEach(s=>s.prices[code.toUpperCase()]=s.prices.CN01);save();notice="Đã thêm chi nhánh demo và sao chép giá gốc từ CN01";render();});
  }
  function services(el){
    const rows=state.services.map(s=>`<tr><td><strong>${esc(s.name)}</strong><div class="employee-sub">${s.code} · ${s.unit}</div></td>${state.branches.map(b=>`<td><input class="price-input" type="number" min="0" data-price-service="${s.id}" data-price-branch="${b.id}" value="${s.prices[b.id]||0}"></td>`).join("")}<td><span class="state-pill ${s.active?"state-active":"state-inactive"}">${s.active?"Đang áp dụng":"Tạm ngưng"}</span></td></tr>`).join("");
    el.innerHTML=heading("SERVICE PRICEBOOK","Bảng giá dịch vụ","Một danh mục dịch vụ chung, đơn giá được cấu hình riêng theo chi nhánh.")+`
      <div class="notice">Thay đổi đơn giá tại đây chỉ ảnh hưởng đơn hàng tạo mới. Đơn hàng cũ giữ nguyên giá đã chốt tại thời điểm tiếp nhận.</div>
      ${panel("Bảng giá theo chi nhánh","Nhập đơn giá mới và nhấn Lưu bảng giá",table(["Dịch vụ",...state.branches.map(b=>b.code),"Trạng thái"],rows))}
      <div class="form-actions"><button class="btn" id="save-prices">Lưu bảng giá</button></div>`;
    document.querySelector("#save-prices").addEventListener("click",()=>{document.querySelectorAll("[data-price-service]").forEach(i=>{const s=service(i.dataset.priceService);s.prices[i.dataset.priceBranch]=Number(i.value);});save();notice="Đã lưu bảng giá demo";render();});
  }
  function approvals(el){
    const rows=state.branchRequests.map(r=>{const s=state.staff.find(s=>s.id===r.staffId);return `<tr><td><strong>${r.id}</strong></td><td>${esc(s?.name||r.staffId)}</td><td>${esc(branchName(r.from))}</td><td>${esc(branchName(r.to))}</td><td>${r.date}</td><td>${esc(r.reason)}</td><td>${r.status==="pending"?'<span class="state-pill">Chờ duyệt</span>':r.status==="approved"?'<span class="state-pill state-active">Đã duyệt</span>':'<span class="state-pill state-inactive">Từ chối</span>'}</td><td>${r.status==="pending"?`<button class="text-action" data-approve="${r.id}">Duyệt</button> · <button class="text-action danger-text" data-reject="${r.id}">Từ chối</button>`:"—"}</td></tr>`;}).join("");
    el.innerHTML=heading("BRANCH TRANSFER APPROVAL","Duyệt điều chuyển","Owner/Manager xem xét yêu cầu làm việc tại chi nhánh khác.")+`
      <div class="stats">${stat("Tổng yêu cầu",state.branchRequests.length,"Đã gửi")}${stat("Chờ duyệt",state.branchRequests.filter(r=>r.status==="pending").length,"Cần xử lý")}${stat("Đã duyệt",state.branchRequests.filter(r=>r.status==="approved").length,"Đã chấp thuận")}${stat("Từ chối",state.branchRequests.filter(r=>r.status==="rejected").length,"Không được duyệt")}</div>
      ${panel("Yêu cầu điều chuyển","Duyệt sẽ cập nhật chi nhánh chính của nhân viên trong dữ liệu demo",table(["Mã yêu cầu","Nhân viên","Chi nhánh gốc","Chi nhánh xin hỗ trợ","Ngày","Lý do","Trạng thái","Xử lý"],rows))}
      <div class="panel form-panel"><h2>Tạo yêu cầu demo</h2><form id="request-form" class="form-grid"><div><label>Nhân viên</label><select name="staffId">${state.staff.filter(s=>s.role!=="owner").map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div><div><label>Chi nhánh muốn hỗ trợ</label><select name="to">${state.branches.map(b=>`<option value="${b.id}">${b.code} · ${esc(b.name)}</option>`).join("")}</select></div><div class="form-full"><label>Lý do</label><input name="reason" required placeholder="Hỗ trợ ca / thay ca..."></div><div class="form-full form-actions"><button class="btn">Gửi yêu cầu demo</button></div></form></div>`;
    document.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>{const r=state.branchRequests.find(x=>x.id===b.dataset.approve),s=state.staff.find(x=>x.id===r.staffId);r.status="approved";if(s)s.branch=r.to;save();notice="Đã duyệt yêu cầu điều chuyển";render();}));
    document.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>{state.branchRequests.find(x=>x.id===b.dataset.reject).status="rejected";save();notice="Đã từ chối yêu cầu";render();}));
    document.querySelector("#request-form").addEventListener("submit",e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries()),s=state.staff.find(x=>x.id===v.staffId);state.branchRequests.unshift({id:uid("YC"),staffId:v.staffId,from:s.branch,to:v.to,date:today,reason:v.reason,status:"pending"});save();notice="Đã tạo yêu cầu điều chuyển demo";render();});
  }
  render();
}
