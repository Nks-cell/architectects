/**
 * Admin Panel Client-Side SPA
 * This file is purely vanilla JS, generating the HTML and CSS for the dashboard.
 */

const ADMIN_CSS = `
    :root {
        --bg: #F7F5EF;
        --sidebar: #173D35;
        --text-light: #E9E1D5;
        --accent: #C97B5B;
        --text-dark: #202522;
        --card-bg: #FFFFFF;
        --border: #E2E8F0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { background-color: var(--bg); color: var(--text-dark); }
    
    .login-wrapper { display: flex; height: 100vh; align-items: center; justify-content: center; background: var(--sidebar); }
    .login-box { background: var(--card-bg); padding: 3rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); width: 100%; max-width: 400px; text-align: center; }
    .login-box h2 { color: var(--sidebar); margin-bottom: 2rem; }
    
    .form-control { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 6px; }
    .btn { padding: 0.75rem 1.5rem; background: var(--sidebar); color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 500; transition: background 0.3s; }
    .btn:hover { background: var(--accent); }
    .btn-danger { background: #e53e3e; }
    .btn-small { padding: 0.4rem 0.8rem; width: auto; font-size: 0.85rem; }

    .layout { display: flex; height: 100vh; overflow: hidden; }
    .sidebar { width: 250px; background: var(--sidebar); color: var(--text-light); display: flex; flex-direction: column; }
    .sidebar-header { padding: 2rem; font-size: 1.25rem; font-weight: 600; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .nav-links { list-style: none; padding: 1rem 0; flex: 1; }
    .nav-item { padding: 1rem 2rem; cursor: pointer; transition: background 0.2s; opacity: 0.8; }
    .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.1); opacity: 1; border-left: 4px solid var(--accent); }
    
    .main-content { flex: 1; overflow-y: auto; padding: 2rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-title { font-size: 1.8rem; color: var(--sidebar); }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .stat-value { font-size: 2rem; font-weight: 600; color: var(--sidebar); margin-top: 0.5rem; }
    .stat-label { color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }

    .data-table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .data-table th, .data-table td { padding: 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    .data-table th { background: #f8fafc; font-weight: 500; color: #475569; font-size: 0.85rem; text-transform: uppercase; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .badge-new { background: #dbeafe; color: #1e40af; }
    .badge-contacted { background: #fef3c7; color: #92400e; }
    .badge-completed { background: #dcfce3; color: #166534; }

    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: var(--card-bg); padding: 2rem; border-radius: 8px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; margin-bottom: 1.5rem; }
    .close-btn { cursor: pointer; font-size: 1.5rem; background: none; border: none; }
`;

class AdminApp {
    constructor() {
        this.root = document.getElementById('admin-root');
        this.state = { view: 'dashboard', data: {} };
        this.injectCSS();
        this.checkAuth();
    }

    injectCSS() {
        const style = document.createElement('style');
        style.innerHTML = ADMIN_CSS;
        document.head.appendChild(style);
    }

    async checkAuth() {
        try {
            const res = await fetch('/api/admin/check');
            if (res.ok) this.renderApp();
            else this.renderLogin();
        } catch (e) {
            this.renderLogin();
        }
    }

    renderLogin() {
        this.root.innerHTML = `
            <div class="login-wrapper">
                <div class="login-box">
                    <h2>ATELIER 27 ADMIN</h2>
                    <form id="loginForm">
                        <input type="email" id="email" class="form-control" placeholder="Admin Email" required>
                        <input type="password" id="password" class="form-control" placeholder="Password" required>
                        <button type="submit" class="btn">Secure Login</button>
                        <div id="loginError" style="color: red; margin-top: 1rem; font-size: 0.9rem;"></div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const res = await fetch('/api/admin/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (res.ok) this.renderApp();
            else document.getElementById('loginError').innerText = 'Invalid credentials';
        });
    }

    renderApp() {
        this.root.innerHTML = `
            <div class="layout">
                <aside class="sidebar">
                    <div class="sidebar-header">ATELIER 27.</div>
                    <ul class="nav-links">
                        <li class="nav-item ${this.state.view === 'dashboard' ? 'active' : ''}" data-view="dashboard">Dashboard</li>
                        <li class="nav-item ${this.state.view === 'inquiries' ? 'active' : ''}" data-view="inquiries">Inquiries</li>
                        <li class="nav-item ${this.state.view === 'projects' ? 'active' : ''}" data-view="projects">Projects</li>
                        <li class="nav-item" data-view="logout">Logout</li>
                    </ul>
                </aside>
                <main class="main-content" id="main-content">Loading...</main>
            </div>
            <div id="modalContainer" class="modal">
                <div class="modal-content" id="modalBody"></div>
            </div>
        `;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => this.handleNavigation(e.target.dataset.view));
        });
        this.loadView(this.state.view);
    }

    async handleNavigation(view) {
        if (view === 'logout') {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.reload();
            return;
        }
        this.state.view = view;
        this.renderApp();
    }

    async loadView(view) {
        const content = document.getElementById('main-content');
        if (view === 'dashboard') {
            const res = await fetch('/api/admin/dashboard');
            const data = await res.json();
            content.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Overview</h1>
                </div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Projects</div>
                        <div class="stat-value">${data.stats.totalProjects}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Total Inquiries</div>
                        <div class="stat-value">${data.stats.totalInquiries}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Pending Inquiries</div>
                        <div class="stat-value">${data.stats.pendingInquiries}</div>
                    </div>
                </div>
                <h2>Recent Inquiries</h2><br>
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                    <tbody>
                        ${data.recentInquiries.map(i => `
                            <tr>
                                <td>${new Date(i.createdAt).toLocaleDateString()}</td>
                                <td>${i.name}</td>
                                <td>${i.projectType}</td>
                                <td><span class="badge badge-${i.status}">${i.status.toUpperCase()}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (view === 'inquiries') {
            const res = await fetch('/api/admin/inquiries');
            const inquiries = await res.json();
            this.state.data.inquiries = inquiries;
            content.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Inquiries</h1>
                </div>
                <table class="data-table">
                    <thead><tr><th>Ref</th><th>Name</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${inquiries.map(i => `
                            <tr>
                                <td>${i._id.slice(-6).toUpperCase()}</td>
                                <td>${i.name}</td>
                                <td>${i.email}</td>
                                <td><span class="badge badge-${i.status}">${i.status.toUpperCase()}</span></td>
                                <td><button class="btn btn-small view-inq-btn" data-id="${i._id}">Manage</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.querySelectorAll('.view-inq-btn').forEach(b => {
                b.addEventListener('click', (e) => this.openInquiryModal(e.target.dataset.id));
            });
        } else if (view === 'projects') {
            const res = await fetch('/api/admin/projects');
            const projects = await res.json();
            content.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Projects Portfolio</h1>
                    <button class="btn btn-small" id="addProjectBtn">Add Project</button>
                </div>
                <table class="data-table">
                    <thead><tr><th>Image</th><th>Title</th><th>Category</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                        ${projects.map(p => `
                            <tr>
                                <td><img src="${p.image}" width="50" height="50" style="object-fit:cover; border-radius:4px;"></td>
                                <td>${p.title}</td>
                                <td>${p.category}</td>
                                <td>${p.status}</td>
                                <td><button class="btn btn-small btn-danger del-proj-btn" data-id="${p._id}">Delete</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('addProjectBtn').addEventListener('click', () => this.openProjectModal());
            document.querySelectorAll('.del-proj-btn').forEach(b => {
                b.addEventListener('click', async (e) => {
                    if(confirm('Delete project?')) {
                        await fetch(`/api/admin/projects/${e.target.dataset.id}`, { method: 'DELETE' });
                        this.loadView('projects');
                    }
                });
            });
        }
    }

    openInquiryModal(id) {
        const i = this.state.data.inquiries.find(x => x._id === id);
        const modal = document.getElementById('modalContainer');
        document.getElementById('modalBody').innerHTML = `
            <div class="modal-header">
                <h2>Inquiry Details</h2>
                <button class="close-btn" onclick="document.getElementById('modalContainer').style.display='none'">&times;</button>
            </div>
            <p><strong>Name:</strong> ${i.name}</p>
            <p><strong>Email:</strong> ${i.email}</p>
            <p><strong>Phone:</strong> ${i.phone}</p>
            <p><strong>Project:</strong> ${i.projectType} (${i.area || 'N/A'})</p>
            <p><strong>Description:</strong> ${i.description}</p>
            <hr style="margin: 1rem 0; border: 0; border-top: 1px solid var(--border);">
            <form id="updateInqForm">
                <label>Status</label>
                <select id="inqStatus" class="form-control">
                    <option value="new" ${i.status==='new'?'selected':''}>New</option>
                    <option value="contacted" ${i.status==='contacted'?'selected':''}>Contacted</option>
                    <option value="completed" ${i.status==='completed'?'selected':''}>Completed</option>
                </select>
                <label>Internal Notes</label>
                <textarea id="inqNotes" class="form-control" rows="3">${i.notes || ''}</textarea>
                <button type="submit" class="btn">Update Inquiry</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('updateInqForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const status = document.getElementById('inqStatus').value;
            const notes = document.getElementById('inqNotes').value;
            await fetch(`/api/admin/inquiries/${id}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ status, notes })
            });
            modal.style.display = 'none';
            this.loadView('inquiries');
        });
    }

    openProjectModal() {
        const modal = document.getElementById('modalContainer');
        document.getElementById('modalBody').innerHTML = `
            <div class="modal-header">
                <h2>Add New Project</h2>
                <button class="close-btn" onclick="document.getElementById('modalContainer').style.display='none'">&times;</button>
            </div>
            <form id="addProjectForm">
                <input type="text" id="pTitle" class="form-control" placeholder="Project Title" required>
                <select id="pCategory" class="form-control">
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Interiors">Interiors</option>
                    <option value="Hospitality">Hospitality</option>
                </select>
                <input type="text" id="pLocation" class="form-control" placeholder="Location" required>
                <input type="url" id="pImage" class="form-control" placeholder="Image URL (Unsplash recommended)" required>
                <textarea id="pDesc" class="form-control" placeholder="Brief Description" required></textarea>
                <textarea id="pConcept" class="form-control" placeholder="Full Concept / Challenge Solution" required></textarea>
                <button type="submit" class="btn">Save Project</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('addProjectForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('pTitle').value,
                category: document.getElementById('pCategory').value,
                location: document.getElementById('pLocation').value,
                image: document.getElementById('pImage').value,
                description: document.getElementById('pDesc').value,
                concept: document.getElementById('pConcept').value,
                status: 'published'
            };
            await fetch(`/api/admin/projects`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify(data)
            });
            modal.style.display = 'none';
            this.loadView('projects');
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => new AdminApp());
