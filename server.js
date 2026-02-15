const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = 3000;

// *** CONFIGURATION ***
const BASE_URL = 'https://fiercest-irene-lousily.ngrok-free.dev'; // <--- PASTE NGROK URL HERE
const ADMIN_PASSWORD = 'Service25!'; // <--- SET YOUR ADMIN PASSWORD HERE

// 1. Setup Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// 2. Image Upload Setup (Multer)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/') // Images save here
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Unique filename
    }
});
const upload = multer({ storage: storage });

// 3. Database Setup
const db = new sqlite3.Database('./auction.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the auction database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        image_url TEXT,
        current_bid REAL DEFAULT 0,
        bidder_email TEXT,
        bidder_name TEXT
    )`);
});

// 4. Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rooservicestation@gmail.com',
        pass: 'bqqx oobx yzjy mpvd' // <--- YOUR APP PASSWORD
    }
});

// 5. Routes

// --- PUBLIC ROUTES ---
app.get('/', (req, res) => {
    db.all("SELECT * FROM items", [], (err, rows) => {
        res.render('index', { items: rows });
    });
});

app.get('/item/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
        if (!row) return res.send("Item not found.");
        res.render('item', { item: row, message: null });
    });
});

app.post('/bid/:id', (req, res) => {
    const id = req.params.id;
    const newBid = parseFloat(req.body.amount);
    const email = req.body.email;
    const name = req.body.name;

    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (newBid > item.current_bid) {
            const itemLink = `${BASE_URL}/item/${id}`;
            const subjectLine = `Auction Status: ${item.name}`;

            // Notify Winner
            transporter.sendMail({
                from: 'rooservicestation@gmail.com',
                to: email,
                subject: subjectLine,
                html: `<h3>Bid Confirmed!</h3><p>You bid <strong>$${newBid}</strong> on "${item.name}".</p><a href="${itemLink}">View Item</a>`
            });

            // Notify Loser
            if (item.bidder_email && item.bidder_email !== email) {
                transporter.sendMail({
                    from: 'rooservicestation@gmail.com',
                    to: item.bidder_email,
                    subject: subjectLine,
                    html: `<h3 style="color:red;">Outbid!</h3><p>Someone bid <strong>$${newBid}</strong> on "${item.name}".</p><a href="${itemLink}">Bid Again</a>`
                });
            }

            db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                [newBid, email, name, id], 
                (err) => res.render('item', { item: { ...item, current_bid: newBid, bidder_name: name }, message: "Bid placed successfully!" })
            );
        } else {
            res.render('item', { item: item, message: `Bid must be higher than current amount ($${item.current_bid}).` });
        }
    });
});

// --- ADMIN ROUTES ---

// Login Page
app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

// Login Handler
app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: "Incorrect Password" });
    }
});

// Dashboard (Protected)
app.get('/admin', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');

    db.all("SELECT * FROM items", [], (err, rows) => {
        // We pass the BASE_URL so the view can generate QR links
        res.render('admin', { items: rows, baseUrl: BASE_URL });
    });
});

// Add Item Handler (With Image Upload)
app.post('/admin/add', upload.single('image'), (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');

    const name = req.body.name;
    const description = req.body.description;
    const startPrice = req.body.startPrice;
    // If image uploaded, use it. If not, use placeholder.
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://placehold.co/600x400';

    const stmt = db.prepare("INSERT INTO items (name, description, image_url, current_bid) VALUES (?, ?, ?, ?)");
    stmt.run(name, description, imageUrl, startPrice, (err) => {
        if (err) console.log(err);
        res.redirect('/admin');
    });
    stmt.finalize();
});

// Delete Item Handler
app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.run("DELETE FROM items WHERE id = ?", req.params.id, () => res.redirect('/admin'));
});

app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
});