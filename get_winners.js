const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Connect to the existing database
const db = new sqlite3.Database('./auction.db', (err) => {
    if (err) return console.error("Could not connect to database:", err.message);
    console.log('Connected to the auction database.');
});

// Run the same query the server would have run
db.all("SELECT * FROM items WHERE bidder_email IS NOT NULL AND bidder_email != '' ORDER BY bidder_name ASC", [], (err, rows) => {
    if (err) {
        console.error("Error retrieving data:", err);
        return;
    }

    console.log(`Found ${rows.length} winning bids.`);

    // Build the CSV content
    let csvContent = "Winner Name,Winner Email,Item Name,Winning Bid,Item Link,Group #\n";
    
    rows.forEach(row => {
        // Use your generic ngrok or local link here since the event is effectively over
        const itemLink = `https://tostan.ngrok.io/item/${row.id}`; 
        const safeName = (row.bidder_name || 'Anonymous').replace(/"/g, '""');
        const safeItemName = (row.name || '').replace(/"/g, '""');
        const tableNum = row.group_id > 0 ? row.group_id : 'General';
        
        csvContent += `"${safeName}","${row.bidder_email}","${safeItemName}","$${row.current_bid.toFixed(2)}","${itemLink}","${tableNum}"\n`;
    });

    // Write the file to your hard drive
    fs.writeFileSync('EMERGENCY_WINNERS.csv', csvContent);
    console.log("\n✅ SUCCESS! File created: EMERGENCY_WINNERS.csv");
    console.log("You can open this file in Excel/Google Sheets to handle payments.");
});