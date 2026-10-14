// CampusFix demo app. Configure Supabase in the two constants below.
const SUPABASE_URL = "https://bfdyvptqzrcpxtrjyxxc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FsTHXVkuY5tAcq721iZFxA_OZK0R3w7";
const isConfigured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const client = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
let complaints = [];
const table = "complaints";

// DEMO ONLY: this password is visible in browser code and is NOT real security.
const DEMO_STAFF_PASSWORD = "CampusFix2026";
let currentRole = null;
function showRoleChooser() {
  currentRole = null;
  $("roleChooser").hidden = false; $("staffLogin").hidden = true; $("appContent").hidden = true;
  $("staffPassword").value = ""; $("loginMessage").textContent = "";
}
function enterPortal(role) {
  currentRole = role; $("roleChooser").hidden = true; $("staffLogin").hidden = true; $("appContent").hidden = false;
  const isStaff = role === "staff";
  $("currentRoleLabel").textContent = isStaff ? "Authorised Person — Service Desk" : "Student Portal";
  $("staffStats").hidden = !isStaff; $("staffPanel").hidden = !isStaff; $("studentTracker").hidden = isStaff;
  $("complaintForm").closest(".panel").hidden = false;
  $("submitBtn").hidden = isStaff;
  const formHeading = $("complaintForm").closest(".panel").querySelector(".section-heading");
  formHeading.querySelector("h2").textContent = isStaff ? "Student ticket submission is disabled in staff view" : "Report a campus issue";
  $("complaintForm").hidden = isStaff;
  if (isStaff) loadComplaints();
}
$("studentRole").addEventListener("click", () => enterPortal("student"));
$("staffRole").addEventListener("click", () => { $("roleChooser").hidden = true; $("staffLogin").hidden = false; });
$("backToRoles").addEventListener("click", showRoleChooser);
$("switchRole").addEventListener("click", showRoleChooser);
$("staffLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("staffPassword").value === DEMO_STAFF_PASSWORD) enterPortal("staff");
  else setMessage("loginMessage", "Incorrect demo password.", true);
});
$("trackBtn").addEventListener("click", async () => {
  const email = $("trackEmail").value.trim().toLowerCase();
  const out = $("studentTicketList");
  if (!email) { out.innerHTML = '<div class="empty">Please enter your email.</div>'; return; }
  if (!client) { out.innerHTML = '<div class="empty">Database is not configured.</div>'; return; }
  out.innerHTML = '<div class="empty">Searching tickets…</div>';
  const {data,error} = await client.from(table).select("ticket_code,title,category,location,status,created_at,description,student_email").eq("student_email", email).order("created_at", {ascending:false});
  if (error) { out.innerHTML = `<div class="empty">Could not search tickets: ${escapeHTML(error.message)}</div>`; return; }
  if (!data || !data.length) { out.innerHTML = '<div class="empty">No tickets found for this email.</div>'; return; }
  out.innerHTML = data.map(c => `<article class="ticket"><div><h3>${escapeHTML(c.title)} <span class="tag">${escapeHTML(c.ticket_code || "Ticket")}</span></h3><div class="ticket-meta"><span class="tag ${statusClass(c.status)}">${escapeHTML(c.status)}</span><span class="tag">${escapeHTML(c.category)}</span></div><p>${escapeHTML(c.description)}</p><p>${escapeHTML(c.location)} · ${escapeHTML(formatDate(c.created_at))}</p></div></article>`).join("");
});

function setMessage(id, text, isError=false) {
  const el = $(id); el.textContent = text; el.classList.toggle("error", isError);
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function statusClass(status) {
  return status === "Resolved" ? "status-resolved" : status === "In Progress" ? "status-progress" : "status-open";
}
function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {year:"numeric",month:"short",day:"numeric"});
}
function updateStats() {
  $("totalCount").textContent = complaints.length;
  $("openCount").textContent = complaints.filter(x => x.status === "Open").length;
  $("progressCount").textContent = complaints.filter(x => x.status === "In Progress").length;
  $("resolvedCount").textContent = complaints.filter(x => x.status === "Resolved").length;
}
function renderComplaints() {
  const q = $("searchBox").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const category = $("categoryFilter").value;
  const visible = complaints.filter(c => {
    const matchesText = [c.title,c.student_name,c.location,c.description,c.ticket_code].some(v => String(v||"").toLowerCase().includes(q));
    return matchesText && (!status || c.status === status) && (!category || c.category === category);
  });
  const list = $("complaintList");
  if (!visible.length) { list.innerHTML = '<div class="empty">No complaints match these filters.</div>'; return; }
  list.innerHTML = visible.map(c => `
    <article class="ticket">
      <div>
        <h3>${escapeHTML(c.title)} <span class="tag">${escapeHTML(c.ticket_code || "CF-"+c.id)}</span></h3>
        <div class="ticket-meta">
          <span class="tag ${statusClass(c.status)}">${escapeHTML(c.status)}</span>
          <span class="tag">${escapeHTML(c.category)}</span>
          <span class="tag ${c.priority === "High" ? "priority-high" : ""}">${escapeHTML(c.priority)} priority</span>
        </div>
        <p>${escapeHTML(c.description)}</p>
        <p><strong>${escapeHTML(c.student_name)}</strong> · ${escapeHTML(c.location)} · ${escapeHTML(formatDate(c.created_at))}</p>
        <p>Assigned to: ${escapeHTML(c.assigned_to || "Not assigned")}${c.resolution_note ? " · Note: "+escapeHTML(c.resolution_note) : ""}</p>
      </div>
      <div class="ticket-actions">
        <button class="secondary" data-edit="${c.id}">Update</button>
        <button class="secondary" data-delete="${c.id}">Delete</button>
      </div>
    </article>`).join("");
}
async function loadComplaints() {
  if (!client) {
    $("connectionState").textContent = "Setup required";
    $("complaintList").innerHTML = '<div class="empty">Database not configured yet. Follow README.md: create a Supabase project, run schema.sql, then paste your Project URL and anon key into app.js.</div>';
    return;
  }
  $("connectionState").textContent = "Connecting…";
  const {data,error} = await client.from(table).select("*").order("created_at",{ascending:false});
  if (error) {
    $("connectionState").textContent = "Connection error";
    $("complaintList").innerHTML = `<div class="empty">Could not load database records: ${escapeHTML(error.message)}. Check README setup and table policies.</div>`;
    return;
  }
  complaints = data || [];
  $("connectionState").textContent = "Database connected";
  updateStats(); renderComplaints();
}
$("complaintForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) { setMessage("formMessage","Configure Supabase first using README.md.",true); return; }
  const btn = $("submitBtn"); btn.disabled = true; setMessage("formMessage","Saving complaint…");
  const payload = {
    student_name:$("studentName").value.trim(), student_email:$("studentEmail").value.trim(),
    category:$("category").value, location:$("location").value.trim(), priority:$("priority").value,
    title:$("title").value.trim(), description:$("description").value.trim(), status:"Open"
  };
  const {error} = await client.from(table).insert(payload);
  btn.disabled = false;
  if (error) { setMessage("formMessage","Could not save: "+error.message,true); return; }
  $("complaintForm").reset(); setMessage("formMessage","Complaint submitted successfully.");
  if (currentRole === "student") {
    $("trackEmail").value = payload.student_email;
    $("trackBtn").click();
  }
});
$("complaintList").addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit, deleteId = event.target.dataset.delete;
  if (editId) {
    const c = complaints.find(x => String(x.id) === String(editId)); if (!c) return;
    $("editId").value = c.id; $("editStatus").value = c.status;
    $("editAssigned").value = c.assigned_to || ""; $("editResolution").value = c.resolution_note || "";
    setMessage("editMessage",""); $("editDialog").showModal();
  }
  if (deleteId) {
    const c = complaints.find(x => String(x.id) === String(deleteId)); if (!c) return;
    if (!confirm(`Delete ticket ${c.ticket_code || c.id}? This cannot be undone.`)) return;
    const {error} = await client.from(table).delete().eq("id", deleteId);
    if (error) alert("Delete failed: "+error.message); else await loadComplaints();
  }
});
$("editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  const id = $("editId").value;
  const changes = {status:$("editStatus").value, assigned_to:$("editAssigned").value.trim() || null, resolution_note:$("editResolution").value.trim() || null};
  const {error} = await client.from(table).update(changes).eq("id",id);
  if (error) { setMessage("editMessage","Update failed: "+error.message,true); return; }
  $("editDialog").close(); await loadComplaints();
});
function closeDialog(){ $("editDialog").close(); }
$("closeDialog").addEventListener("click",closeDialog);
$("cancelEdit").addEventListener("click",closeDialog);
$("refreshBtn").addEventListener("click",loadComplaints);
["searchBox","statusFilter","categoryFilter"].forEach(id => $(id).addEventListener("input",renderComplaints));
