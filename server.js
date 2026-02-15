const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// *** CONFIGURATION ***
const BASE_URL = 'https://fiercest-irene-lousily.ngrok-free.dev'; 
const ADMIN_PASSWORD = 'Service25!'; 

// 1. Setup Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

const uploadDir = 'public/uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Image Upload Setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir) },
    filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)) }
});
const upload = multer({ storage: storage });

// 3. Database Setup
const db = new sqlite3.Database('./auction.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    console.log('Connected to the auction database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        image_url TEXT,
        start_price REAL DEFAULT 0,
        current_bid REAL DEFAULT 0,
        bidder_email TEXT,
        bidder_name TEXT
    )`);

    // Safely upgrade existing database
    db.run(`ALTER TABLE items ADD COLUMN start_price REAL DEFAULT 0`, (err) => {
        if (!err) db.run(`UPDATE items SET start_price = current_bid WHERE start_price = 0`);
    });

    db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, is_paused INTEGER DEFAULT 0, timer_ends_at INTEGER DEFAULT 0)`);
    
    // Safely add timer column if it doesn't exist
    db.run(`ALTER TABLE settings ADD COLUMN timer_ends_at INTEGER DEFAULT 0`, (err) => {});

    db.get("SELECT count(*) as count FROM settings", (err, row) => {
        if (!err && row && row.count === 0) {
            db.run("INSERT INTO settings (is_paused, timer_ends_at) VALUES (0, 0)");
        }
    });
});

// 4. Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rooservicestation@gmail.com',
        pass: 'bqqx oobx yzjy mpvd' 
    }
});

// 5. Routes

app.get('/', (req, res) => {
    db.get("SELECT timer_ends_at FROM settings", (err, setting) => {
        db.all("SELECT * FROM items", [], (err, rows) => {
            res.render('index', { 
                items: rows || [], 
                timerEndsAt: setting ? setting.timer_ends_at : 0 
            });
        });
    });
});

app.get('/item/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT is_paused, timer_ends_at FROM settings", (err, setting) => {
        db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
            if (!row) return res.send("Item not found.");
            res.render('item', { 
                item: row, 
                message: null, 
                isPaused: setting ? setting.is_paused : 0,
                timerEndsAt: setting ? setting.timer_ends_at : 0
            });
        });
    });
});

app.post('/bid/:id', (req, res) => {
    db.get("SELECT is_paused, timer_ends_at FROM settings", (err, setting) => {
        if (setting && setting.is_paused) return res.render('paused');
    
        const id = req.params.id;
        const newBid = parseFloat(req.body.amount);
        const email = req.body.email;
        const name = req.body.name;

        db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
            if (!item) return res.send("Item not found.");

            let minInc = 0.25;
            let maxInc = Infinity;

            if (item.start_price <= 0.25) {
                minInc = 0.25; maxInc = 1.00;
            } else if (item.start_price <= 1.00) {
                minInc = 0.50; maxInc = 5.00;
            } else {
                minInc = 1.00; maxInc = Infinity;
            }

            const isFirstBid = !item.bidder_name;
            const minValidBid = isFirstBid ? item.start_price : item.current_bid + minInc;
            const maxValidBid = isFirstBid ? item.start_price + maxInc : item.current_bid + maxInc;

            if (newBid < minValidBid) {
                return res.render('item', { item: item, message: `Bid must be at least $${minValidBid.toFixed(2)}.`, isPaused: setting ? setting.is_paused : 0, timerEndsAt: setting ? setting.timer_ends_at : 0 });
            }
            if (maxInc !== Infinity && newBid > maxValidBid) {
                return res.render('item', { item: item, message: `To keep things fair, the maximum bid increase is $${maxInc.toFixed(2)}. Please bid $${maxValidBid.toFixed(2)} or less.`, isPaused: setting ? setting.is_paused : 0, timerEndsAt: setting ? setting.timer_ends_at : 0 });
            }

            const itemLink = `${BASE_URL}/item/${id}`;
            const subjectLine = `Auction Status: ${item.name}`;

            transporter.sendMail({
                from: 'rooservicestation@gmail.com',
                to: email,
                subject: subjectLine,
                html: `<h3>Bid Confirmed!</h3><p>You bid <strong>$${newBid.toFixed(2)}</strong> on "${item.name}".</p><a href="${itemLink}">View Item</a>`
            }).catch(e => console.error(e));

            if (item.bidder_email && item.bidder_email !== email) {
                transporter.sendMail({
                    from: 'rooservicestation@gmail.com',
                    to: item.bidder_email,
                    subject: subjectLine,
                    html: `<h3 style="color:red;">Outbid!</h3><p>Someone bid <strong>$${newBid.toFixed(2)}</strong> on "${item.name}".</p><a href="${itemLink}">Bid Again</a>`
                }).catch(e => console.error(e));
            }

            db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                [newBid, email, name, id], 
                (err) => {
                    res.render('item', { 
                        item: { ...item, current_bid: newBid, bidder_name: name }, 
                        message: "Bid placed successfully!",
                        isPaused: setting ? setting.is_paused : 0,
                        timerEndsAt: setting ? setting.timer_ends_at : 0
                    });
                }
            );
        });
    });
});

// --- ADMIN ROUTES ---

app.get('/admin/login', (req, res) => res.render('login', { error: null }));

app.post('/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: "Incorrect Password" });
    }
});

app.get('/admin', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.get("SELECT is_paused, timer_ends_at FROM settings", (err, setting) => {
        db.all("SELECT * FROM items", [], (err, rows) => {
            res.render('admin', { 
                items: rows || [], 
                baseUrl: BASE_URL, 
                isPaused: setting ? setting.is_paused : 0,
                timerEndsAt: setting ? setting.timer_ends_at : 0 
            });
        });
    });
});

// Timer Set Route
app.post('/admin/timer', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    const minutes = parseFloat(req.body.minutes) || 0;
    const endsAt = minutes > 0 ? Date.now() + (minutes * 60000) : 0;
    
    db.run("UPDATE settings SET timer_ends_at = ?", [endsAt], () => res.redirect('/admin'));
});

app.post('/admin/add', upload.single('image'), (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');

    const name = req.body.name;
    const description = req.body.description;
    const startPrice = parseFloat(req.body.startPrice) || 0; 
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://placehold.co/600x400';

    db.run("INSERT INTO items (name, description, image_url, start_price, current_bid) VALUES (?, ?, ?, ?, ?)",
        [name, description, imageUrl, startPrice, startPrice],
        (err) => res.redirect('/admin')
    );
});

app.post('/admin/pause', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.run("UPDATE settings SET is_paused = 1", () => res.redirect('/admin'));
});

app.post('/admin/resume', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.run("UPDATE settings SET is_paused = 0", () => res.redirect('/admin'));
});

app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.run("DELETE FROM items WHERE id = ?", req.params.id, () => res.redirect('/admin'));
});

app.listen(PORT, () => console.log(`Server running at ${BASE_URL}`));