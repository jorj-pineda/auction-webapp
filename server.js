const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;

// Setup Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// 1. Database Setup (Wrapped in serialize to prevent crashes)
const db = new sqlite3.Database('./auction.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the auction database.');
});

db.serialize(() => {
    // A. Create the Table
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        image_url TEXT,
        current_bid REAL DEFAULT 0,
        bidder_email TEXT,
        bidder_name TEXT
    )`);

    // B. "Smart" Seed Data
    // Only insert art if the table is empty!
    db.get("SELECT count(*) as count FROM items", (err, row) => {
        if (err) return console.error(err);
        
        if (row.count === 0) {
            console.log("Database is empty. Seeding initial art items...");
            const stmt = db.prepare("INSERT INTO items (name, description, image_url, current_bid) VALUES (?, ?, ?, ?)");
            stmt.run('Community Spirit', 'Acrylic on Canvas by Student A', 'https://placehold.co/600x400', 50.00);
            stmt.run('Senegal Sunrise', 'Oil on Canvas by Student B', 'https://placehold.co/600x400', 75.00);
            stmt.finalize();
        } else {
            console.log("Database already has items. Skipping seed.");
        }
    });
});

// 2. Email Configuration (Corrected for Austin College / Office 365)
const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", 
    port: 587,
    secure: false, // STARTTLS
    auth: {
        user: 'servicestation@austincollege.edu', // Typo fixed
        pass: 'Service26!' 
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// 3. Routes

// Home Page
app.get('/', (req, res) => {
    db.all("SELECT * FROM items", [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { items: rows });
    });
});

// Item Detail Page
app.get('/item/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
        if (err) return console.error(err.message);
        if (!row) return res.send("Item not found. <a href='/'>Go Back</a>");
        res.render('item', { item: row, message: null });
    });
});

// Handle the Bid
app.post('/bid/:id', (req, res) => {
    const id = req.params.id;
    const newBid = parseFloat(req.body.amount);
    const email = req.body.email;
    const name = req.body.name;

    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) return console.error(err);

        if (newBid > item.current_bid) {
            
            // A. NOTIFY PREVIOUS BIDDER (Smart Check)
            // Only send email if there WAS a previous bidder AND it's a different person
            if (item.bidder_email && item.bidder_email !== email) {
                console.log(`Sending Out-bid email to ${item.bidder_email}...`);
                
                const mailOptions = {
                    from: 'servicestation@austincollege.edu',
                    to: item.bidder_email,
                    subject: `You've been outbid on ${item.name}!`,
                    text: `Hello ${item.bidder_name},\n\nSomeone just bid $${newBid} on "${item.name}".\n\nGo to the auction site to reclaim your spot!`
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log('Error sending email:', error);
                    else console.log('Email sent: ' + info.response);
                });
            }

            // B. UPDATE DATABASE
            db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                [newBid, email, name, id], 
                (err) => {
                    if (err) return console.error(err.message);
                    res.render('item', { item: { ...item, current_bid: newBid, bidder_name: name }, message: "Bid placed successfully!" });
                }
            );

        } else {
            res.render('item', { item: item, message: `Bid must be higher than current amount ($${item.current_bid}).` });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});