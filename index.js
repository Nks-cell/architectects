require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ==========================================
// DATABASE CONNECTION & INITIALIZATION
// ==========================================
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!process.env.MONGODB_URI) {
    throw new Error("Database connection failed: MONGODB_URI is missing.");
  }
  const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(process.env.MONGODB_DB || "atelier27");
  await initializeSampleData(cachedDb);
  return cachedDb;
}

async function initializeSampleData(db) {
  const projectsCol = db.collection("projects");
  const count = await projectsCol.countDocuments();
  if (count === 0) {
    const sampleProjects = [
      {
        slug: "solstice-residence",
        title: "The Solstice Residence",
        category: "Residential",
        location: "Raipur, India",
        image:
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
        description:
          "A seamless blend of indoor and outdoor living, maximizing natural light and cross-ventilation.",
        concept:
          "Designed around a central courtyard, this modern villa integrates passive cooling strategies with honest materials like exposed concrete and natural timber.",
        status: "published",
        createdAt: new Date(),
      },
      {
        slug: "casa-verde",
        title: "Casa Verde",
        category: "Residential",
        location: "Bhilai, India",
        image:
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
        description:
          "Sustainable villa with integrated green roofs and rainwater harvesting.",
        concept:
          "A climate-responsive home that blurs the boundary between architecture and landscape, featuring lush internal gardens.",
        status: "published",
        createdAt: new Date(),
      },
      {
        slug: "courtyard-house",
        title: "The Courtyard House",
        category: "Residential",
        location: "Pune, India",
        image:
          "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80",
        description:
          "Traditional spatial planning meets contemporary minimalist aesthetics.",
        concept:
          "Reviving the vernacular courtyard topology with modern minimalist geometry to foster family interaction.",
        status: "published",
        createdAt: new Date(),
      },
      {
        slug: "form-function",
        title: "Form & Function",
        category: "Interiors",
        location: "Mumbai, India",
        image:
          "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
        description:
          "Bespoke residential interiors focusing on materiality and refined details.",
        concept:
          "Curated spaces with bespoke furniture, muted tones, and textural contrasts that speak to refined luxury.",
        status: "published",
        createdAt: new Date(),
      },
      {
        slug: "olive-workspace",
        title: "The Olive Workspace",
        category: "Commercial",
        location: "Bangalore, India",
        image:
          "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
        description:
          "A modern, collaborative office space designed for a tech startup.",
        concept:
          "Breaking down corporate silos through fluid workspaces, acoustic timber cladding, and biophilic design elements.",
        status: "published",
        createdAt: new Date(),
      },
      {
        slug: "terra-retreat",
        title: "Terra Retreat",
        category: "Hospitality",
        location: "Goa, India",
        image:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
        description:
          "Boutique hospitality project emphasizing wellness and natural materials.",
        concept:
          "A holistic retreat embedded in nature, utilizing locally sourced laterite stone and sustainable timber frameworks.",
        status: "published",
        createdAt: new Date(),
      },
    ];
    await projectsCol.insertMany(sampleProjects);
  }
}

// ==========================================
// SECURITY & AUTH MIDDLEWARE
// ==========================================
function requireAdminSetup(req, res, next) {
  if (
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.JWT_SECRET
  ) {
    return res.status(500).json({
      error: "Server configuration error. Admin environment variables missing.",
    });
  }
  next();
}

function verifyAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ==========================================
// PUBLIC API ROUTING
// ==========================================
app.post("/api/inquiry", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const {
      name,
      email,
      phone,
      city,
      projectType,
      area,
      budget,
      date,
      contactMethod,
      description,
      consent,
    } = req.body;

    if (!name || !email || !phone || !consent) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const inquiry = {
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      projectType: String(projectType),
      area: String(area),
      budget: String(budget),
      preferredDate: String(date),
      contactMethod: String(contactMethod),
      description: String(description).trim(),
      status: "new",
      createdAt: new Date(),
    };

    const result = await db.collection("inquiries").insertOne(inquiry);
    res.json({
      success: true,
      reference: result.insertedId.toString().slice(-6).toUpperCase(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find({ status: "published" })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to load projects" });
  }
});

// ==========================================
// ADMIN API ROUTING
// ==========================================
app.post("/api/admin/login", requireAdminSetup, (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_EMAIL &&
    bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH)
  ) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "12h",
    });
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true });
});

app.get("/api/admin/check", verifyAdmin, (req, res) =>
  res.json({ success: true }),
);

app.get("/api/admin/dashboard", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const [totalProjects, totalInquiries, pendingInquiries] = await Promise.all(
      [
        db.collection("projects").countDocuments(),
        db.collection("inquiries").countDocuments(),
        db.collection("inquiries").countDocuments({ status: "new" }),
      ],
    );
    const recentInquiries = await db
      .collection("inquiries")
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    res.json({
      stats: { totalProjects, totalInquiries, pendingInquiries },
      recentInquiries,
    });
  } catch (err) {
    res.status(500).json({ error: "Dashboard error" });
  }
});

app.get("/api/admin/projects", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Error fetching projects" });
  }
});

app.post("/api/admin/projects", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { title, category, location, image, description, concept, status } =
      req.body;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    const project = {
      title,
      slug,
      category,
      location,
      image,
      description,
      concept,
      status,
      createdAt: new Date(),
    };
    await db.collection("projects").insertOne(project);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error creating project" });
  }
});

app.delete("/api/admin/projects/:id", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    await db
      .collection("projects")
      .deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error deleting project" });
  }
});

app.get("/api/admin/inquiries", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const inquiries = await db
      .collection("inquiries")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: "Error fetching inquiries" });
  }
});

app.put("/api/admin/inquiries/:id", verifyAdmin, async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { status, notes } = req.body;
    await db
      .collection("inquiries")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status, notes, updatedAt: new Date() } },
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error updating inquiry" });
  }
});

// ==========================================
// PUBLIC FRONTEND UI GENERATION
// ==========================================
const getPublicStyles = () => `
    :root {
        --ivory: #F7F5EF; --forest: #173D35; --sage: #A8B8A1; 
        --terra: #C97B5B; --sand: #E9E1D5; --text: #202522;
        --glass-bg: rgba(255, 255, 255, 0.4);
        --glass-border: rgba(255, 255, 255, 0.3);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; background-color: var(--ivory); color: var(--text); overflow-x: hidden; width: 100%; }
    h1, h2, h3, h4, .serif { font-family: 'Playfair Display', serif; font-weight: 400; }
    img { max-width: 100%; height: auto; display: block; }
    
    /* Typography & Utils */
    .text-center { text-align: center; }
    .section-title { font-size: clamp(2rem, 5vw, 4rem); margin-bottom: 1rem; color: var(--forest); line-height: 1.1; }
    .section-subtitle { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; color: var(--terra); display: block; margin-bottom: 1rem; }
    .container { max-width: 1280px; margin: 0 auto; padding: 0 2rem; width: 100%; }
    .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
    
    /* Layouts */
    .responsive-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 4rem; }
    .align-center { align-items: center; }
    .form-row { display: flex; gap: 1rem; }

    /* Glassmorphism */
    .glass {
        background: var(--glass-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
    }
    .glass-dark {
        background: rgba(23, 61, 53, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--ivory);
    }

    /* Buttons */
    .btn { display: inline-block; padding: 1rem 2rem; text-decoration: none; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s ease; cursor: pointer; border: none; text-align: center; }
    .btn-primary { background: var(--forest); color: var(--ivory); }
    .btn-primary:hover { background: var(--terra); }
    .btn-glass { background: var(--glass-bg); color: var(--forest); border: 1px solid var(--forest); backdrop-filter: blur(10px); }
    .btn-glass:hover { background: rgba(255, 255, 255, 0.8); }

    /* Header */
    header { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; padding: 1rem 0; transition: transform 0.3s ease; }
    .nav-container { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; border-radius: 50px; position: relative; }
    .logo { font-size: 1.5rem; font-weight: 700; letter-spacing: 2px; color: var(--forest); text-decoration: none; z-index: 1001; }
    nav ul { display: flex; gap: 2rem; list-style: none; align-items: center; }
    nav a { text-decoration: none; color: var(--forest); font-size: 0.9rem; font-weight: 500; transition: color 0.3s; }
    nav a:hover { color: var(--terra); }
    .mobile-menu-btn { display: none; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--forest); z-index: 1001; }

    /* Hero */
    .hero { height: 100vh; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .hero-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
    .hero-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(247,245,239,0.3), rgba(247,245,239,0.8)); z-index: -1; }
    .hero-content { text-align: center; max-width: 800px; padding: 3rem; border-radius: 20px; margin: 0 1rem; }
    .hero-content h1 { font-size: clamp(2.5rem, 8vw, 6rem); margin-bottom: 1.5rem; color: var(--forest); }
    .hero-content p { font-size: clamp(1rem, 3vw, 1.2rem); margin-bottom: 2rem; color: var(--text); }
    .hero-actions { display: flex; gap: 1rem; justify-content: center; }

    /* Projects Grid */
    .filters { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 3rem; flex-wrap: wrap; }
    .filter-btn { background: none; border: 1px solid var(--forest); padding: 0.5rem 1.2rem; border-radius: 30px; cursor: pointer; transition: all 0.3s; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .filter-btn.active, .filter-btn:hover { background: var(--forest); color: var(--ivory); }
    .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; }
    .project-card { display: block; text-decoration: none; border-radius: 12px; overflow: hidden; position: relative; transition: transform 0.3s; }
    .project-card:hover { transform: translateY(-5px); }
    .project-img-wrapper { height: 400px; overflow: hidden; }
    .project-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s; }
    .project-card:hover img { transform: scale(1.05); }
    .project-info { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; padding: 1.5rem; border-radius: 8px; }
    .project-info h3 { margin-bottom: 0.5rem; font-size: 1.5rem; color: var(--forest); }
    .project-info p { font-size: 0.85rem; color: var(--text); text-transform: uppercase; letter-spacing: 1px; }

    /* Services & Cards */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
    .service-card { padding: 2rem; border-radius: 12px; text-align: center; }
    .service-card h3 { font-size: 1.5rem; margin-bottom: 1rem; color: var(--forest); }
    .service-card p { font-size: 0.95rem; line-height: 1.6; }

    /* Process Timeline */
    .process-timeline { display: flex; flex-direction: column; gap: 2rem; max-width: 800px; margin: 0 auto; }
    .process-step { display: flex; gap: 2rem; align-items: flex-start; }
    .step-number { font-family: 'Playfair Display', serif; font-size: 3rem; color: var(--terra); opacity: 0.5; line-height: 1; }
    .step-content h3 { font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--forest); }

    /* Team */
    .team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    .team-member img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; margin-bottom: 1.5rem; filter: grayscale(20%); }
    
    /* Forms */
    .form-group { margin-bottom: 1.5rem; width: 100%; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    .form-control { width: 100%; padding: 1rem; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); border-radius: 8px; color: var(--ivory); font-family: inherit; font-size: 1rem; }
    .form-control:focus { outline: none; border-color: var(--terra); background: rgba(255,255,255,0.15); }
    select.form-control option { background: var(--forest); color: var(--ivory); }

    /* Footer */
    footer { background: var(--forest); color: var(--ivory); padding: 4rem 2rem 2rem; text-align: center; }
    .demo-notice { font-size: 0.75rem; opacity: 0.6; margin-top: 3rem; text-transform: uppercase; letter-spacing: 1px; }

    /* Animations */
    .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s ease-out; }
    .reveal.active { opacity: 1; transform: translateY(0); }

    /* ==========================================
       RESPONSIVE DESIGN (MOBILE & TABLET)
       ========================================== */
    @media (max-width: 992px) {
        .responsive-grid { gap: 2rem; }
        .hero-content { padding: 2rem; }
    }

    @media (max-width: 768px) {
        .container { padding: 0 1.25rem; }
        .py-20 { padding-top: 3.5rem; padding-bottom: 3.5rem; }
        
        /* Mobile Header & Nav */
        .nav-container { padding: 0.75rem 1.5rem; border-radius: 12px; }
        .mobile-menu-btn { display: block; }
        nav ul { 
            display: flex; flex-direction: column; position: absolute; 
            top: 110%; left: 0; width: 100%; background: var(--ivory); 
            padding: 1.5rem; text-align: center; border-radius: 12px;
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            opacity: 0; visibility: hidden; transform: translateY(-10px);
            transition: all 0.3s ease; border: 1px solid var(--border);
        }
        nav ul.active { opacity: 1; visibility: visible; transform: translateY(0); }
        nav ul li { width: 100%; }
        nav ul li a.btn { display: block; padding: 0.75rem; width: 100%; }
        
        /* Hero Mobile */
        .hero-content { padding: 1.5rem; width: 90%; }
        .hero-actions { flex-direction: column; gap: 1rem; width: 100%; }
        .hero-actions .btn { width: 100%; }
        
        /* Grids & Layouts Mobile */
        .responsive-grid { grid-template-columns: 1fr; gap: 2.5rem; }
        .project-grid { grid-template-columns: 1fr; }
        .services-grid { grid-template-columns: 1fr; }
        
        /* Typography Adjustments Mobile */
        .section-title { font-size: clamp(2rem, 8vw, 2.5rem); }
        .process-step { flex-direction: column; gap: 0.5rem; }
        
        /* Forms Mobile */
        .form-row { flex-direction: column; gap: 0; }
        .glass-dark { padding: 1.5rem !important; }
    }
`;

const generateHTML = (projects = [], projectDetail = null) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectDetail ? `${projectDetail.title} | ` : ""}ATELIER 27 — Architecture & Design</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <style>${getPublicStyles()}</style>
</head>
<body>

    <header id="header">
        <div class="container">
            <div class="nav-container glass">
                <a href="/" class="logo">ATELIER 27.</a>
                <button class="mobile-menu-btn" id="mobileMenuBtn">☰</button>
                <nav>
                    <ul id="nav-links">
                        <li><a href="/#studio">Studio</a></li>
                        <li><a href="/#projects">Projects</a></li>
                        <li><a href="/#services">Services</a></li>
                        <li><a href="/#contact">Contact</a></li>
                        <li><a href="/#contact" class="btn btn-primary" style="padding: 0.5rem 1rem;">Start a Project</a></li>
                    </ul>
                </nav>
            </div>
        </div>
    </header>

    ${projectDetail ? renderProjectDetail(projectDetail) : renderHomePage(projects)}

    <footer>
        <div class="container">
            <h2 class="serif" style="font-size: 2.5rem; margin-bottom: 1.5rem;">ATELIER 27.</h2>
            <p>Civil Lines, Raipur, Chhattisgarh (Fictional Location)</p>
            <p>hello@atelier27.example | +91 90000 12345</p>
            <div class="demo-notice">
                <p>DEMO PROJECT — Fictional architecture firm created for demonstration purposes.</p>
                <p>Not a real business. <a href="/admin" style="color:var(--terra);">Admin Login</a></p>
            </div>
        </div>
    </footer>

    <script>
        // Mobile Navigation Toggle
        const navLinks = document.getElementById('nav-links');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        mobileMenuBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
        document.querySelectorAll('#nav-links a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });

        // Scroll reveal animation
        const reveals = document.querySelectorAll('.reveal');
        const revealOnScroll = () => {
            const windowHeight = window.innerHeight;
            reveals.forEach(el => {
                const elementTop = el.getBoundingClientRect().top;
                if (elementTop < windowHeight - 100) el.classList.add('active');
            });
        };
        window.addEventListener('scroll', revealOnScroll);
        revealOnScroll(); // init

        // Header scroll effect
        window.addEventListener('scroll', () => {
            const header = document.getElementById('header');
            if(window.scrollY > 50) header.style.transform = 'translateY(-10px)';
            else header.style.transform = 'translateY(0)';
        });

        // Form handling
        const inquiryForm = document.getElementById('inquiryForm');
        if(inquiryForm) {
            inquiryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = inquiryForm.querySelector('button[type="submit"]');
                const origText = btn.innerText;
                btn.innerText = 'Submitting...';
                btn.disabled = true;

                const formData = new FormData(inquiryForm);
                const data = Object.fromEntries(formData.entries());
                data.consent = formData.has('consent');

                try {
                    const res = await fetch('/api/inquiry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const result = await res.json();
                    if(result.success) {
                        document.getElementById('formContainer').innerHTML = \`
                            <div class="text-center" style="padding: 3rem 1rem;">
                                <h3 class="serif" style="font-size: 2rem; margin-bottom: 1rem;">Request Received</h3>
                                <p>Thank you for reaching out. Your reference number is <strong>\${result.reference}</strong>.</p>
                                <p style="margin-top: 1rem; opacity: 0.8; font-size: 0.9rem;">(This is a demo, no actual emails are sent.)</p>
                            </div>
                        \`;
                    } else {
                        alert('Error: ' + result.error);
                        btn.innerText = origText;
                        btn.disabled = false;
                    }
                } catch(err) {
                    alert('Submission failed.');
                    btn.innerText = origText;
                    btn.disabled = false;
                }
            });
        }

        // Project Filtering
        const filterBtns = document.querySelectorAll('.filter-btn');
        const projectCards = document.querySelectorAll('.project-item');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.dataset.filter;
                projectCards.forEach(card => {
                    if(filter === 'all' || card.dataset.category.toLowerCase() === filter.toLowerCase()) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    </script>
</body>
</html>
`;

const renderHomePage = (projects) => `
    <main>
        <!-- HERO -->
        <section class="hero">
            <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80" alt="Contemporary Villa" class="hero-img" loading="lazy">
            <div class="hero-overlay"></div>
            <div class="hero-content glass reveal">
                <span class="section-subtitle" style="color: var(--forest);">ATELIER 27</span>
                <h1>Architecture for the way you want to live.</h1>
                <p>Thoughtful spaces. Honest materials. Timeless design.</p>
                <div class="hero-actions">
                    <a href="#projects" class="btn btn-primary">Explore Our Work</a>
                    <a href="#contact" class="btn btn-glass">Discuss Your Project</a>
                </div>
            </div>
        </section>

        <!-- STUDIO -->
        <section id="studio" class="py-20 container reveal">
            <div class="responsive-grid align-center">
                <div>
                    <span class="section-subtitle">The Studio</span>
                    <h2 class="section-title">Rooted in context, driven by purpose.</h2>
                    <p style="margin-bottom: 1.5rem; line-height: 1.8;">At Atelier 27, we believe architecture is more than just built form. It is the careful orchestration of light, material, and space to elevate the human experience. Our studio focuses on sustainable practices, integrating nature with structured environments to create spaces that speak and architecture that lasts.</p>
                    <p style="font-size: 0.85rem; opacity: 0.7;">*Fictional philosophy for demonstration purposes.</p>
                </div>
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80" alt="Studio Interior" style="width: 100%; border-radius: 12px;" loading="lazy">
            </div>
        </section>

        <!-- PROJECTS -->
        <section id="projects" class="py-20 container reveal">
            <div class="text-center" style="margin-bottom: 3rem;">
                <span class="section-subtitle">Selected Works</span>
                <h2 class="section-title">Our Portfolio</h2>
            </div>
            <div class="filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="residential">Residential</button>
                <button class="filter-btn" data-filter="commercial">Commercial</button>
                <button class="filter-btn" data-filter="interiors">Interiors</button>
                <button class="filter-btn" data-filter="hospitality">Hospitality</button>
            </div>
            <div class="project-grid">
                ${projects
                  .map(
                    (p) => `
                    <a href="/project/${p.slug}" class="project-card project-item" data-category="${p.category}">
                        <div class="project-img-wrapper">
                            <img src="${p.image}" alt="${p.title}" loading="lazy">
                        </div>
                        <div class="project-info glass">
                            <h3>${p.title}</h3>
                            <p>${p.category} &mdash; ${p.location}</p>
                        </div>
                    </a>
                `,
                  )
                  .join("")}
            </div>
        </section>

        <!-- SERVICES -->
        <section id="services" class="py-20" style="background: url('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&q=80') center/cover fixed; position: relative;">
            <div style="position: absolute; inset: 0; background: rgba(23, 61, 53, 0.9);"></div>
            <div class="container reveal" style="position: relative; z-index: 1;">
                <div class="text-center" style="margin-bottom: 4rem;">
                    <span class="section-subtitle" style="color: var(--sage);">Expertise</span>
                    <h2 class="section-title" style="color: var(--ivory);">Our Services</h2>
                </div>
                <div class="services-grid">
                    <div class="service-card glass-dark">
                        <h3>Architectural Design</h3>
                        <p>Comprehensive design solutions from concept to execution, focusing on site context and spatial flow.</p>
                    </div>
                    <div class="service-card glass-dark">
                        <h3>Interior Design</h3>
                        <p>Curated interior spaces that reflect the inhabitants' identity through bespoke detailing and materiality.</p>
                    </div>
                    <div class="service-card glass-dark">
                        <h3>Landscape Design</h3>
                        <p>Blurring the boundaries between built form and nature with sustainable landscape interventions.</p>
                    </div>
                    <div class="service-card glass-dark">
                        <h3>Project Consultation</h3>
                        <p>Expert guidance on feasibility, master planning, and sustainable building practices.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- PROCESS -->
        <section class="py-20 container reveal">
            <div class="text-center" style="margin-bottom: 4rem;">
                <span class="section-subtitle">Methodology</span>
                <h2 class="section-title">Design Process</h2>
            </div>
            <div class="process-timeline">
                <div class="process-step">
                    <div class="step-number">01</div>
                    <div class="step-content">
                        <h3>Discover</h3>
                        <p>We begin by understanding the site, the client's vision, and the functional requirements. This sets the foundation for a contextual approach.</p>
                    </div>
                </div>
                <div class="process-step">
                    <div class="step-number">02</div>
                    <div class="step-content">
                        <h3>Concept</h3>
                        <p>Translating ideas into spatial diagrams, massing models, and preliminary sketches to establish the architectural narrative.</p>
                    </div>
                </div>
                <div class="process-step">
                    <div class="step-number">03</div>
                    <div class="step-content">
                        <h3>Develop</h3>
                        <p>Refining the design with detailed technical drawings, material selection, and structural coordination.</p>
                    </div>
                </div>
                <div class="process-step">
                    <div class="step-number">04</div>
                    <div class="step-content">
                        <h3>Deliver</h3>
                        <p>Overseeing the execution phase to ensure the physical realization aligns perfectly with the design intent.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- TEAM -->
        <section class="py-20" style="background-color: var(--sand);">
            <div class="container reveal">
                <div class="text-center" style="margin-bottom: 4rem;">
                    <span class="section-subtitle">Leadership</span>
                    <h2 class="section-title">The People</h2>
                </div>
                <div class="team-grid">
                    <div class="team-member glass" style="padding: 1.5rem;">
                        <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80" alt="Ar. Aarav Mehta">
                        <h3 class="serif" style="font-size: 1.5rem; color: var(--forest);">Ar. Aarav Mehta</h3>
                        <p class="section-subtitle" style="margin: 0.5rem 0;">Principal Architect (Demo)</p>
                        <p style="font-size: 0.9rem;">With over a decade of experience, Aarav specializes in tropical modernism and contextual residential design.</p>
                    </div>
                    <div class="team-member glass" style="padding: 1.5rem;">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80" alt="Ananya Kapoor">
                        <h3 class="serif" style="font-size: 1.5rem; color: var(--forest);">Ananya Kapoor</h3>
                        <p class="section-subtitle" style="margin: 0.5rem 0;">Senior Interior Designer (Demo)</p>
                        <p style="font-size: 0.9rem;">Ananya brings spaces to life with her keen eye for materiality, bespoke furniture, and lighting design.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- CONTACT FORM -->
        <section id="contact" class="py-20 container reveal">
            <div class="responsive-grid">
                <div>
                    <span class="section-subtitle">Inquire</span>
                    <h2 class="section-title">Start a Project</h2>
                    <p style="margin-bottom: 2rem;">We are always looking for exciting new challenges. Fill out the form to request a consultation, and our team will get back to you shortly.</p>
                    <p><strong>Email:</strong> hello@atelier27.example</p>
                    <p><strong>Phone:</strong> +91 90000 12345</p>
                    <p style="margin-top: 2rem; font-size: 0.8rem; color: var(--terra);">*Note: This is a functional demo form. Submissions are saved to the demo database but no emails are sent.</p>
                </div>
                <div id="formContainer" class="glass-dark" style="padding: 2.5rem; border-radius: 12px;">
                    <form id="inquiryForm">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" name="name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Email Address *</label>
                            <input type="email" name="email" class="form-control" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Phone *</label>
                                <input type="tel" name="phone" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>City</label>
                                <input type="text" name="city" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Project Type</label>
                            <select name="projectType" class="form-control">
                                <option value="Residential Architecture">Residential Architecture</option>
                                <option value="Interior Design">Interior Design</option>
                                <option value="Commercial">Commercial</option>
                                <option value="Hospitality">Hospitality</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Brief Description</label>
                            <textarea name="description" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group" style="display: flex; gap: 0.5rem; align-items: start;">
                            <input type="checkbox" name="consent" id="consent" required style="margin-top: 0.2rem;">
                            <label for="consent" style="text-transform: none; letter-spacing: normal; font-size: 0.8rem; opacity: 0.8;">I consent to the collection of my details for communication regarding this inquiry. (Demo consent)</label>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; border: 1px solid var(--sage);">Submit Inquiry</button>
                    </form>
                </div>
            </div>
        </section>
    </main>
`;

const renderProjectDetail = (project) => `
    <main style="padding-top: 100px;">
        <div class="container py-20">
            <a href="/#projects" style="color: var(--terra); text-decoration: none; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">&larr; Back to Portfolio</a>
            <h1 class="section-title" style="margin-top: 2rem;">${project.title}</h1>
            <p class="section-subtitle">${project.category} &mdash; ${project.location}</p>
            
            <img src="${project.image}" alt="${project.title}" style="width: 100%; max-height: 60vh; object-fit: cover; border-radius: 12px; margin: 2rem 0;">
            
            <div class="responsive-grid" style="margin-top: 3rem;">
                <div>
                    <h3 class="serif" style="font-size: 1.8rem; color: var(--forest); margin-bottom: 1rem;">The Challenge</h3>
                    <p style="line-height: 1.8;">${project.description}</p>
                </div>
                <div>
                    <h3 class="serif" style="font-size: 1.8rem; color: var(--forest); margin-bottom: 1rem;">The Concept</h3>
                    <p style="line-height: 1.8;">${project.concept}</p>
                </div>
            </div>
            
            <div class="text-center py-20">
                <p style="margin-bottom: 1.5rem;">Inspired by this approach?</p>
                <a href="/#contact" class="btn btn-primary">Start a Similar Project</a>
            </div>
        </div>
    </main>
`;

// ==========================================
// STATIC & VIEW ROUTES
// ==========================================

// Homepage
app.get("/", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find({ status: "published" })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(generateHTML(projects, null));
  } catch (err) {
    res.status(500).send("Error loading page.");
  }
});

// Project Details
app.get("/project/:slug", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const project = await db
      .collection("projects")
      .findOne({ slug: req.params.slug });
    if (!project) return res.status(404).send("Project not found");
    res.send(generateHTML([], project));
  } catch (err) {
    res.status(500).send("Error loading project.");
  }
});

// Admin View Shell
app.get("/admin", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ATELIER 27 - Admin Dashboard</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
            <script src="/admin.js" defer></script>
        </head>
        <body>
            <div id="admin-root">Loading...</div>
        </body>
        </html>
    `);
});

// Admin JS Delivery
app.get("/admin.js", (req, res) => {
  const filePath = path.join(process.cwd(), "admin.js");
  res.setHeader("Content-Type", "application/javascript");
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('console.error("admin.js not found");');
  }
});

// Start Server for Local Dev
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`),
  );
}

module.exports = app;
