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
const BASE_URL = 'https://tostan.ngrok.io'; 
const ADMIN_PASSWORD = 'Service25!'; 
// NEW: Email restriction domain
const ALLOWED_DOMAIN = '@austincollege.edu';

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
    // Main Items Table
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        image_url TEXT,
        start_price REAL DEFAULT 0,
        current_bid REAL DEFAULT 0,
        bidder_email TEXT,
        bidder_name TEXT,
        placement INTEGER DEFAULT 0,
        bid_type INTEGER DEFAULT 1,
        group_id INTEGER DEFAULT 0
    )`);

    // Bid History Table (For Runner-Ups & Stats)
    db.run(`CREATE TABLE IF NOT EXISTS bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        amount REAL,
        email TEXT,
        name TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const columns = ['start_price', 'placement', 'bid_type', 'group_id'];
    columns.forEach(col => {
        db.run(`ALTER TABLE items ADD COLUMN ${col} INTEGER DEFAULT 0`, (err) => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, is_paused INTEGER DEFAULT 0, timer_ends_at INTEGER DEFAULT 0)`);
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
    pool: true, 
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 1, 
    auth: {
        user: 'rooservicestation@gmail.com',
        pass: 'bqqx oobx yzjy mpvd' 
    }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 5. Routes

app.get('/', (req, res) => {
    db.get("SELECT timer_ends_at FROM settings", (err, setting) => {
        db.all("SELECT * FROM items ORDER BY placement ASC, id ASC", [], (err, rows) => {
            res.render('index', { items: rows || [], timerEndsAt: setting ? setting.timer_ends_at : 0 });
        });
    });
});

app.get('/table/:id', (req, res) => {
    const groupId = req.params.id;
    db.get("SELECT timer_ends_at FROM settings", (err, setting) => {
        db.all("SELECT * FROM items WHERE group_id = ? ORDER BY placement ASC, id ASC", [groupId], (err, rows) => {
            res.render('group', { 
                items: rows || [], 
                groupId: groupId,
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
            res.render('item', { item: row, message: null, isPaused: setting ? setting.is_paused : 0, timerEndsAt: setting ? setting.timer_ends_at : 0 });
        });
    });
});

app.post('/bid/:id', (req, res) => {
    db.get("SELECT is_paused, timer_ends_at FROM settings", (err, setting) => {
        if (setting && setting.is_paused) return res.render('paused');
    
        const id = req.params.id;
        const newBid = parseFloat(req.body.amount);
        const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
        const name = req.body.name;

        db.get("SELECT * FROM items WHERE id = ?", [id], (err, item) => {
            if (!item) return res.send("Item not found.");

            // --- NEW: Email Validation ---
            if (!email.endsWith(ALLOWED_DOMAIN)) {
                return res.render('item', { 
                    item: item, 
                    message: `Error: You must use an ${ALLOWED_DOMAIN} email address to bid.`, 
                    isPaused: setting ? setting.is_paused : 0, 
                    timerEndsAt: setting ? setting.timer_ends_at : 0 
                });
            }

            // Tier Logic
            let minInc, maxInc;
            if (item.bid_type === 1) { minInc = 0.25; maxInc = 1.00; }
            else if (item.bid_type === 2) { minInc = 0.50; maxInc = 5.00; }
            else if (item.bid_type === 4) { minInc = 1.00; maxInc = 25.00; }
            else { minInc = 1.00; maxInc = 10.00; }

            const isFirstBid = !item.bidder_name;
            const minValidBid = isFirstBid ? item.start_price : item.current_bid + minInc;
            const maxValidBid = isFirstBid ? item.start_price + maxInc : item.current_bid + maxInc;

            if (newBid < minValidBid) {
                return res.render('item', { item: item, message: `Bid must be at least $${minValidBid.toFixed(2)}.`, isPaused: setting ? setting.is_paused : 0, timerEndsAt: setting ? setting.timer_ends_at : 0 });
            }
            if (newBid > maxValidBid) {
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

            db.serialize(() => {
                db.run(`UPDATE items SET current_bid = ?, bidder_email = ?, bidder_name = ? WHERE id = ?`, 
                    [newBid, email, name, id]
                );
                db.run(`INSERT INTO bids (item_id, amount, email, name) VALUES (?, ?, ?, ?)`, 
                    [id, newBid, email, name]
                );

                res.render('item', { 
                    item: { ...item, current_bid: newBid, bidder_name: name }, 
                    message: "Bid placed successfully!",
                    isPaused: setting ? setting.is_paused : 0,
                    timerEndsAt: setting ? setting.timer_ends_at : 0
                });
            });
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

    db.get("SELECT * FROM settings", (err, row) => {
        if (err) { console.error(err); return res.send("Error loading settings"); }
        const settings = row || { is_paused: 0, timer_ends_at: 0 };
        
        db.all("SELECT * FROM items ORDER BY id DESC", (err, items) => {
            if (err) { console.error(err); return res.send("Error loading items"); }

            db.all("SELECT DISTINCT group_id FROM items WHERE group_id IS NOT NULL ORDER BY group_id ASC", (err, groups) => {
                if (err) { console.error(err); return res.send("Error loading groups"); }

                // Stats Calculation
                db.get(`SELECT 
                    SUM(current_bid) as total_raised, 
                    COUNT(DISTINCT bidder_email) as unique_bidders 
                    FROM items 
                    WHERE bidder_email IS NOT NULL AND bidder_email != ''`, 
                (err, itemStats) => {
                    
                    db.get("SELECT COUNT(*) as total_bids FROM bids", (err, bidStats) => {
                        res.render('admin', { 
                            items: items, 
                            isPaused: settings.is_paused,
                            timerEndsAt: settings.timer_ends_at,
                            baseUrl: BASE_URL,
                            activeGroups: groups || [],
                            stats: {
                                raised: itemStats ? itemStats.total_raised : 0,
                                bidders: itemStats ? itemStats.unique_bidders : 0,
                                totalBids: bidStats ? bidStats.total_bids : 0
                            }
                        });
                    });
                });
            });
        });
    });
});

// EDIT ROUTES
app.get('/admin/edit/:id', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.get("SELECT * FROM items WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.redirect('/admin');
        res.render('edit', { item: row });
    });
});

app.post('/admin/edit/:id', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    const { name, description, startPrice, placement, bidType, groupId } = req.body;
    const parsedStart = parseFloat(startPrice) || 0;
    const parsedBidType = parseInt(bidType) || 1;
    const parsedGroup = parseInt(groupId) || 0;
    
    db.get("SELECT current_bid, bidder_email FROM items WHERE id = ?", [req.params.id], (err, item) => {
        if (!item) return res.redirect('/admin');
        const newCurrentBid = item.bidder_email ? item.current_bid : parsedStart;

        db.run(
            "UPDATE items SET name = ?, description = ?, start_price = ?, placement = ?, bid_type = ?, group_id = ?, current_bid = ? WHERE id = ?",
            [name, description, parsedStart, parseInt(placement) || 0, parsedBidType, parsedGroup, newCurrentBid, req.params.id],
            () => res.redirect('/admin')
        );
    });
});

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
    const placement = parseInt(req.body.placement) || 0;
    const bidType = parseInt(req.body.bidType) || 1;
    const groupId = parseInt(req.body.groupId) || 0;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://placehold.co/600x400';

    db.run("INSERT INTO items (name, description, image_url, start_price, current_bid, placement, bid_type, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [name, description, imageUrl, startPrice, startPrice, placement, bidType, groupId],
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

app.post('/admin/end', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');

    console.log("Starting End Auction Sequence...");

    db.run("UPDATE settings SET is_paused = 1, timer_ends_at = 0", async () => {
        
        db.all("SELECT * FROM items WHERE bidder_email IS NOT NULL AND bidder_email != '' ORDER BY bidder_name ASC", [], async (err, items) => {
            if (err || !items || items.length === 0) return res.redirect('/admin'); 

            let csvContent = "Winner Name,Winner Email,Item Name,Winning Bid,Item Link,Group #,Runner Up Name,Runner Up Email,Runner Up Bid\n";
            const winners = {};

            for (const row of items) {
                const itemLink = `${BASE_URL}/item/${row.id}`;
                const safeName = (row.bidder_name || 'Anonymous').replace(/"/g, '""');
                const safeItemName = (row.name || '').replace(/"/g, '""');
                const tableNum = row.group_id > 0 ? row.group_id : 'General';
                
                const runnerUp = await new Promise((resolve) => {
                    db.get("SELECT * FROM bids WHERE item_id = ? AND email != ? ORDER BY amount DESC LIMIT 1", 
                        [row.id, row.bidder_email], 
                        (err, r) => resolve(r)
                    );
                });

                const runnerName = runnerUp ? runnerUp.name.replace(/"/g, '""') : "None";
                const runnerEmail = runnerUp ? runnerUp.email : "None";
                const runnerBid = runnerUp ? `$${runnerUp.amount.toFixed(2)}` : "0.00";

                csvContent += `"${safeName}","${row.bidder_email}","${safeItemName}","$${row.current_bid.toFixed(2)}","${itemLink}","${tableNum}","${runnerName}","${runnerEmail}","${runnerBid}"\n`;

                if (!winners[row.bidder_email]) {
                    winners[row.bidder_email] = { name: row.bidder_name, items: [], total: 0 };
                }
                winners[row.bidder_email].items.push(row);
                winners[row.bidder_email].total += row.current_bid;
            }

            try {
                await transporter.sendMail({
                    from: 'rooservicestation@gmail.com',
                    to: 'rooservicestation@gmail.com', 
                    subject: '🚨 AUCTION ENDED: Final Winners Report',
                    html: `<h3>The auction is closed.</h3><p>Attached is the final list of winners and runner-ups.</p>`,
                    attachments: [{ filename: 'tostan_auction_final.csv', content: csvContent }]
                });
                console.log("Admin report sent.");
            } catch (e) {
                console.error("Failed to send admin report:", e);
            }

            const winnerEmails = Object.keys(winners);
            console.log(`Sending emails to ${winnerEmails.length} winners...`);

            (async () => {
                for (const email of winnerEmails) {
                    const winner = winners[email];
                    let itemsListHtml = winner.items.map(item => `<li><strong>${item.name}</strong> (Group ${item.group_id || 'Gen'}) - $${item.current_bid.toFixed(2)}</li>`).join('');
                    
                    try {
                        await transporter.sendMail({
                            from: 'rooservicestation@gmail.com',
                            to: email,
                            subject: '🎉 You won at the Tostan Art Auction!',
                            html: `
                                <h2>Congratulations ${winner.name}!</h2>
                                <p>Bidding has officially closed, and you are the winning bidder for the following item(s):</p>
                                <ul>${itemsListHtml}</ul>
                                <p><strong>Total Due: $${winner.total.toFixed(2)}</strong></p>
                                <p>Please head over to the checkout table to pay for your art and claim your items!</p>
                                <br>
                                <p>Thank you for supporting Tostan!</p>
                                <p><em>This is an automated message, please do not reply.</em></p>
                            `
                        });
                        console.log(`Email sent to ${winner.name}`);
                    } catch (e) {
                        console.error(`Failed email to ${winner.name}:`, e);
                    }
                    
                    await delay(1000); 
                }
                console.log("All emails sent.");
            })();

            res.redirect('/admin');
        });
    });
});

// --- NEW: RESET AUCTION (Danger Zone) ---
app.post('/admin/reset', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');

    console.log("RESETTING AUCTION DATA...");

    db.serialize(() => {
        // 1. Delete all history
        db.run("DELETE FROM bids", (err) => {
            if (err) console.error("Error clearing bids history:", err);
        });

        // 2. Reset Items to starting price and remove winners
        db.run(`UPDATE items SET current_bid = start_price, bidder_email = NULL, bidder_name = NULL`, (err) => {
            if (err) console.error("Error resetting items:", err);
        });
        
        // 3. Reset Timer & Pause state
        db.run("UPDATE settings SET is_paused = 1, timer_ends_at = 0", () => {
             res.redirect('/admin');
        });
    });
});

app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/admin/login');
    db.run("DELETE FROM items WHERE id = ?", req.params.id, () => res.redirect('/admin'));
});

app.listen(PORT, () => console.log(`Server running at ${BASE_URL}`));