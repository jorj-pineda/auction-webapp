const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const app = express();
const PORT = 3000;

// *** IMPORTANT: PASTE YOUR NGROK URL HERE ***
// Example: const BASE_URL = 'https://a1b2-c3d4.ngrok-free.app';
// If you restart Ngrok, you must update this link!
const BASE_URL = 'https://fiercest-irene-lousily.ngrok-free.dev/'; 

// Setup Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// 1. Database Setup
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

    // Smart Seeding
    db.get("SELECT count(*) as count FROM items", (err, row) => {
        if (err) return console.error(err);
        if (row.count === 0) {
            console.log("Seeding initial art items...");
            const stmt = db.prepare("INSERT INTO items (name, description, image_url, current_bid) VALUES (?, ?, ?, ?)");
            stmt.run('Community Spirit', 'Acrylic on Canvas by Student A', 'https://placehold.co/600x400', 50.00);
            stmt.run('Senegal Sunrise', 'Oil on Canvas by Student B', 'https://placehold.co/600x400', 75.00);
            stmt.finalize();
        }
    });
});

// 2. Email Configuration (Your Bot)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rooservicestation@gmail.com', 
        pass: 'bqqx oobx yzjy mpvd' // <--- I kept your password here for you
    }
});

// 3. Routes

app.get('/', (req, res) => {
    db.all("SELECT * FROM items", [], (err, rows) => {
        if (err) return console.error(err.message);
        res.render('index', { items: rows });
    });
});

app.get('/item/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
        if (err) return console.error(err.message);
        if (!row) return res.send("Item not found. <a href='/'>Go Back</a>");
        res.render('item', { item: row, message: null });
    });
});

// THE UPDATED BID LOGIC
app.post('/bid/:id', (req, res) => {
    const id = req.params.id;
    const newBid = parseFloat(req.body.amount);
    const email = req.body.email;
    const name = req.body.name;

    db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
        if (err) return console.error(err);

        if (newBid > item.current_bid) {
            
            // Use the Ngrok URL for the link
            const itemLink = `${BASE_URL}/item/${id}`;
            const subjectLine = `Auction Status: ${item.name}`; // Same subject = Threaded emails

            // A. SEND CONFIRMATION TO CURRENT BIDDER (You!)
            const confirmOptions = {
                from: 'rooservicestation@gmail.com',
                to: email,
                subject: subjectLine,
                html: `
                    <h3>Bid Confirmed!</h3>
                    <p>Hello ${name},</p>
                    <p>You have successfully placed a bid of <strong>$${newBid}</strong> on "${item.name}".</p>
                    <p>We will notify you in this thread if you get outbid.</p>
                    <br>
                    <a href="${itemLink}">View Item</a>
                `
            };
            transporter.sendMail(confirmOptions, (err) => {
                if(err) console.log("Error sending confirmation:", err);
                else console.log("Confirmation email sent to " + email);
            });

            // B. NOTIFY PREVIOUS BIDDER (The Outbid Person)
            if (item.bidder_email && item.bidder_email !== email) {
                console.log(`Sending Out-bid email to ${item.bidder_email}...`);
                
                const outbidOptions = {
                    from: 'rooservicestation@gmail.com',
                    to: item.bidder_email,
                    subject: subjectLine, // Same subject threading
                    html: `
                        <h3 style="color:red;">You've been outbid!</h3>
                        <p>Hello ${item.bidder_name},</p>
                        <p>Someone just bid <strong>$${newBid}</strong> on "${item.name}".</p>
                        <p>Don't lose this piece! Click below to bid again.</p>
                        <br>
                        <a href="${itemLink}" style="background-color:#d9534f; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Bid Higher Now</a>
                    `
                };
                
                transporter.sendMail(outbidOptions, (err) => {
                    if (err) console.log('Error sending outbid email:', err);
                    else console.log('Outbid notice sent to ' + item.bidder_email);
                });
            }

            // C. UPDATE DATABASE
            db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                [newBid, email, name, id], 
                (err) => {
                    if (err) return console.error(err.message);
                    res.render('item', { item: { ...item, current_bid: newBid, bidder_name: name }, message: "Bid placed successfully! Check your email." });
                }
            );

        } else {
            res.render('item', { item: item, message: `Bid must be higher than current amount ($${item.current_bid}).` });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running. Ensure Ngrok is pointing to port ${PORT}`);
});