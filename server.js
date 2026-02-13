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

// 1. Database Setup (SQLite)
const db = new sqlite3.Database('./auction.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the auction database.');
});

// Create Table
db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    image_url TEXT,
    current_bid REAL DEFAULT 0,
    bidder_email TEXT,
    bidder_name TEXT
)`);

// Seed Data (Run this once, then comment out if you want)
// db.run(`INSERT INTO items (name, description, image_url, current_bid) VALUES 
//     ('Community Spirit', 'Acrylic on Canvas by Student A', 'https://placehold.co/600x400', 50.00)`);


// 2. Email Configuration (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'outlook', // Or 'outlook', 'yahoo', etc.
    auth: {
        user: 'servicestation@austincolelge.edu', // REPLACE THIS
        pass: 'Service26!' // REPLACE THIS (Not your normal login password)
    }
});

// 3. Routes

// Home Page - List all items
app.get('/', (req, res) => {
    db.all("SELECT * FROM items", [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { items: rows });
    });
});

// Item Detail Page - Where they bid
app.get('/item/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
        if (err) return console.error(err.message);
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
        if (newBid > item.current_bid) {
            
            // A. NOTIFY PREVIOUS BIDDER (The "Out-bid" Feature)
            if (item.bidder_email) {
                const mailOptions = {
                    from: 'servicestation@austincollege.edu',
                    to: item.bidder_email,
                    subject: `You've been outbid on ${item.name}!`,
                    text: `Hello ${item.bidder_name},\n\nSomeone just bid $${newBid} on "${item.name}".\n\nGo to the auction site to reclaim your spot!`
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log('Error sending email:', error);
                    else console.log('Outbid notification sent: ' + info.response);
                });
            }

            // B. UPDATE DATABASE
            db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                [newBid, email, name, id], 
                (err) => {
                    if (err) return console.error(err.message);
                    
                    // Success! Reload page with message
                    res.render('item', { item: { ...item, current_bid: newBid, bidder_name: name }, message: "Bid placed successfully!" });
                }
            );

        } else {
            res.render('item', { item: item, message: "Bid must be higher than current amount." });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});